/* Navegación entre semanas, vista mensual y flujo de "Asignar turno" en dos pasos.
   Se carga después del script principal de index.html y extiende sus funciones. */

/* ---------- Fechas ---------- */
const DIA_MS = 864e5;
const BASE = new Date(2026, 10, 30); // lunes 30/11/2026 = semana 0
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MES3 = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const DCORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DLARGO = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const INICIAL = ['D','L','M','M','J','V','S']; // por getDay()
const fechaDe = (off, d) => new Date(2026, 10, 30 + off * 7 + d);
const iso = f => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dma = f => `${pad(f.getDate())}/${pad(f.getMonth() + 1)}/${f.getFullYear()}`;
const ubicar = f => { const n = Math.round((f - BASE) / DIA_MS); return { off: Math.floor(n / 7), d: ((n % 7) + 7) % 7 }; };
const vacia = () => [[], [], [], [], [], [], []];

/* ---------- Semanas ---------- */
let SEM = 0, MODO = 'semana', MES = { y: 2026, m: 11 };
const LIC0 = JSON.parse(JSON.stringify(LICENCIAS)); // las licencias aprobadas caen en la semana 0
const AUTOS = {};
// Las 4 semanas anteriores muestran el historial como turnos ya publicados
COLABORADORES.forEach(c => {
  c.semanas = {}; c.pubs = {};
  (HISTORIAL[c.nombre] || []).forEach((sem, w) => {
    const s = sem.map(k => [k || 'D']);
    c.semanas[w - 4] = s; c.pubs[w - 4] = JSON.stringify(s);
  });
});
const semanaDe = (c, off) => off === SEM ? c.semana : (c.semanas[off] || vacia());
const rangoSemana = () => `${FECHAS[0]} al ${FECHAS[6]}`;
const rangoCorto = () => `${FECHAS[0].slice(0, 5)} al ${FECHAS[6].slice(0, 5)}`;
const rangoConf = () => `${FECHAS_CONF[0]} al ${FECHAS_CONF[6]}`;

function pintarFechas() {
  for (let d = 0; d < 7; d++) {
    const f = fechaDe(SEM, d);
    DIAS[d] = `${DCORTO[d]}, ${f.getDate()}`;
    DIAS_LARGOS[d] = `${DLARGO[d]} ${pad(f.getDate())}/${pad(f.getMonth() + 1)}`;
    FECHAS[d] = dma(f);
    FECHAS_CONF[d] = `${pad(f.getDate())}/${MES3[f.getMonth()]}/${f.getFullYear()}`;
  }
  Object.keys(LIC0).forEach(n => { LICENCIAS[n].dias = SEM === 0 ? [...LIC0[n].dias] : []; });
}
function irASemana(off) {
  if (off === SEM) return;
  COLABORADORES.forEach(c => {
    c.semanas[SEM] = c.semana; c.pubs[SEM] = c.pub;
    c.semana = c.semanas[off] || vacia(); c.pub = c.pubs[off];
  });
  AUTOS[SEM] = AUTO; AUTO = AUTOS[off] || {};
  SEM = off; pintarFechas();
  if (selMode) salirSeleccion();
  sel = null; focus = null; deshacer = null;
}
// Semana que corresponde a un mes: la que contiene el primer jueves del mes
function semanaDelMes(y, m) { const p = ubicar(new Date(y, m, 1)); return fechaDe(p.off, 3).getMonth() === m ? p.off : p.off + 1; }
function mesDeSemana(off) { const j = fechaDe(off, 3); return { y: j.getFullYear(), m: j.getMonth() }; }

/* ---------- Barra: rango, flechas y selector Semanal / Mensual ---------- */
function actualizarBarra() {
  $('rango').textContent = MODO === 'semana' ? rangoSemana() : `${MESES[MES.m].toUpperCase()} ${MES.y}`;
  $('modoLbl').textContent = MODO === 'semana' ? 'Semanal' : 'Mensual';
  $('navPrev').setAttribute('aria-label', MODO === 'semana' ? 'Semana anterior' : 'Mes anterior');
  $('navNext').setAttribute('aria-label', MODO === 'semana' ? 'Semana siguiente' : 'Mes siguiente');
  const pb = $('progBtn'); pb.disabled = MODO === 'mes';
  pb.title = MODO === 'mes' ? 'La programación automática está disponible en la vista semanal' : '';
}
function navegar(delta) {
  closePopSilencioso();
  if (MODO === 'semana') irASemana(SEM + delta);
  else { const f = new Date(MES.y, MES.m + delta, 1); MES = { y: f.getFullYear(), m: f.getMonth() }; }
  render();
}
$('navPrev').onclick = e => { e.stopPropagation(); navegar(-1); };
$('navNext').onclick = e => { e.stopPropagation(); navegar(1); };
$('modoBtn').onclick = e => { e.stopPropagation(); $('modoDD').classList.toggle('open'); $('modoChev').className = 'ti ' + ($('modoDD').classList.contains('open') ? 'ti-chevron-up' : 'ti-chevron-down'); };
$('modoDD').addEventListener('click', e => {
  e.stopPropagation();
  const o = e.target.closest('[data-modo]'); if (!o) return;
  cerrarModo();
  const nuevo = o.dataset.modo; if (nuevo === MODO) return;
  closePopSilencioso();
  if (nuevo === 'mes') MES = mesDeSemana(SEM);
  else { const m = mesDeSemana(SEM); if (m.y !== MES.y || m.m !== MES.m) irASemana(semanaDelMes(MES.y, MES.m)); }
  MODO = nuevo; render();
});
function cerrarModo() { $('modoDD').classList.remove('open'); $('modoChev').className = 'ti ti-chevron-down'; }
document.addEventListener('click', cerrarModo);

/* ---------- Vista mensual ---------- */
const _renderSemana = render;
render = function () {
  const g = $('grid');
  if (MODO === 'semana') {
    g.classList.remove('mes'); g.style.gridTemplateColumns = ''; g.style.minWidth = '';
    _renderSemana(); actualizarBarra(); pintarModo(); return;
  }
  actualizarConflictos();
  const q = $('q').value.trim().toLowerCase();
  const lista = COLABORADORES.filter(c => (!sedeSel || c.sede === sedeSel) && (!q || c.nombre.toLowerCase().includes(q)));
  LISTA = lista;
  const n = new Date(MES.y, MES.m + 1, 0).getDate();
  const dias = Array.from({ length: n }, (_, i) => new Date(MES.y, MES.m, i + 1));
  let html = `<div class="gh first">Colaborador (${lista.length}/${COLABORADORES.length})</div>` +
    dias.map(f => `<div class="gh"><span>${INICIAL[f.getDay()]}</span><b>${pad(f.getDate())}</b></div>`).join('');
  if (!lista.length) html += `<div class="no-res">No hay colaboradores para mostrar.</div>`;
  for (const c of lista) {
    let h = 0;
    const celdas = dias.map(f => {
      const { off, d } = ubicar(f);
      const items = semanaDe(c, off)[d];
      const lic = off === 0 && LIC0[c.nombre] && LIC0[c.nombre].dias.includes(d) ? LIC0[c.nombre].tipo : '';
      let inner = lic ? `<div class="mshift lic" title="${lic}"><i class="ti ti-calendar-off"></i></div>` : '';
      items.forEach(k => {
        if (k === 'D') { inner += `<div class="mshift rest" title="Día de descanso"><i class="ti ti-bed"></i></div>`; return; }
        const t = TURNOS[k]; if (!t) return; h += t.horas;
        const key = `${c.id}-${d}-${k}`, m = off === SEM && MARCAS[key], auto = off === SEM && !m && AUTO[key];
        const col = t.color && t.color !== 'Azul' ? ` style="--tc:${COLORES[t.color]}"` : '';
        inner += `<div class="mshift${m ? ' cf-' + m : ''}${auto ? ' auto' : ''}${col ? ' tc' : ''}"${col} title="${t.nombre} ${t.inicio} - ${t.fin}">${t.inicio}<br>${t.fin}</div>`;
      });
      return `<div class="mcell" data-e="${c.id}" data-off="${off}" data-d="${d}">${inner}</div>`;
    }).join('');
    html += `<div class="emp"><div class="av"><i class="ti ti-user"></i></div><div class="emp-info">
      <div class="emp-name">${c.nombre}</div>
      ${rolHTML(c)}
      <div class="emp-hours"><i class="ti ti-clock"></i>${fmtH(h)} en el mes</div>
    </div></div>` + celdas;
  }
  html += coberturaMes(dias);
  g.classList.add('mes'); g.style.gridTemplateColumns = `282px repeat(${n}, 68px)`; g.style.minWidth = 'max-content';
  g.innerHTML = html;
  renderHeader(); actualizarBarra(); pintarModo();
};
function pintarModo() { document.querySelectorAll('#modoDD [data-modo]').forEach(o => o.classList.toggle('on', o.dataset.modo === MODO)); }
// Clic en un día del mes: abre esa semana con la celda seleccionada
$('grid').addEventListener('click', e => {
  const mc = e.target.closest('.mcell'); if (!mc) return;
  e.stopPropagation();
  irASemana(+mc.dataset.off); MODO = 'semana'; render();
  const cell = document.querySelector(`.cell[data-e="${mc.dataset.e}"][data-d="${mc.dataset.d}"]`);
  if (cell) { cell.scrollIntoView({ block: 'nearest', inline: 'nearest' }); openPop(cell); }
}, true);

/* ---------- Color de los turnos ---------- */
const COLORES = { Azul: '#3d5fd6', Rosa: '#b8317a', Amarillo: '#c99400', Verde: '#2e7d4f', Violeta: '#7b3fc4', Naranja: '#c25e00' };
const colorTurno = k => COLORES[(TURNOS[k] && TURNOS[k].color) || 'Azul'];
const _card = shiftCard;
shiftCard = function (c, d, k) {
  const html = _card(c, d, k), t = TURNOS[k];
  if (!t || !t.color || t.color === 'Azul' || MARCAS[`${c.id}-${d}-${k}`]) return html;
  return html.replace('<div class="shift', `<div style="--tc:${COLORES[t.color]}" class="tc shift`);
};

/* ---------- Asignar turno: elegir del repositorio (o desde cero) y completar los datos ---------- */
const FRECUENCIAS = { dia: 'Cada día', semana: 'Cada semana', '2sem': 'Cada 2 semanas', mes: 'Cada mes' };
const TERMINA = { nunca: 'Nunca', veces: 'Después de X veces', fecha: 'En una fecha determinada' };
const SEMANAS_INDEFINIDO = 12; // "Nunca" se materializa en las próximas 12 semanas
const _paint = paintDrawer;
paintDrawer = function () {
  $('drFoot').className = 'dr-foot';
  if (dr && dr.vista === 'repoTurno') return paintTurnoRepo();
  if (dr && dr.vista === 'turno') return paintRepo();
  if (dr && dr.vista === 'turnoForm') return paintForm();
  _paint();
};
$('drBack').onclick = () => { dr.vista = dr.vista === 'turnoForm' ? 'turno' : 'menu'; paintDrawer(); };

function paintRepo() {
  $('drTitle').textContent = 'Asignar turno'; $('drBack').style.display = 'block'; $('drFoot').innerHTML = '';
  $('drBody').innerHTML = `<button class="from-zero on" id="drZero"><span class="pl"><i class="ti ti-plus"></i></span><span style="flex:1"><b>Armar un turno desde cero</b><br><small>Ingresa manualmente los datos del turno.</small></span><i class="ti ti-chevron-right"></i></button>
    <div class="box"><label>Repositorio de turnos</label><div class="hint">Selecciona un turno del repositorio y edita los detalles que necesites.</div>
    <label class="field" style="justify-content:flex-start;gap:8px;margin-bottom:12px"><i class="ti ti-search" style="font-size:18px;color:#7a818c"></i><input id="repoQ" class="inp-bare" placeholder="Buscar" value="${dr.repoQ || ''}"></label>
    <div class="repo" id="repoList"></div></div>`;
  const lista = () => {
    const q = (dr.repoQ || '').toLowerCase();
    const ks = Object.keys(TURNOS).filter(k => !TURNOS[k].eliminado && TURNOS[k].nombre.toLowerCase().includes(q));
    $('repoList').innerHTML = ks.length ? ks.map(k => { const t = TURNOS[k];
      return `<button class="opt" data-k="${k}"><div><div class="n">${t.nombre}</div><div class="h">${t.inicio} - ${t.fin}</div></div><div class="d">${fmtProg(t.horas)} programadas</div></button>`; }).join('')
      : `<div class="hint" style="margin:8px 0 0">No hay turnos que coincidan con la búsqueda.</div>`;
  };
  lista();
  $('repoQ').oninput = e => { dr.repoQ = e.target.value; lista(); };
  $('repoList').onclick = e => { const b = e.target.closest('.opt'); if (b) abrirForm(b.dataset.k); };
  $('drZero').onclick = () => abrirForm(null);
}
const fmtProg = h => `${pad(Math.floor(h))}h${h % 1 ? ' ' + pad(Math.round(h % 1 * 60)) + 'm' : ''}`;
function abrirForm(k) {
  const t = k ? TURNOS[k] : null;
  dr.form = { nombre: t ? t.nombre : '', color: (t && t.color) || 'Azul', emps: dr.libre ? [] : [dr.emp],
    fecha: iso(fechaDe(SEM, dr.dia || 0)), inicio: t ? t.inicio : '', fin: t ? t.fin : '',
    ubic: dr.libre ? '' : COLABORADORES[dr.emp].sede, rep: false, freq: 'dia', termina: 'nunca', veces: '', hasta: '', fest: false, desc: '' };
  dr.vista = 'turnoForm'; paintDrawer();
}
function paintForm() {
  const f = dr.form;
  $('drTitle').textContent = 'Asignar turno'; $('drBack').style.display = 'block';
  const opts = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('');
  const libres = LISTA.length ? LISTA : COLABORADORES;
  $('drBody').innerHTML = `
    <div class="box"><div class="row2"><div style="flex:1"><label>Nombre del turno</label><input class="field" id="fNom" maxlength="40" value="${f.nombre.replace(/"/g, '&quot;')}" placeholder="Ej.: Turno apertura"></div>
      <div style="width:200px"><label>Color</label><div class="field colorf"><span class="dot" id="fDot" style="background:${COLORES[f.color]}"></span><select id="fCol">${opts(Object.fromEntries(Object.keys(COLORES).map(c => [c, c])), f.color)}</select></div></div></div></div>
    <div class="box"><label>Colaboradores</label>
      ${f.emps.length ? `<div class="chips">${f.emps.map(id => `<span class="chip">${COLABORADORES[id].nombre}<button data-quitar="${id}" aria-label="Quitar"><i class="ti ti-x" style="font-size:12px"></i></button></span>`).join('')}</div>` : ''}
      <select class="field" id="fEmp"><option value="">Buscar</option>${libres.filter(c => !f.emps.includes(c.id)).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select></div>
    <div class="box"><label>Fecha del turno</label><input type="date" class="field" id="fFecha" value="${f.fecha}"></div>
    <div class="box"><label>Horario</label><div class="row2"><input type="time" class="field" id="fIni" value="${f.inicio}"><input type="time" class="field" id="fFin" value="${f.fin}"></div>
      <div style="text-align:center;margin-top:12px"><button class="plus-sq" disabled title="Agregar otro tramo horario: no disponible en el prototipo"><i class="ti ti-plus"></i></button></div></div>
    <div class="box"><label>Ubicación (Opcional)</label><select class="field" id="fUbi"><option value="">Buscar</option>${SEDES.flatMap(g => g.items).map(s => `<option ${s === f.ubic ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="box"><label>Recurrencia</label>
      <label class="check"><input type="checkbox" id="fRep" ${f.rep ? 'checked' : ''}><span>Repetir turno<small>El turno se asigna de forma automática según la frecuencia configurada.</small></span></label>
      ${f.rep ? `<label class="sub">Repetir</label><select class="field" id="fFreq">${opts(FRECUENCIAS, f.freq)}</select>
      <label class="sub">Terminar repetición</label><select class="field" id="fTerm">${opts(TERMINA, f.termina)}</select>
      ${f.termina === 'veces' ? `<input type="number" class="field" id="fVeces" min="1" max="100" placeholder="Cantidad de repeticiones" value="${f.veces}" style="margin-top:10px">` : ''}
      ${f.termina === 'fecha' ? `<input type="date" class="field" id="fHasta" min="${f.fecha}" value="${f.hasta}" style="margin-top:10px">` : ''}
      <div class="hint" id="fRes" style="margin:12px 0 0"></div>` : ''}</div>
    <div class="box"><label>Días festivos</label><label class="check"><input type="checkbox" id="fFest" ${f.fest ? 'checked' : ''}><span>Incluir días festivos<small>Los turnos se asignan aunque el día sea feriado.</small></span></label></div>
    <div class="box"><label>Descripción (Opcional)</label><textarea class="field ta" id="fDesc" maxlength="250">${f.desc}</textarea><div class="cnt" id="fCnt">${f.desc.length}/250</div></div>`;
  $('drFoot').innerHTML = `<button class="btn-primary" id="drOk" style="width:100%">Asignar turno</button>`;
  const leer = () => {
    f.nombre = $('fNom').value; f.color = $('fCol').value; f.fecha = $('fFecha').value; f.inicio = $('fIni').value; f.fin = $('fFin').value;
    f.ubic = $('fUbi').value; f.fest = $('fFest').checked; f.desc = $('fDesc').value;
    if ($('fVeces')) f.veces = $('fVeces').value; if ($('fHasta')) f.hasta = $('fHasta').value;
  };
  const validar = () => { leer(); $('fDot').style.background = COLORES[f.color]; $('fCnt').textContent = `${f.desc.length}/250`; if ($('fRes')) $('fRes').textContent = resumen(f); $('drOk').disabled = !valido(f); };
  $('drBody').oninput = validar; $('drBody').onchange = validar;
  $('fRep').onchange = () => { leer(); f.rep = $('fRep').checked; paintForm(); };
  if ($('fFreq')) $('fFreq').onchange = () => { leer(); f.freq = $('fFreq').value; paintForm(); };
  if ($('fTerm')) $('fTerm').onchange = () => { leer(); f.termina = $('fTerm').value; paintForm(); };
  $('fEmp').onchange = () => { leer(); if ($('fEmp').value !== '') f.emps.push(+$('fEmp').value); paintForm(); };
  $('drBody').querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { leer(); f.emps = f.emps.filter(id => id !== +b.dataset.quitar); paintForm(); });
  $('drOk').onclick = () => { leer(); if (valido(f)) confirmarTurno(f); };
  validar();
}
function resumen(f) {
  const cada = FRECUENCIAS[f.freq].toLowerCase();
  if (f.termina === 'veces') return f.veces > 0 ? `Este turno se repite ${cada}, ${f.veces} ${+f.veces === 1 ? 'vez' : 'veces'}.` : 'Indicá cuántas veces se repite el turno.';
  if (f.termina === 'fecha') return f.hasta ? `Este turno se repite ${cada}, hasta el ${dma(deIso(f.hasta))}.` : 'Indicá la fecha en que termina la repetición.';
  return `Este turno se repite ${cada}, indefinidamente.`;
}
function valido(f) {
  if (!f.nombre.trim() || !f.emps.length || !f.fecha || !f.inicio || !f.fin || f.fin <= f.inicio) return false;
  if (f.rep && f.termina === 'veces' && !(+f.veces >= 1)) return false;
  if (f.rep && f.termina === 'fecha' && !(f.hasta && f.hasta >= f.fecha)) return false;
  return true;
}
function fechasDe(f) {
  const ini = deIso(f.fecha);
  if (!f.rep) return [ini];
  const paso = i => f.freq === 'dia' ? new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i)
    : f.freq === 'semana' ? new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 7 * i)
    : f.freq === '2sem' ? new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 14 * i)
    : new Date(ini.getFullYear(), ini.getMonth() + i, ini.getDate());
  const hasta = f.termina === 'fecha' ? deIso(f.hasta) : f.termina === 'nunca' ? new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 7 * SEMANAS_INDEFINIDO - 1) : null;
  const max = f.termina === 'veces' ? +f.veces : 400, out = [];
  for (let i = 0; out.length < max; i++) { const x = paso(i); if (hasta && x > hasta) break; out.push(x); }
  return out;
}
function confirmarTurno(f) {
  const nombre = f.nombre.trim();
  let k = Object.keys(TURNOS).find(x => !TURNOS[x].eliminado && TURNOS[x].nombre === nombre && TURNOS[x].inicio === f.inicio && TURNOS[x].fin === f.fin);
  if (!k) { k = nuevaClave(); TURNOS[k] = { nombre, inicio: f.inicio, fin: f.fin, horas: hNum(f.fin) - hNum(f.inicio), desc: f.desc }; }
  TURNOS[k].color = f.color; guardarTurnos();
  const fechas = fechasDe(f).filter(x => f.fest || !FESTIVOS.includes(ubicar(x).d) || ubicar(x).off !== SEM);
  f.emps.forEach(id => {
    const c = COLABORADORES[id];
    fechas.forEach(x => {
      const { off, d } = ubicar(x);
      if (off === SEM) { agregar(c, d, k); return; }
      const s = c.semanas[off] || (c.semanas[off] = vacia());
      if (!s[d].includes(k)) s[d].push(k);
    });
  });
  const n = f.emps.length, primero = COLABORADORES[f.emps[0]];
  // Si ninguna fecha cae en la semana visible, se navega a la semana del primer turno
  if (MODO === 'semana' && !fechas.some(x => ubicar(x).off === SEM)) irASemana(ubicar(fechas[0]).off);
  closeDrawer();
  const cuanto = fechas.length > 1 ? `${fechas.length} turnos` : 'el turno';
  avisoAsignacion(primero, `Asignaste ${cuanto} a ${n} colaborador${n > 1 ? 'es' : ''}`);
}


/* ---------- Repositorio de turnos: listado, crear, editar y eliminar ---------- */
const nuevaClave = () => { let n = 1; while (TURNOS['T' + n]) n++; return 'T' + n; };
const guardarTurnos = () => Store.set('turnos', TURNOS);
const fmtHM = h => `${pad(Math.floor(h))}h ${pad(Math.round(h % 1 * 60))}m`;
let rpTab = 't', rpMenuK = null;
document.body.insertAdjacentHTML('beforeend', `
<div class="rp" id="rp">
  <div class="rp-head"><button id="rpBack" aria-label="Volver"><i class="ti ti-arrow-left"></i></button><h1>Repositorio de turnos</h1></div>
  <div class="rp-wrap">
    <div class="rp-tabs"><button class="on" data-tab="t">Turnos individuales</button><button data-tab="p">Plantillas de turnos</button></div>
    <h2 id="rpTit">Turnos creados</h2>
    <div class="rp-bar"><label class="rp-search"><i class="ti ti-search"></i><input id="rpQ" placeholder="Buscar por nombre"></label><button class="btn-primary" id="rpNew"><i class="ti ti-plus"></i>Crear turno</button></div>
    <div class="rp-list" id="rpList"></div>
  </div>
</div>
<div class="rp-menu" id="rpMenu"><button data-a="edit"><i class="ti ti-pencil"></i>Editar turno</button><button data-a="del" class="danger"><i class="ti ti-trash"></i>Eliminar turno</button></div>`);
function pintarRepo() {
  const q = $('rpQ').value.trim().toLowerCase();
  document.querySelectorAll('.rp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === rpTab));
  $('rpTit').textContent = rpTab === 't' ? 'Turnos creados' : 'Plantillas creadas';
  $('rpNew').innerHTML = `<i class="ti ti-plus"></i>${rpTab === 't' ? 'Crear turno' : 'Crear plantilla'}`;
  $('rpNew').disabled = rpTab === 'p'; $('rpNew').title = rpTab === 'p' ? 'No disponible en el prototipo' : '';
  if (rpTab === 'p') {
    const ps = PLANTILLAS.filter(p => p.nombre.toLowerCase().includes(q));
    $('rpList').innerHTML = ps.map(p => { const h = p.patron.reduce((a, k) => a + (TURNOS[k] ? TURNOS[k].horas : 0), 0);
      return `<div class="rp-card" style="--tc:#d5daf0"><div><div class="n">${p.nombre}</div><div class="h">${p.detalle}</div></div><span class="p">${fmtHM(h)} totales</span></div>`; }).join('') || '<div class="hint">No hay plantillas con ese nombre.</div>';
    return;
  }
  const ks = Object.keys(TURNOS).filter(k => !TURNOS[k].eliminado && TURNOS[k].nombre.toLowerCase().includes(q));
  $('rpList').innerHTML = ks.map(k => { const t = TURNOS[k];
    return `<div class="rp-card" style="--tc:${colorTurno(k)}"><div><div class="n">${t.nombre}</div><div class="h">${t.inicio} - ${t.fin}</div>${t.desc ? `<div class="ds">${t.desc}</div>` : ''}</div><span class="p">${fmtHM(t.horas)} programadas</span><button class="k" data-k="${k}" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button></div>`; }).join('')
    || `<div class="hint">${q ? 'No hay turnos con ese nombre.' : 'Todavía no hay turnos creados.'}</div>`;
}
function abrirRepo() { closePopSilencioso(); rpTab = 't'; $('rpQ').value = ''; pintarRepo(); $('rp').classList.add('open'); }
function cerrarRepo() { $('rp').classList.remove('open'); cerrarRpMenu(); render(); }
function cerrarRpMenu() { $('rpMenu').classList.remove('open'); rpMenuK = null; }
$('repoBtn').onclick = e => { e.stopPropagation(); abrirRepo(); };
$('rpBack').onclick = cerrarRepo;
$('rpQ').oninput = pintarRepo;
document.querySelector('.rp-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { rpTab = b.dataset.tab; pintarRepo(); } };
$('rpNew').onclick = () => abrirTurnoRepo(null);
$('rpList').onclick = e => {
  const b = e.target.closest('.k'); if (!b) return;
  e.stopPropagation();
  if (rpMenuK === b.dataset.k) return cerrarRpMenu();
  rpMenuK = b.dataset.k; const r = b.getBoundingClientRect(), m = $('rpMenu');
  m.classList.add('open'); m.style.top = (r.bottom + 4) + 'px'; m.style.left = (r.right - m.offsetWidth) + 'px';
};
$('rpMenu').onclick = e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  e.stopPropagation(); const k = rpMenuK; cerrarRpMenu();
  if (b.dataset.a === 'edit') return abrirTurnoRepo(k);
  modal('¿Quieres eliminar este turno?', 'Si lo eliminas, no vas a poder recuperarlo. Los turnos ya asignados no se van a ver afectados.', 'Eliminar turno', () => {
    TURNOS[k].eliminado = true; guardarTurnos(); pintarRepo(); toast('El turno se eliminó correctamente');
  }, true);
};
document.addEventListener('click', cerrarRpMenu);

function abrirTurnoRepo(k, volver) {
  openDrawer('repoTurno', 0, 0);
  const t = k ? TURNOS[k] : null;
  dr.k = k; dr.volver = volver || null; dr.rt = { nombre: t ? t.nombre : '', color: t ? (t.color || 'Azul') : 'Azul', inicio: t ? t.inicio : '', fin: t ? t.fin : '', desc: t ? (t.desc || '') : '' };
  paintDrawer();
}
function paintTurnoRepo() {
  const f = dr.rt; if (!f) return;
  $('drTitle').textContent = dr.k ? 'Editar turno' : 'Crear turno'; $('drBack').style.display = 'none';
  $('drBody').innerHTML = `
    <div class="box"><div class="row2"><div style="flex:1"><label>Nombre del turno</label><input class="field" id="rtNom" maxlength="40" placeholder="Ej. Turno mañana" value="${f.nombre.replace(/"/g, '&quot;')}"></div>
      <div style="width:200px"><label>Color</label><div class="field colorf"><span class="dot" id="rtDot" style="background:${COLORES[f.color]}"></span><select id="rtCol">${Object.keys(COLORES).map(c => `<option ${c === f.color ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div></div></div>
    <div class="box"><label>Horario</label><div class="row2"><input type="time" class="field" id="rtIni" title="Hora de entrada" value="${f.inicio}"><input type="time" class="field" id="rtFin" title="Hora de salida" value="${f.fin}"></div>
      <div style="text-align:center;margin-top:12px"><button class="plus-sq" disabled title="Agregar otro tramo horario: no disponible en el prototipo"><i class="ti ti-plus"></i></button></div></div>
    <div class="box"><label>Descripción</label><textarea class="field ta" id="rtDesc" maxlength="250" placeholder="Escribe una descripción">${f.desc}</textarea><div class="cnt" id="rtCnt">${f.desc.length}/250</div></div>`;
  $('drFoot').className = 'dr-foot dos';
  $('drFoot').innerHTML = `<button class="link" id="rtDescartar">Descartar turno</button><button class="btn-primary" id="rtOk">${dr.k ? 'Guardar cambios' : 'Crear turno'}</button>`;
  const leer = () => { f.nombre = $('rtNom').value; f.color = $('rtCol').value; f.inicio = $('rtIni').value; f.fin = $('rtFin').value; f.desc = $('rtDesc').value; };
  const ok = () => f.nombre.trim() && f.inicio && f.fin && f.fin > f.inicio;
  const validar = () => { leer(); $('rtDot').style.background = COLORES[f.color]; $('rtCnt').textContent = `${f.desc.length}/250`; $('rtOk').disabled = !ok(); };
  $('drBody').oninput = validar; $('drBody').onchange = validar; validar();
  $('rtDescartar').onclick = () => { const v = dr.volver; closeDrawer(); if (v) v(null); };
  $('rtOk').onclick = () => {
    leer(); if (!ok()) return;
    const datos = { nombre: f.nombre.trim(), color: f.color, inicio: f.inicio, fin: f.fin, horas: hNum(f.fin) - hNum(f.inicio), desc: f.desc.trim() };
    const editado = !!dr.k;
    const nk = editado ? dr.k : nuevaClave(), v = dr.volver;
    const guardar = () => {
      if (editado) { congelarAsignados(nk); Object.assign(TURNOS[nk], datos); } else TURNOS[nk] = datos;
      guardarTurnos(); closeDrawer(); pintarRepo(); if (v) v(nk);
      toast(editado ? 'Los cambios se guardaron correctamente' : 'El turno se creó correctamente');
    };
    if (!editado) return guardar();
    modal('¿Guardar los cambios de este turno?', 'Los cambios no van a afectar los turnos ya asignados a colaboradores.', 'Guardar cambios', guardar);
    $('mCancel').textContent = 'Salir sin guardar';
    $('mCancel').onclick = () => { $('modalBg').classList.remove('open'); closeDrawer(); if (v) v(null); };
  };
}

/* ---------- Pantalla completa ---------- */
const pantallaCompleta = on => { document.body.classList.toggle('full', on); window.scrollTo(0, 0); };
$('fullBtn').onclick = e => { e.stopPropagation(); pantallaCompleta(true); };
$('fullX').onclick = e => { e.stopPropagation(); pantallaCompleta(false); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('full') && !dr && !$('pop').classList.contains('open') && !selMode && !pasteMode && !$('modalBg').classList.contains('open')) pantallaCompleta(false);
});

/* ---------- Tipos de conflicto: etiqueta en la tarjeta y filtros en el panel ---------- */
const CF_TIPO = { solap: ['Solapado', 'stack-2'], desc: ['En día de descanso', 'bed'], semanal: ['Descanso semanal', 'calendar-x'], entre: ['Entre jornadas', 'moon'],
  licencia: ['En licencia', 'calendar-off'], diario: ['Tope diario', 'clock'], semana: ['Tope semanal', 'calendar-time'] };
let CF_KEYS = {};
const _actConf = actualizarConflictos;
actualizarConflictos = function () {
  _actConf(); CF_KEYS = {};
  CONF.forEach(cf => cf.turnos.forEach(([d, k]) => { const key = `${cf.emp}-${d}-${k}`; (CF_KEYS[key] = CF_KEYS[key] || new Set()).add(cf.tipo); }));
};
const tiposDe = key => [...(CF_KEYS[key] || [])].sort((a, b) => (TIPOS[a].sev === 'B' ? 0 : 1) - (TIPOS[b].sev === 'B' ? 0 : 1));
const _cardTipo = shiftCard;
shiftCard = function (c, d, k) {
  const html = _cardTipo(c, d, k), ts = tiposDe(`${c.id}-${d}-${k}`);
  if (!ts.length || !MARCAS[`${c.id}-${d}-${k}`]) return html;
  // La clasificación del conflicto se muestra solo en el panel de Conflictos.
  // Un turno que se superpone con vacaciones o licencia usa el estilo de Humand (borde rosado, texto e ícono bordó).
  return ts.includes('licencia') ? html.replace(/^<div([^>]*?)class="/, '<div$1class="cf-lic ') : html;
};
const _paintConf = paintConflictos;
paintConflictos = function () {
  _paintConf();
  if (!VIS.length) return;
  const presentes = Object.keys(TIPOS).filter(t => VIS.some(c => c.tipo === t));
  if (dr.cfFiltro && !presentes.includes(dr.cfFiltro)) dr.cfFiltro = null;
  const grupos = $('drBody').querySelectorAll('.cf-group');
  grupos.forEach((g, i) => {
    const t = presentes[i], gt = g.querySelector('.cf-gt');
    gt.classList.add(TIPOS[t].sev); gt.insertAdjacentHTML('afterbegin', `<i class="ti ti-${CF_TIPO[t][1]}"></i>`);
    g.style.display = !dr.cfFiltro || dr.cfFiltro === t ? '' : 'none';
  });
  const chip = (t, lab, n, sev, ic) => `<button class="cf-chip ${sev || ''} ${(dr.cfFiltro || null) === t ? 'on' : ''}" data-t="${t || ''}">${ic ? `<i class="ti ti-${ic}"></i>` : ''}${lab} (${n})</button>`;
  const html = `<div class="cf-chips">${chip(null, 'Todos', VIS.length)}${presentes.map(t => chip(t, CF_TIPO[t][0], VIS.filter(c => c.tipo === t).length, TIPOS[t].sev, CF_TIPO[t][1])).join('')}</div>`;
  const banner = $('drBody').querySelector('.cf-banner');
  banner.insertAdjacentHTML('afterend', html);
  $('drBody').querySelectorAll('.cf-chip').forEach(b => b.onclick = () => { dr.cfFiltro = b.dataset.t || null; paintConflictos(); });
};

/* ---------- Plantillas de turnos ---------- */
const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const guardarPlantillas = () => Store.set('plantillas', PLANTILLAS);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const statsPl = pat => { const t = pat.filter(k => k !== 'D' && TURNOS[k]); return { dias: pat.length, turnos: t.length, desc: pat.filter(k => k === 'D').length, horas: t.reduce((a, k) => a + TURNOS[k].horas, 0) }; };
const resumenPl = pat => { const x = statsPl(pat); return `${plural(x.turnos, 'turno', 'turnos')}, ${plural(x.desc, 'descanso', 'descansos')}`; };
const fmtTot = h => h ? fmtH(h) : '0m';

// Turnos que vienen de una plantilla: se muestran con el ícono de plantilla en la grilla
const PLANT = new Set();
const _tocarPl = tocar;
tocar = function (c, d) { _tocarPl(c, d); const pre = `${c.id}|${SEM}|${d}|`; [...PLANT].forEach(x => { if (x.startsWith(pre)) PLANT.delete(x); }); };
const _cardPl = shiftCard;
shiftCard = function (c, d, k) {
  const html = _cardPl(c, d, k);
  return PLANT.has(`${c.id}|${SEM}|${d}|${k}`) ? html.replace(/^(<div[^>]*>)/, '$1<i class="ti ti-template pl-ic"></i>') : html;
};

// Listado en el Repositorio (pestaña Plantillas de turnos)
let rpMenuTipo = 't';
function tablaPlantillas(q) {
  const ps = PLANTILLAS.filter(p => p.nombre.toLowerCase().includes(q));
  if (!ps.length) return `<div class="hint" style="padding:20px">${q ? 'No hay plantillas con ese nombre.' : 'Todavía no hay plantillas creadas.'}</div>`;
  return `<table class="pl-tab"><thead><tr><th>Nombre</th><th>Descripción</th><th>Días</th><th></th></tr></thead><tbody>${ps.map(p => { const x = statsPl(p.patron);
    return `<tr><td><div>${esc(p.nombre)}</div><div class="s">${fmtTot(x.horas)} totales</div></td><td>${esc(p.desc || '')}</td><td><b>${x.dias}</b> (${resumenPl(p.patron)})</td><td class="kk"><button class="k" data-p="${p.id}" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button></td></tr>`; }).join('')}</tbody></table>`;
}
const _pintarRepo = pintarRepo;
pintarRepo = function () {
  _pintarRepo();
  $('rpList').classList.toggle('tabla', rpTab === 'p');
  if (rpTab !== 'p') return;
  $('rpTit').textContent = 'Tus plantillas'; $('rpNew').disabled = false; $('rpNew').title = '';
  $('rpList').innerHTML = tablaPlantillas($('rpQ').value.trim().toLowerCase());
};
$('rpQ').oninput = () => pintarRepo();
document.querySelector('.rp-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { rpTab = b.dataset.tab; $('rpQ').value = ''; pintarRepo(); } };
$('rpNew').onclick = () => rpTab === 'p' ? abrirEditorPl(null) : abrirTurnoRepo(null);
$('rpList').onclick = e => {
  const b = e.target.closest('.k'); if (!b) return;
  e.stopPropagation();
  const id = b.dataset.k || b.dataset.p;
  if (rpMenuK === id) return cerrarRpMenu();
  rpMenuK = id; rpMenuTipo = b.dataset.p ? 'p' : 't';
  const m = $('rpMenu'), que = rpMenuTipo === 'p' ? 'plantilla' : 'turno';
  m.querySelector('[data-a=edit]').innerHTML = `<i class="ti ti-pencil"></i>Editar ${que}`;
  m.querySelector('[data-a=del]').innerHTML = `<i class="ti ti-trash"></i>Eliminar ${que}`;
  const r = b.getBoundingClientRect();
  m.classList.add('open'); m.style.top = (r.bottom + 4) + 'px'; m.style.left = (r.right - m.offsetWidth) + 'px';
};
$('rpMenu').onclick = e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  e.stopPropagation(); const id = rpMenuK, tipo = rpMenuTipo; cerrarRpMenu();
  if (tipo === 'p') {
    if (b.dataset.a === 'edit') return abrirEditorPl(id);
    return modal('¿Quieres eliminar esta plantilla?', 'Si la eliminas, no vas a poder recuperarla. Los turnos ya asignados no se van a ver afectados.', 'Eliminar plantilla', () => {
      const i = PLANTILLAS.findIndex(p => p.id === id); if (i >= 0) PLANTILLAS.splice(i, 1);
      guardarPlantillas(); pintarRepo(); toast('La plantilla se eliminó correctamente');
    }, true);
  }
  if (b.dataset.a === 'edit') return abrirTurnoRepo(id);
  modal('¿Quieres eliminar este turno?', 'Si lo eliminas, no vas a poder recuperarlo. Los turnos ya asignados no se van a ver afectados.', 'Eliminar turno', () => {
    TURNOS[id].eliminado = true; guardarTurnos(); pintarRepo(); toast('El turno se eliminó correctamente');
  }, true);
};

// Editor de plantilla (pantalla completa, como en Humand)
document.body.insertAdjacentHTML('beforeend', `
<div class="pe" id="pe">
  <div class="rp-head"><button id="peBack" aria-label="Volver"><i class="ti ti-arrow-left"></i></button><h1 id="peTit">Crear plantilla de turnos</h1></div>
  <div class="pe-body"><div class="pe-cols">
    <div class="pe-main">
      <div class="pe-card"><label for="peNom">Nombre de la plantilla</label><div class="pe-inp"><input id="peNom" maxlength="60"><button id="peNomX" aria-label="Borrar nombre"><i class="ti ti-x"></i></button></div><div class="cnt" id="peNomC">0/60</div></div>
      <div class="pe-card"><label for="peDesc">Descripción</label><textarea id="peDesc" maxlength="250" placeholder="Describe el ciclo de trabajo o a quién aplica esta plantilla"></textarea><div class="cnt" id="peDescC">0/250</div></div>
      <div class="pe-card"><label>Días de la plantilla</label><div id="peDias"></div>
        <div class="pe-btns"><button class="pe-b" id="peAddD"><i class="ti ti-bed"></i>Agregar día de descanso</button><button class="pe-b" id="peAddT"><i class="ti ti-plus"></i>Agregar turno</button></div></div>
    </div>
    <div class="pe-res" id="peRes"></div>
  </div></div>
  <div class="pe-foot"><button class="btn-primary" id="peOk">Guardar plantilla</button></div>
</div>
<div class="rp-menu" id="peMenu" style="z-index:68"><button data-a="dup"><i class="ti ti-copy"></i>Duplicar día</button><button data-a="del" class="danger"><i class="ti ti-trash"></i>Eliminar día</button></div>`);
let PE = null, peDrag = null, peMenuI = null;
function abrirEditorPl(id, volver) {
  const p = id ? PLANTILLAS.find(x => x.id === id) : null;
  PE = { id, nombre: p ? p.nombre : '', desc: p ? (p.desc || '') : '', patron: p ? [...p.patron] : [], volver: volver || null };
  $('peTit').textContent = id ? 'Editar plantilla de turnos' : 'Crear plantilla de turnos';
  $('peNom').value = PE.nombre; $('peDesc').value = PE.desc;
  $('pe').classList.add('open'); $('pe').querySelector('.pe-body').scrollTop = 0;
  pintarEditor(); $('peNom').focus();
}
function cerrarEditorPl() { $('pe').classList.remove('open'); cerrarPeMenu(); const v = PE && PE.volver; PE = null; return v; }
function pintarEditor() {
  $('peNomC').textContent = `${PE.nombre.length}/60`; $('peDescC').textContent = `${PE.desc.length}/250`;
  $('peNomX').style.visibility = PE.nombre ? 'visible' : 'hidden';
  $('peDias').innerHTML = !PE.patron.length
    ? `<div class="pe-empty"><span class="ic"><i class="ti ti-info-circle"></i></span><b>Aún no hay turnos en la plantilla</b><span>Cuando agregues un turno o un día de descanso los verás aquí.</span></div>`
    : PE.patron.map((k, i) => `<div class="pe-row" draggable="true" data-i="${i}"><div class="pe-dia"><span>Día</span><b>${i + 1}</b></div><i class="ti ti-grip-vertical pe-grip" title="Arrastrá para cambiar el orden"></i>${k === 'D'
      ? `<div class="pe-sh rest"><b>Día de descanso</b><button class="k" data-i="${i}" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button></div>`
      : `<div class="pe-sh" style="--tc:${colorTurno(k)}"><div><b>${esc(TURNOS[k].nombre)}</b><span>${TURNOS[k].inicio} - ${TURNOS[k].fin}</span></div><span class="p">${fmtHM(TURNOS[k].horas)} programadas</span><button class="k" data-i="${i}" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button></div>`}</div>`).join('');
  const x = statsPl(PE.patron);
  $('peRes').innerHTML = `<h3>Resumen</h3><div class="sub">Vista previa del ciclo de trabajo.</div>
    ${PE.patron.length ? `<div class="pe-sq">${PE.patron.map(k => k === 'D' ? '<i class="rest"></i>' : `<i style="--tc:${colorTurno(k)}"></i>`).join('')}</div>` : ''}
    <div class="pe-st">Duración del ciclo<b>${plural(x.dias, 'día', 'días')}</b>Turnos<b>${x.turnos}</b>Días de descanso<b>${x.desc}</b>Horas de trabajo<b style="margin-bottom:0">${fmtTot(x.horas)}</b></div>`;
  $('peOk').disabled = !(PE.nombre.trim() && PE.patron.length);
}
$('peNom').oninput = () => { PE.nombre = $('peNom').value; pintarEditor(); };
$('peDesc').oninput = () => { PE.desc = $('peDesc').value; $('peDescC').textContent = `${PE.desc.length}/250`; };
$('peNomX').onclick = () => { $('peNom').value = ''; PE.nombre = ''; pintarEditor(); $('peNom').focus(); };
$('peBack').onclick = () => { const v = cerrarEditorPl(); if (v) v(null); };
$('peAddD').onclick = () => { PE.patron.push('D'); pintarEditor(); toast('Agregaste un día de descanso'); };
$('peAddT').onclick = () => abrirPeTurno(null);
$('peOk').onclick = () => {
  if ($('peOk').disabled) return;
  const datos = { nombre: PE.nombre.trim(), desc: PE.desc.trim(), patron: [...PE.patron] };
  let id = PE.id;
  if (id) Object.assign(PLANTILLAS.find(p => p.id === id), datos);
  else { id = 'P' + Date.now().toString(36); PLANTILLAS.push({ id, ...datos }); }
  const editada = !!PE.id; guardarPlantillas();
  const v = cerrarEditorPl(); pintarRepo();
  toast(editada ? 'Guardaste los cambios de la plantilla' : 'Creaste una plantilla nueva');
  if (v) v(id);
};
// Menú de cada día y reordenamiento por arrastre
function cerrarPeMenu() { $('peMenu').classList.remove('open'); peMenuI = null; }
$('peDias').onclick = e => {
  const b = e.target.closest('.k'); if (!b) return;
  e.stopPropagation(); const i = +b.dataset.i;
  if (peMenuI === i) return cerrarPeMenu();
  peMenuI = i; const r = b.getBoundingClientRect(), m = $('peMenu');
  m.classList.add('open'); m.style.top = (r.bottom + 4) + 'px'; m.style.left = (r.right - m.offsetWidth) + 'px';
};
$('peMenu').onclick = e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  e.stopPropagation(); const i = peMenuI; cerrarPeMenu();
  if (b.dataset.a === 'dup') PE.patron.splice(i + 1, 0, PE.patron[i]); else PE.patron.splice(i, 1);
  pintarEditor();
};
document.addEventListener('click', cerrarPeMenu);
$('peDias').addEventListener('dragstart', e => { const r = e.target.closest('.pe-row'); if (!r) return; peDrag = +r.dataset.i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'dia'); r.classList.add('drag'); });
$('peDias').addEventListener('dragover', e => { if (peDrag === null) return; e.preventDefault(); const r = e.target.closest('.pe-row'); $('peDias').querySelectorAll('.over').forEach(x => x.classList.remove('over')); if (r) r.classList.add('over'); });
$('peDias').addEventListener('drop', e => { e.preventDefault(); const r = e.target.closest('.pe-row'); if (r && peDrag !== null) { const [x] = PE.patron.splice(peDrag, 1); PE.patron.splice(+r.dataset.i, 0, x); } peDrag = null; pintarEditor(); });
$('peDias').addEventListener('dragend', () => { if (peDrag !== null) { peDrag = null; pintarEditor(); } });

// Panel "Agregar turno" del editor
function abrirPeTurno(sel) { openDrawer('peTurno', 0, 0); dr.sel = sel; dr.q = ''; paintDrawer(); }
function paintPeTurno() {
  $('drTitle').textContent = 'Agregar turno'; $('drBack').style.display = 'none';
  $('drBody').innerHTML = `<div class="box"><label>Turnos</label>
    <label class="field" style="justify-content:flex-start;gap:8px;margin-bottom:4px"><i class="ti ti-search" style="font-size:18px;color:#7a818c"></i><input id="ptQ" class="inp-bare" placeholder="Buscar por nombre"></label>
    <div class="repo scroll" id="ptList">${Object.keys(TURNOS).filter(k => !TURNOS[k].eliminado).map(k => { const t = TURNOS[k];
      return `<button class="opt pe-opt ${dr.sel === k ? 'sel' : ''}" data-k="${k}" data-n="${esc(t.nombre.toLowerCase())}" style="--tc:${colorTurno(k)}"><div><div class="n">${esc(t.nombre)}</div><div class="h">${t.inicio} - ${t.fin}</div></div><div class="d">${fmtHM(t.horas)} programadas</div></button>`; }).join('')}</div>
    <button class="btn-add" id="ptCrear"><i class="ti ti-plus"></i>Crear turno</button></div>`;
  $('drFoot').innerHTML = `<button class="btn-primary" id="ptOk" style="width:100%" ${dr.sel ? '' : 'disabled'}>Agregar turno</button>`;
  $('ptQ').oninput = e => { const q = e.target.value.trim().toLowerCase(); $('ptList').querySelectorAll('.opt').forEach(b => b.style.display = b.dataset.n.includes(q) ? '' : 'none'); };
  $('ptList').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; dr.sel = b.dataset.k; $('ptList').querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o === b)); $('ptOk').disabled = false; };
  $('ptCrear').onclick = () => { const s = dr.sel; closeDrawer(); abrirTurnoRepo(null, nk => abrirPeTurno(nk || s)); };
  $('ptOk').onclick = () => { if (!dr.sel) return; PE.patron.push(dr.sel); closeDrawer(); pintarEditor(); toast('Agregaste un turno'); };
}

// Panel "Asignar plantilla"
function paintAsignarPlantilla() {
  if (!dr.ap) dr.ap = { emps: dr.libre ? [] : [dr.emp], fecha: iso(fechaDe(SEM, dr.dia || 0)), ubic: dr.libre ? '' : COLABORADORES[dr.emp].sede, plId: null, rep: false, fest: false };
  const a = dr.ap, libres = LISTA.length ? LISTA : COLABORADORES;
  $('drTitle').textContent = 'Asignar plantilla'; $('drBack').style.display = dr.libre ? 'none' : 'block';
  $('drBody').innerHTML = `
    <div class="box"><label>Colaboradores</label>
      ${a.emps.length ? `<div class="chips">${a.emps.map(id => `<span class="chip">${COLABORADORES[id].nombre}<button data-quitar="${id}" aria-label="Quitar"><i class="ti ti-x" style="font-size:12px"></i></button></span>`).join('')}</div>` : ''}
      <select class="field" id="apEmp"><option value="">Buscar</option>${libres.filter(c => !a.emps.includes(c.id)).map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select></div>
    <div class="box"><label>Fecha de inicio</label><input type="date" class="field" id="apFecha" value="${a.fecha}"></div>
    <div class="box"><label>Ubicación (Opcional)</label><select class="field" id="apUbi"><option value="">Buscar</option>${SEDES.flatMap(g => g.items).map(x => `<option ${x === a.ubic ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div class="box"><label>Plantilla</label>
      <label class="field" style="justify-content:flex-start;gap:8px;margin-bottom:4px"><i class="ti ti-search" style="font-size:18px;color:#7a818c"></i><input id="apQ" class="inp-bare" placeholder="Buscar"></label>
      <div class="repo scroll" id="apList">${PLANTILLAS.map(p => `<button class="opt ${a.plId === p.id ? 'sel' : ''}" data-p="${p.id}" data-n="${esc(p.nombre.toLowerCase())}"><div><div class="sub">${resumenPl(p.patron)}</div><div class="n" style="font-size:16px">${esc(p.nombre)}</div>${p.desc ? `<div class="sub">${esc(p.desc)}</div>` : ''}</div><div class="d">${fmtTot(statsPl(p.patron).horas)} totales</div></button>`).join('') || '<div class="hint">Todavía no hay plantillas creadas.</div>'}</div>
      <button class="btn-add" id="apCrear"><i class="ti ti-plus"></i>Crear plantilla</button></div>
    <div class="box"><label>Recurrencia</label><label class="check"><input type="checkbox" id="apRep" ${a.rep ? 'checked' : ''}><span>Repetir plantilla<small>La plantilla se vuelve a asignar al terminar el ciclo.</small></span></label></div>
    <div class="box"><label>Días festivos</label><label class="check"><input type="checkbox" id="apFest" ${a.fest ? 'checked' : ''}><span>Incluir días festivos<small>Los turnos se asignan aunque el día sea feriado.</small></span></label></div>`;
  $('drFoot').innerHTML = `<button class="btn-primary" id="apOk" style="width:100%">Asignar plantilla</button>`;
  const leer = () => { a.fecha = $('apFecha').value; a.ubic = $('apUbi').value; a.rep = $('apRep').checked; a.fest = $('apFest').checked; };
  const validar = () => { leer(); $('apOk').disabled = !(a.emps.length && a.fecha && a.plId && PLANTILLAS.some(p => p.id === a.plId)); };
  $('drBody').onchange = validar; $('drBody').oninput = e => { if (e.target.id !== 'apQ') validar(); };
  $('apQ').oninput = e => { const q = e.target.value.trim().toLowerCase(); $('apList').querySelectorAll('.opt').forEach(b => b.style.display = b.dataset.n.includes(q) ? '' : 'none'); };
  $('apList').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; a.plId = b.dataset.p; $('apList').querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o === b)); validar(); };
  $('apEmp').onchange = () => { leer(); if ($('apEmp').value !== '') a.emps.push(+$('apEmp').value); paintAsignarPlantilla(); };
  $('drBody').querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { leer(); a.emps = a.emps.filter(id => id !== +b.dataset.quitar); paintAsignarPlantilla(); });
  $('apCrear').onclick = () => {
    leer(); const estado = { emp: dr.emp, dia: dr.dia, libre: dr.libre, ap: a };
    closeDrawer();
    abrirEditorPl(null, id => { openDrawer('plantilla', estado.emp, estado.dia, estado.libre); dr.ap = estado.ap; if (id) dr.ap.plId = id; paintDrawer(); });
  };
  $('apOk').onclick = () => { validar(); if (!$('apOk').disabled) aplicarPlantilla(a); };
  validar();
}
function aplicarPlantilla(a) {
  const p = PLANTILLAS.find(x => x.id === a.plId), n = p.patron.length, ini = deIso(a.fecha);
  const total = a.rep ? Math.max(n, Math.ceil(7 * SEMANAS_INDEFINIDO / n) * n) : n;
  let enSemana = false;
  a.emps.forEach(id => {
    const c = COLABORADORES[id];
    for (let i = 0; i < total; i++) {
      const { off, d } = ubicar(new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i)), k = p.patron[i % n];
      if (!a.fest && off === SEM && FESTIVOS.includes(d)) continue;
      if (off === SEM) { tocar(c, d); c.semana[d] = [k]; enSemana = true; }
      else { const s = c.semanas[off] || (c.semanas[off] = vacia()); s[d] = [k]; }
      PLANT.add(`${id}|${off}|${d}|${k}`);
    }
  });
  if (MODO === 'semana' && !enSemana) irASemana(ubicar(ini).off);
  closeDrawer(); if (CELLS.size) salirSeleccion();
  avisoAsignacion(COLABORADORES[a.emps[0]], 'La asignación se realizó correctamente');
}
const _paintPl = paintDrawer;
paintDrawer = function () {
  if (dr && dr.vista === 'plantilla') { $('drFoot').className = 'dr-foot'; return paintAsignarPlantilla(); }
  if (dr && dr.vista === 'peTurno') { $('drFoot').className = 'dr-foot'; return paintPeTurno(); }
  _paintPl();
};

/* ---------- Editar un turno no cambia los ya asignados ----------
   Antes de aplicar los cambios, las asignaciones existentes pasan a una copia oculta del turno con los datos anteriores. */
function congelarAsignados(k) {
  const usado = COLABORADORES.some(c => c.semana.some(d => d.includes(k)) || Object.values(c.semanas).some(sem => sem.some(d => d.includes(k))));
  if (!usado) return;
  let n = 1; while (TURNOS[`${k}~${n}`]) n++;
  const vieja = `${k}~${n}`;
  TURNOS[vieja] = { ...TURNOS[k], eliminado: true };
  const cambiar = sem => sem.forEach((d, i) => { sem[i] = d.map(x => x === k ? vieja : x); });
  COLABORADORES.forEach(c => { cambiar(c.semana); Object.entries(c.semanas).forEach(([off, sem]) => { if (+off !== SEM) cambiar(sem); }); });
  const renombrar = obj => Object.keys(obj).forEach(key => { if (key.endsWith(`-${k}`)) { obj[key.slice(0, -k.length) + vieja] = obj[key]; delete obj[key]; } });
  renombrar(AUTO); Object.values(AUTOS).forEach(renombrar);
  [...PLANT].forEach(x => { if (x.endsWith(`|${k}`)) { PLANT.delete(x); PLANT.add(x.slice(0, -k.length) + vieja); } });
}
// El botón secundario del modal vuelve a "Cancelar" en cada apertura
const _modalBase = modal;
modal = function (...args) { $('mCancel').textContent = 'Cancelar'; $('mCancel').onclick = () => $('modalBg').classList.remove('open'); return _modalBase(...args); };

/* ---------- Tooltips de horas en la tarjeta del colaborador ---------- */
document.body.insertAdjacentHTML('beforeend', '<div class="htip" id="htip"></div>');
$('grid').addEventListener('mouseover', e => {
  const u = e.target.closest('.hrs'); if (!u) return;
  const c = COLABORADORES[+u.dataset.e], t = $('htip');
  t.innerHTML = u.dataset.t === 'p'
    ? `<div class="hh"><span>Horas planificadas</span><b>${fmtH(horasAsignadas(c))}</b></div>${(() => { const dif = porPlanificar(c) - horasAsignadas(c);
        return dif > 0 && c.semana.some(d => d.length) ? `<div class="hr"><div style="color:#9a5b00"><span>Faltan para completar las horas por planificar</span><span>${fmtH(dif)}</span></div></div>`
          : dif < 0 ? `<div class="hr"><div style="color:#c62828"><span>Exceden las horas por planificar</span><span>${fmtH(-dif)}</span></div></div>` : ''; })()}`
    : `<div class="hh"><span>Horas por planificar</span><b>${fmtH(porPlanificar(c))}</b></div><div class="hr"><div><span>Horas de contrato</span><span>${c.capacidad}h</span></div><div><span>Ausencias aprobadas</span><span>${fmtH(ausenciasH(c))}</span></div><div><span>Festivos</span><span>${fmtH(festivosH())}</span></div></div>`;
  const r = u.getBoundingClientRect();
  t.classList.add('open'); t.style.left = Math.max(8, r.left - 40) + 'px'; t.style.top = (r.bottom + 8) + 'px';
});
$('grid').addEventListener('mouseout', e => { if (e.target.closest('.hrs')) $('htip').classList.remove('open'); });

/* ---------- Asignar a las celdas seleccionadas (filas, columnas o celdas sueltas) ---------- */
const celdasSel = () => [...CELLS].map(x => { const [e, d] = x.split('-').map(Number); return { c: COLABORADORES[e], d }; });
function asignarACeldas(v) {
  const cs = celdasSel();
  if (v === 'descanso') {
    cs.forEach(({ c, d }) => agregar(c, d, 'D'));
    const n = cs.length; salirSeleccion();
    return toast(`Asignaste el día de descanso a ${n} celda${n === 1 ? '' : 's'}`);
  }
  if (v === 'plantilla') {
    const emps = [...new Set(cs.map(x => x.c.id))], d0 = Math.min(...cs.map(x => x.d));
    openDrawer('plantilla', emps[0], d0, true);
    dr.ap = { emps, fecha: iso(fechaDe(SEM, d0)), ubic: '', plId: null, rep: false, fest: false };
    return paintDrawer();
  }
  abrirTurnoCeldas(null);
}
function abrirTurnoCeldas(selK) { openDrawer('turnoCeldas', 0, 0, true); dr.sel = selK; paintDrawer(); }
function paintTurnoCeldas() {
  const n = CELLS.size;
  $('drTitle').textContent = 'Asignar turno'; $('drBack').style.display = 'none';
  $('drBody').innerHTML = `<div class="sel-banner"><i class="ti ti-select-all"></i><span>El turno se asignará a las <b>${n} celda${n === 1 ? '' : 's'}</b> seleccionada${n === 1 ? '' : 's'}.</span></div>
    <button class="from-zero on" id="tcZero"><span class="pl"><i class="ti ti-plus"></i></span><span style="flex:1"><b>Armar un turno desde cero</b><br><small>Ingresa manualmente los datos del turno.</small></span><i class="ti ti-chevron-right"></i></button>
    <div class="box"><label>Repositorio de turnos</label><div class="hint">Selecciona un turno del repositorio para asignarlo.</div>
    <label class="field" style="justify-content:flex-start;gap:8px;margin-bottom:4px"><i class="ti ti-search" style="font-size:18px;color:#7a818c"></i><input id="tcQ" class="inp-bare" placeholder="Buscar"></label>
    <div class="repo scroll" id="tcList">${Object.keys(TURNOS).filter(k => !TURNOS[k].eliminado).map(k => { const t = TURNOS[k];
      return `<button class="opt pe-opt ${dr.sel === k ? 'sel' : ''}" data-k="${k}" data-n="${esc(t.nombre.toLowerCase())}" style="--tc:${colorTurno(k)}"><div><div class="n">${esc(t.nombre)}</div><div class="h">${t.inicio} - ${t.fin}</div></div><div class="d">${fmtHM(t.horas)} programadas</div></button>`; }).join('')}</div></div>`;
  $('drFoot').innerHTML = `<button class="btn-primary" id="tcOk" style="width:100%" ${dr.sel ? '' : 'disabled'}>Asignar turno</button>`;
  $('tcQ').oninput = e => { const q = e.target.value.trim().toLowerCase(); $('tcList').querySelectorAll('.opt').forEach(b => b.style.display = b.dataset.n.includes(q) ? '' : 'none'); };
  $('tcList').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; dr.sel = b.dataset.k; $('tcList').querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o === b)); $('tcOk').disabled = false; };
  $('tcZero').onclick = () => { closeDrawer(); abrirTurnoRepo(null, nk => abrirTurnoCeldas(nk)); };
  $('tcOk').onclick = () => {
    if (!dr.sel) return;
    const k = dr.sel, cs = celdasSel(); let n = 0;
    cs.forEach(({ c, d }) => { if (agregar(c, d, k)) n++; });
    const primero = cs[0].c; closeDrawer(); salirSeleccion();
    avisoAsignacion(primero, `Asignaste el turno a ${n} celda${n === 1 ? '' : 's'}`);
  };
}
const _paintCeldas = paintDrawer;
paintDrawer = function () { if (dr && dr.vista === 'turnoCeldas') { $('drFoot').className = 'dr-foot'; return paintTurnoCeldas(); } _paintCeldas(); };

/* ---------- Coachmark: colaborador sin rol laboral ---------- */
let coachRolEmp = null;
function mostrarCoachRol(id, texto) {
  const chip = document.querySelector(`.emp-sinrol[data-e="${id}"]`); if (!chip) return;
  coachRolEmp = id; const c = COLABORADORES[id];
  $('coachRolTxt').textContent = texto || `${c.nombre} no tiene un rol laboral asignado, así que la cobertura y Programar no lo tienen en cuenta. Asignale un puesto desde Admin > Usuarios > Trabajo.`;
  document.querySelectorAll('.emp-sinrol.spot').forEach(x => x.classList.remove('spot'));
  chip.classList.add('spot'); $('coachRol').classList.add('open'); ubicarCoachRol();
}
function ubicarCoachRol() {
  if (!$('coachRol').classList.contains('open')) return;
  const chip = document.querySelector(`.emp-sinrol[data-e="${coachRolEmp}"]`);
  if (!chip) return cerrarCoachRol();
  const b = chip.getBoundingClientRect(); $('coachRol').style.left = (b.left - 14) + 'px'; $('coachRol').style.top = (b.bottom + 12) + 'px';
}
function cerrarCoachRol() { $('coachRol').classList.remove('open'); document.querySelectorAll('.emp-sinrol.spot').forEach(x => x.classList.remove('spot')); coachRolEmp = null; }
window.addEventListener('scroll', ubicarCoachRol, { passive: true }); window.addEventListener('resize', ubicarCoachRol);
document.querySelector('.grid-scroll').addEventListener('scroll', ubicarCoachRol, { passive: true });
$('coachRol').addEventListener('click', e => e.stopPropagation());
$('coachRolNo').onclick = cerrarCoachRol;
$('coachRolIr').onclick = () => { location.href = `admin.html#usuario/${coachRolEmp}/trabajo`; };
$('grid').addEventListener('click', e => { const ch = e.target.closest('.emp-sinrol'); if (!ch) return; e.stopPropagation(); mostrarCoachRol(+ch.dataset.e); }, true);
const _renderRol = render;
render = function () { _renderRol(); if (coachRolEmp !== null) requestAnimationFrame(ubicarCoachRol); };
// Al abrir la app se avisa una vez por sesión si alguien visible no tiene rol
function avisoSinRol() {
  const ch = document.querySelector('.emp-sinrol'); if (!ch) return;
  let visto = false; try { visto = sessionStorage.getItem('luna:avisoRol') === '1'; sessionStorage.setItem('luna:avisoRol', '1'); } catch (e) {}
  if (!visto) { ch.scrollIntoView({ block: 'center' }); mostrarCoachRol(+ch.dataset.e); }
}

/* ---------- Cobertura: rango de la semana, vista mensual y validaciones de Programar ---------- */
const rangoLargo = () => { const a = fechaDe(SEM, 0), b = fechaDe(SEM, 6); return `Entre el lunes ${a.getDate()} de ${MESES[a.getMonth()]} y el domingo ${b.getDate()} de ${MESES[b.getMonth()]}`; };
function textoOrigen() {
  const o = semanaOrigen(sedeSel); if (o === null || o === SEM) return '';
  return `<span style="font-weight:400">Se mantiene desde la semana del ${dma(fechaDe(o, 0)).slice(0, 5)}</span>`;
}
// Vista mensual simplificada: por día, personas cubiertas sobre requeridas. Clic en un día: abre esa semana con la cobertura desplegada.
function coberturaMes(dias) {
  let html = `<div class="cov-h first" id="covMes"><i class="ti ti-users-group"></i>Cobertura</div>`;
  dias.forEach(f => {
    const { off, d } = ubicar(f);
    const cob = sedeSel ? coberturaDe(sedeSel, off) : [];
    const req = cob.reduce((a, g) => a + g.roles.reduce((b, r) => b + r.cant, 0), 0);
    if (!sedeSel || !req) { html += `<div class="cov-h" data-off="${off}" data-d="${d}" title="${sedeSel ? 'Sin cobertura requerida' : 'Seleccioná una sede'}">–</div>`; return; }
    const pool = COLABORADORES.filter(c => c.sede === sedeSel);
    const ok = cob.reduce((a, g) => a + g.roles.reduce((b, r) => b + Math.min(pool.filter(c => c.rol === r.rol && semanaDe(c, off)[d].includes(g.turno)).length, r.cant), 0), 0);
    html += `<div class="cov-h ${ok === req ? 'ok' : 'falta'}" data-off="${off}" data-d="${d}" title="Vista ${vistaDe(sedeSel, coberturaConfig(), off).nombre}: ${ok} de ${req} personas">${ok}/${req}</div>`;
  });
  return html;
}
$('grid').addEventListener('click', e => {
  if (MODO !== 'mes') return;
  if (e.target.closest('#covMes')) { e.stopPropagation(); if (!sedeSel) { window.scrollTo({ top: 0, behavior: 'smooth' }); showCoach(); } return; }
  const h = e.target.closest('.cov-h[data-off]'); if (!h) return;
  e.stopPropagation();
  if (!sedeSel) { window.scrollTo({ top: 0, behavior: 'smooth' }); return showCoach(); }
  irASemana(+h.dataset.off); MODO = 'semana'; covOpen = true; render();
  const t = $('covToggle'); if (t) t.scrollIntoView({ block: 'center' });
}, true);

// Validación 2: colaboradores sin rol laboral
function avisarSinRol(lista) {
  const ch = document.querySelector(`.emp-sinrol[data-e="${lista[0].id}"]`); if (ch) ch.scrollIntoView({ block: 'center' });
  const n = lista.length;
  mostrarCoachRol(lista[0].id, `Antes de programar, asigná un rol laboral a ${n === 1 ? lista[0].nombre : `${n} colaboradores de ${sedeSel}`}. Sin rol, el motor no sabe qué turnos puede cubrir. Configuralo en Admin > Usuarios > Trabajo.`);
}
// Validación 3: falta asignar una vista de cobertura
function avisarSinCobertura() {
  covOpen = true; render();
  const t = $('covToggle'); if (t) t.scrollIntoView({ block: 'center' });
  $('coachCobTxt').textContent = `Para programar la semana del ${rangoCorto()}, elegí la vista de cobertura que necesita ${sedeSel}.`;
  $('coachCob').classList.add('open'); ubicarCoachCob();
}
function ubicarCoachCob() {
  if (!$('coachCob').classList.contains('open')) return;
  const b = $('covAdd'); if (!b) return ocultarCoachCob();
  b.classList.add('spot'); const r = b.getBoundingClientRect();
  $('coachCob').style.left = (r.left - 14) + 'px'; $('coachCob').style.top = (r.bottom + 12) + 'px';
}
function ocultarCoachCob() { $('coachCob').classList.remove('open'); const b = $('covAdd'); if (b) b.classList.remove('spot'); }
window.addEventListener('scroll', ubicarCoachCob, { passive: true }); window.addEventListener('resize', ubicarCoachCob);
$('coachCob').addEventListener('click', e => e.stopPropagation());
$('coachCobNo').onclick = ocultarCoachCob;
$('coachCobIr').onclick = () => { ocultarCoachCob(); abrirVistas(); };
const _renderCob = render;
render = function () { _renderCob(); if ($('coachCob').classList.contains('open')) requestAnimationFrame(ubicarCoachCob); };

pintarFechas(); render(); setTimeout(avisoSinRol, 300);
