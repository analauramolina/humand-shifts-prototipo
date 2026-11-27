/* =====================================================================
   Datos compartidos de Luna Zapatería: los usan la app (index.html) y el Admin (admin.html)
   ===================================================================== */

/* Persistencia compartida entre la app y el Admin.
   Usa localStorage; si el navegador lo bloquea (algunos lo hacen con archivos abiertos con doble clic),
   usa window.name, que se conserva al pasar de una página a otra en la misma pestaña. */
const Store = (() => {
  let ls = null;
  try { localStorage.setItem('luna:__test', '1'); localStorage.removeItem('luna:__test'); ls = localStorage; } catch(e) {}
  const leer = () => { try { const o = JSON.parse(window.name || '{}'); return (o && o.__luna) ? o : {__luna:true}; } catch(e) { return {__luna:true}; } };
  return {
    get(k, def){ try { if(ls){ const v = ls.getItem('luna:'+k); return v ? JSON.parse(v) : def; } const o = leer(); return (k in o) ? o[k] : def; } catch(e){ return def; } },
    set(k, v){ try { if(ls){ ls.setItem('luna:'+k, JSON.stringify(v)); return true; } const o = leer(); o[k] = v; window.name = JSON.stringify(o); return true; } catch(e){ return false; } },
    del(k){ try { if(ls){ ls.removeItem('luna:'+k); return; } const o = leer(); delete o[k]; window.name = JSON.stringify(o); } catch(e){} },
  };
})();
let REGLAS_GUARDADAS = Store.get('reglas', null); // configuración hecha desde Admin > Reglas (se relee al volver a la app)

/* ---------- Configuración de la empresa ---------- */
const SEDES = [{pais:'Argentina', items:['Olivos','Recoleta']}];
const SEDE_PAIS = {Olivos:'Argentina', Recoleta:'Argentina'};
const PAISES = [...new Set(Object.values(SEDE_PAIS))]; // países donde la empresa tiene sedes
const CAPACIDAD = 48;

const TURNOS = {
  AP:{nombre:'Turno apertura', inicio:'09:00', fin:'17:00', horas:8, color:'Azul', desc:''},
  CI:{nombre:'Turno cierre',   inicio:'11:00', fin:'19:00', horas:8, color:'Rosa', desc:''},
};
/* Repositorio de turnos: los turnos creados, editados o eliminados desde la app se guardan y pisan a los de arriba */
Object.assign(TURNOS, Store.get('turnos', {}));
/* Plantillas de ejemplo para "Asignar plantilla" (se aplican desde la fecha de inicio hasta el domingo) */
const PLANTILLAS = [
  {id:'P1', nombre:'5x2 apertura', desc:'Trabaja 5 días y descansa 2', patron:['AP','AP','AP','AP','AP','D','D']},
  {id:'P2', nombre:'6x1 cierre',   desc:'Trabaja 6 días y descansa 1', patron:['CI','CI','CI','CI','CI','CI','D']},
];
/* Plantillas creadas, editadas o eliminadas desde el Repositorio de turnos */
(() => { const g = Store.get('plantillas', null); if (Array.isArray(g)) PLANTILLAS.splice(0, PLANTILLAS.length, ...g); })();

/* Vistas de cobertura por estacionalidad: cantidad de personas por turno y por rol que la sede necesita cada día.
   Se eligen y editan desde Turnos laborales (Cobertura > Agregar cobertura). Cada sede aplica una vista por semana. */
const ROLES = ['Encargado de sucursal','Cajero','Vendedor'];
const VISTAS_BASE = [
  {id:'normal', nombre:'Demanda normal', turnos:{AP:{'Encargado de sucursal':1,'Cajero':1,'Vendedor':2}, CI:{'Encargado de sucursal':1,'Cajero':1,'Vendedor':2}}},
  {id:'alta',   nombre:'Alta demanda',   turnos:{AP:{'Encargado de sucursal':1,'Cajero':1,'Vendedor':3}, CI:{'Encargado de sucursal':1,'Cajero':1,'Vendedor':3}}},
];
const ROL_CORTO = {'Encargado de sucursal':'Encargado','Cajero':'Cajero','Vendedor':'Vendedor'};


const DIAS = ['Lun, 30','Mar, 1','Mié, 2','Jue, 3','Vie, 4','Sáb, 5','Dom, 6'];
const DIAS_LARGOS = ['lunes 30/11','martes 01/12','miércoles 02/12','jueves 03/12','viernes 04/12','sábado 05/12','domingo 06/12'];
const DIAS_CORTOS = ['lun','mar','mié','jue','vie','sáb','dom'];
const FECHAS = ['30/11/2026','01/12/2026','02/12/2026','03/12/2026','04/12/2026','05/12/2026','06/12/2026'];
const FECHAS_CONF = ['30/NOV/2026','01/DIC/2026','02/DIC/2026','03/DIC/2026','04/DIC/2026','05/DIC/2026','06/DIC/2026'];
const FESTIVOS = []; // Semana del 30/11 al 06/12/2026: sin feriados

/* 24 colaboradores, 12 por sede: 3 encargados, 3 cajeros y 6 vendedores (dotación suficiente para la cobertura).
   semana[d] es una lista de asignaciones del día: 'AP', 'CI' o 'D' (día de descanso). */
const DOTACION = [
  ['Recoleta','Encargado de sucursal',['Camila Ferreyra','Gonzalo Ríos','Paula Méndez']],
  ['Recoleta','Cajero',['Joaquín Benítez','Sofía Medina','Lautaro Gómez']],
  ['Recoleta','Vendedor',['Diego Sosa','Florencia Ruiz','Lucía Romero','Mateo Álvarez','Julieta Navarro','Bruno Vega']],
  ['Olivos','Encargado de sucursal',['Martín Giménez','Carolina Díaz','Emiliano Torres']],
  ['Olivos','Cajero',['Valentina Acosta','Nicolás Castro','Micaela Suárez']],
  ['Olivos','Vendedor',['Tomás Herrera','Agustina Paz','Federico Ibarra','Rocío Molina','Santiago Pereyra','Milagros Cabrera']],
];
const COLABORADORES = DOTACION.flatMap(([sede,rol,nombres]) => nombres.map((nombre,i) => ({nombre, rol, sede, horario:['ap','ci','ap-dom','ci-dom'][i%4]})))
 .sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'))
 .map((c,i)=>({...c, id:i, capacidad:CAPACIDAD, semana:[[],[],[],[],[],[],[]]}));

/* ---------- Usuarios (Admin > Usuarios): datos del perfil e historial laboral ----------
   El puesto actual del historial define el rol laboral y la sede que usan la app y el motor. */
const sinAcentos = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const PERFILES = {};
COLABORADORES.forEach(c => {
  const [nombre, ...resto] = c.nombre.split(' '), apellido = resto.join(' ');
  const contr = new Date(2021 + (c.id % 4), (c.id * 5) % 12, (c.id * 7) % 27 + 1);
  const alta = contr < new Date(2024, 7, 1) ? new Date(2024, 7, 1 + (c.id % 9)) : contr; // la empresa empezó a usar Humand en agosto de 2024
  const iso = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  PERFILES[c.nombre] = { nombre, apellido, email: sinAcentos(`${nombre}.${apellido}`.toLowerCase()).replace(/\s+/g, '') + '@lunazapateria.com.ar', contratacion: iso(contr), creacion: iso(alta) };
});
const SIN_PUESTO = ['Milagros Cabrera'];
const CLAVE_PUESTOS = 'puestos.v3';
/* Departamentos de la empresa (no son las sedes: la sede de cada persona se mantiene fija) */
const DEPARTAMENTOS = ['Atención al público', 'Departamento comercial', 'Administración', 'Logística'];
const deptoDeRol = r => r === 'Encargado de sucursal' ? 'Departamento comercial' : 'Atención al público';
const HISTORIAL_LABORAL = (() => {
  const h = {};
  COLABORADORES.forEach(c => {
    const jefe = c.rol === 'Encargado de sucursal' ? '' : (COLABORADORES.find(x => x.sede === c.sede && x.rol === 'Encargado de sucursal') || {}).nombre || '';
    // Milagros Cabrera ingresa sin puesto cargado: su rol laboral se asigna desde Admin > Usuarios > Trabajo
    h[c.nombre] = SIN_PUESTO.includes(c.nombre) ? [] : [{ puesto: c.rol, inicio: PERFILES[c.nombre].contratacion, fin: '', depto: deptoDeRol(c.rol), jefe, aprob: '' }];
  });
  const g = Store.get(CLAVE_PUESTOS, null);
  if (g) Object.keys(g).forEach(n => { if (h[n]) h[n] = g[n]; });
  return h;
})();
/* Puesto actual: el que no tiene fecha de fin; si hay varios, el de inicio más reciente */
const puestoActual = n => (HISTORIAL_LABORAL[n] || []).filter(p => !p.fin).sort((a, b) => b.inicio.localeCompare(a.inicio))[0] || null;
function aplicarPuestos() {
  COLABORADORES.forEach(c => { const p = puestoActual(c.nombre); if (!p) { c.rol = ''; return; } c.rol = ROLES.includes(p.puesto) ? p.puesto : ''; });
}
/* Relee los puestos guardados desde el Admin (por ejemplo, al volver del Admin a la app) */
function recargarPuestos() {
  const g = Store.get(CLAVE_PUESTOS, null);
  if (g) Object.keys(g).forEach(n => { if (HISTORIAL_LABORAL[n]) HISTORIAL_LABORAL[n] = g[n]; });
  aplicarPuestos();
}
aplicarPuestos();

/* Time off aprobado para la semana (días 0 = lunes ... 6 = domingo) */
const LICENCIAS = {
  'Tomás Herrera':   {tipo:'Vacaciones',      dias:[0,1,2]},
  'Lautaro Gómez':   {tipo:'Licencia médica', dias:[3,4]},
  'Julieta Navarro': {tipo:'Vacaciones',      dias:[4,5,6]},
};

/* Historial de las últimas 4 semanas (datos de ejemplo): cada persona tiene un turno habitual
   y un franco habitual, con alguna variación. HISTORIAL[nombre] = [semana][día] -> 'AP' | 'CI' | '' */
const HISTORIAL = (() => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const h = {}; let n = 0;
  DOTACION.forEach(([, , nombres]) => nombres.forEach((nombre, i) => {
    const habitual = i % 2 === 0 ? 'AP' : 'CI', franco = (n++ * 3) % 7;
    h[nombre] = [0,1,2,3].map(() => [0,1,2,3,4,5,6].map(d => d === franco ? '' : (rnd() < 0.15 ? (habitual === 'AP' ? 'CI' : 'AP') : habitual)));
  }));
  return h;
})();


/* Horarios laborales base (Admin > Horarios laborales). Los turnos publicados en la app pisan al horario base. */
const HORARIOS = [
  {id:'ap',     nombre:'Apertura lunes a sábado',  dias:['AP','AP','AP','AP','AP','AP','D']},
  {id:'ci',     nombre:'Cierre lunes a sábado',    dias:['CI','CI','CI','CI','CI','CI','D']},
  {id:'ap-dom', nombre:'Apertura martes a domingo', dias:['D','AP','AP','AP','AP','AP','AP']},
  {id:'ci-dom', nombre:'Cierre martes a domingo',  dias:['D','CI','CI','CI','CI','CI','CI']},
];

/* Configuración de cobertura: vistas disponibles y vista aplicada en cada sede */
function coberturaConfig(){
  const c = Store.get('cobertura', null);
  const cfg = (c && c.vistas && c.vistas.length) ? c : { vistas: JSON.parse(JSON.stringify(VISTAS_BASE)) };
  // La vista se aplica por semana: semanas[sede][semana] = id de vista ('ninguna' si no se requiere cobertura).
  // Una semana sin vista propia usa la de la semana anterior más cercana; si no hay ninguna, no requiere cobertura.
  if(!cfg.semanas){ cfg.semanas = {}; SEDES.flatMap(g => g.items).forEach(s => { cfg.semanas[s] = cfg.aplicada && cfg.aplicada[s] ? { 0: cfg.aplicada[s] } : {}; }); delete cfg.aplicada; }
  SEDES.flatMap(g => g.items).forEach(s => { cfg.semanas[s] = cfg.semanas[s] || {}; });
  return cfg;
}
const VISTA_NINGUNA = { id: 'ninguna', nombre: 'Ninguna', turnos: {} };
const semanaActual = () => typeof SEM !== 'undefined' ? SEM : 0;
function vistaDe(sede, cfg = coberturaConfig(), off = semanaActual()){
  const marcas = Object.keys(cfg.semanas[sede] || {}).map(Number).filter(w => w <= off);
  if(!marcas.length) return VISTA_NINGUNA;
  const id = cfg.semanas[sede][Math.max(...marcas)];
  return cfg.vistas.find(v => v.id === id) || VISTA_NINGUNA;
}
/* Semana desde la que rige la vista aplicada (para avisar si se heredó de una semana anterior) */
function semanaOrigen(sede, cfg = coberturaConfig(), off = semanaActual()){
  const marcas = Object.keys(cfg.semanas[sede] || {}).map(Number).filter(w => w <= off);
  return marcas.length ? Math.max(...marcas) : null;
}
/* Cobertura vigente para una sede: la de su vista aplicada. Los roles en 0 no se muestran. */
function coberturaDe(sede, off = semanaActual()){
  if(!sede) return [];
  const v = vistaDe(sede, coberturaConfig(), off); if(!v) return [];
  return Object.keys(TURNOS).filter(t => v.turnos[t]).map(t => ({turno:t, roles:ROLES.map(rol => ({rol, cant:Number(v.turnos[t][rol]||0)})).filter(r => r.cant > 0)})).filter(g => g.roles.length);
}
