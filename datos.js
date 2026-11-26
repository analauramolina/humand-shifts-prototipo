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
  AP:{nombre:'Turno apertura', inicio:'09:00', fin:'17:00', horas:8},
  CI:{nombre:'Turno cierre',   inicio:'11:00', fin:'19:00', horas:8},
};
/* Plantillas de ejemplo para "Asignar plantilla" (se aplican desde la fecha de inicio hasta el domingo) */
const PLANTILLAS = [
  {nombre:'5x2 apertura', resumen:'5 turnos, 2 descansos', detalle:'trabaja 5 días, descansa 2', patron:['AP','AP','AP','AP','AP','D','D']},
  {nombre:'6x1 cierre',   resumen:'6 turnos, 1 descanso',  detalle:'trabaja 6 días, descansa 1', patron:['CI','CI','CI','CI','CI','CI','D']},
];

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
  if(c && c.vistas && c.vistas.length) return c;
  return { vistas: JSON.parse(JSON.stringify(VISTAS_BASE)), aplicada: {Olivos:'normal', Recoleta:'normal'} };
}
function vistaDe(sede, cfg = coberturaConfig()){ return cfg.vistas.find(v => v.id === cfg.aplicada[sede]) || cfg.vistas[0]; }
/* Cobertura vigente para una sede: la de su vista aplicada. Los roles en 0 no se muestran. */
function coberturaDe(sede){
  if(!sede) return [];
  const v = vistaDe(sede); if(!v) return [];
  return Object.keys(TURNOS).filter(t => v.turnos[t]).map(t => ({turno:t, roles:ROLES.map(rol => ({rol, cant:Number(v.turnos[t][rol]||0)})).filter(r => r.cant > 0)})).filter(g => g.roles.length);
}
