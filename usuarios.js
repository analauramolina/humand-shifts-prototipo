/* Admin > Usuarios: listado, perfil (Información general y Trabajo) e historial de puestos.
   El puesto actual de cada persona define su rol laboral y su sede en Turnos laborales. */

const fmtFecha = s => s ? s.split('-').reverse().join('/') : '-';
const escU = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const noDisponible = () => toast('Esta acción no forma parte del prototipo');
const guardarPuestos = () => Store.set(CLAVE_PUESTOS, HISTORIAL_LABORAL);

/* ---------- Estructura de la sección ---------- */
document.getElementById('mainHorarios').insertAdjacentHTML('afterend', `
<main class="main" id="mainUsr" style="display:none">
  <div class="u-head">
    <div><h1 style="margin:4px 0 6px">Usuarios</h1><p class="u-sub">Acceda al listado total, agregue y elimine usuarios, y modifique permisos.</p></div>
    <div class="u-acts"><button class="u-primary" id="uNuevo"><i class="ti ti-user-plus"></i>Nuevo usuario <i class="ti ti-chevron-down"></i></button><button class="u-kebab" id="uMas" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button></div>
  </div>
  <div class="u-card">
    <div class="u-filtros"><span>Filtrar por:</span><div class="spacer"></div>
      <button class="btn-out" id="uEstado">Estado <i class="ti ti-chevron-down"></i></button>
      <button class="btn-out" id="uFiltros"><i class="ti ti-filter"></i>Más filtros</button>
      <button class="u-primary sq" id="uDesc" aria-label="Descargar"><i class="ti ti-download"></i></button></div>
    <label class="search" style="margin:16px 0 22px"><i class="ti ti-search"></i><input id="uQ" placeholder="Buscar" autocomplete="off"></label>
    <p class="u-total" id="uTotal"></p>
    <div class="u-tabla"><table><thead><tr><th>Nombre</th><th class="ord">Fecha de creación <i class="ti ti-arrow-up"></i></th><th>Fecha de contratación</th><th>Estado <i class="ti ti-info-circle"></i></th><th></th></tr></thead><tbody id="uBody"></tbody></table></div>
    <div class="u-fin"><span></span><span>Fin del listado</span><span id="uCuenta"></span></div>
  </div>
</main>`);
document.body.insertAdjacentHTML('beforeend', `
<div class="u-menu" id="uMenu">
  <button data-a="ver"><span class="mi"><i class="ti ti-user"></i></span>Ver perfil</button>
  <button data-a="x"><span class="mi"><i class="ti ti-lock"></i></span>Restablecer contraseña</button>
  <button data-a="x"><span class="mi"><i class="ti ti-user-cog"></i></span>Desactivar usuario</button>
  <button data-a="x"><span class="mi"><i class="ti ti-x"></i></span>Eliminar usuario</button>
</div>
<div class="perfil" id="perfil">
  <div class="p-top"><button class="p-back" id="pBack" aria-label="Volver"><i class="ti ti-arrow-left"></i></button><h2 id="pNombre"></h2><span class="u-pill">Activado</span><div class="spacer"></div><button class="btn-out" id="pAcc">Acciones sobre el usuario <i class="ti ti-chevron-down"></i></button></div>
  <div class="p-body"><nav class="p-nav" id="pNav"></nav><div class="p-main" id="pMain"></div></div>
</div>
<div class="u-pu-menu u-menu" id="puMenu"><button data-a="edit"><span class="mi"><i class="ti ti-pencil"></i></span>Editar puesto</button><button data-a="del"><span class="mi"><i class="ti ti-trash"></i></span>Eliminar puesto</button></div>
<div class="u-ov" id="uOv"></div>
<aside class="u-sheet" id="uSheet"><div class="u-sh-head"><h3 id="shTit"></h3><button id="shX" aria-label="Cerrar"><i class="ti ti-x"></i></button></div><div class="u-sh-body" id="shBody"></div><div class="u-sh-foot" id="shFoot"></div></aside>
<div class="u-modal-bg" id="uModal"><div class="u-modal"><div class="u-mh"><b id="umTit"></b><button id="umX" aria-label="Cerrar"><i class="ti ti-x"></i></button></div><p id="umTxt"></p><div class="u-mf"><button class="u-link" id="umNo">Cancelar</button><button class="u-danger" id="umOk"></button></div></div></div>`);

/* ---------- Navegación entre secciones del Admin ---------- */
function mostrarSeccion(sec) {
  $('mainHorarios').style.display = sec === 'horarios' ? '' : 'none';
  $('mainUsr').style.display = sec === 'usuarios' ? '' : 'none';
  document.querySelectorAll('#sidebar .nav-item').forEach(n => n.classList.toggle('active', n.querySelector('.label').textContent === (sec === 'usuarios' ? 'Usuarios' : 'Horarios y turnos')));
  document.title = sec === 'usuarios' ? 'Usuarios' : 'Horarios y turnos';
  if (sec === 'usuarios') pintarUsuarios();
}
document.querySelectorAll('#sidebar .nav-item').forEach(n => {
  const l = n.querySelector('.label').textContent;
  if (l === 'Usuarios' || l === 'Horarios y turnos') { n.style.cursor = 'pointer'; n.onclick = () => { location.hash = l === 'Usuarios' ? 'usuarios' : ''; ruta(); }; }
});
function ruta() {
  const h = location.hash.slice(1);
  const m = h.match(/^usuario\/(\d+)(?:\/(\w+))?$/);
  if (m && COLABORADORES[+m[1]]) { mostrarSeccion('usuarios'); return abrirPerfil(+m[1], m[2] || 'general'); }
  cerrarPerfil(true);
  mostrarSeccion(h === 'usuarios' ? 'usuarios' : 'horarios');
}
window.addEventListener('hashchange', ruta);

/* ---------- Listado ---------- */
const PERSONAS = () => [...COLABORADORES].sort((a, b) => PERFILES[a.nombre].creacion.localeCompare(PERFILES[b.nombre].creacion) || a.nombre.localeCompare(b.nombre, 'es'));
function pintarUsuarios() {
  const q = $('uQ').value.trim().toLowerCase();
  const lista = PERSONAS().filter(c => !q || c.nombre.toLowerCase().includes(q) || PERFILES[c.nombre].email.includes(q));
  $('uTotal').innerHTML = `Cantidad total: <b>${lista.length} usuario${lista.length === 1 ? '' : 's'}</b>`;
  $('uCuenta').textContent = `${lista.length} de ${lista.length}`;
  $('uBody').innerHTML = lista.map(c => { const p = PERFILES[c.nombre];
    return `<tr data-id="${c.id}"><td><div class="u-nom"><span class="u-av"><i class="ti ti-user"></i></span><div><b>${escU(c.nombre)}</b><span>${p.email}</span><span>${p.email}</span></div></div></td>
      <td>${fmtFecha(p.creacion)}</td><td>${fmtFecha(p.contratacion)}</td><td><span class="u-pill">Activo</span><div class="u-fe">${fmtFecha(p.creacion)}</div></td>
      <td class="u-k"><button class="u-kebab sm" data-id="${c.id}" aria-label="Acciones"><i class="ti ti-dots-vertical"></i></button></td></tr>`; }).join('')
    || '<tr><td colspan="5" class="u-vacio">No hay usuarios que coincidan con la búsqueda.</td></tr>';
}
$('uQ').oninput = pintarUsuarios;
['uNuevo', 'uMas', 'uEstado', 'uFiltros', 'uDesc', 'pAcc'].forEach(id => $(id).onclick = noDisponible);
let uMenuId = null;
$('uBody').onclick = e => {
  const k = e.target.closest('.u-kebab');
  if (!k) { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `usuario/${tr.dataset.id}`; return; }
  e.stopPropagation();
  const m = $('uMenu'); if (m.classList.contains('open') && uMenuId === k.dataset.id) return cerrarUMenus();
  cerrarUMenus(); uMenuId = k.dataset.id;
  const r = k.getBoundingClientRect(); m.classList.add('open');
  m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + 'px'; m.style.left = (r.right - m.offsetWidth) + 'px';
};
$('uMenu').onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; e.stopPropagation(); const id = uMenuId; cerrarUMenus(); if (b.dataset.a === 'ver') location.hash = `usuario/${id}`; else noDisponible(); };
function cerrarUMenus() { document.querySelectorAll('.u-menu.open').forEach(m => m.classList.remove('open')); uMenuId = null; }
document.addEventListener('click', cerrarUMenus);

/* ---------- Perfil ---------- */
const P_NAV = [
  ['general', 'ti-file-text', 'Información general'], ['trabajo', 'ti-briefcase', 'Trabajo', [['historial', 'Historial laboral'], ['salario', 'Salario'], ['acceso', 'Métodos de acceso']]],
  ['seg', 'ti-circles', 'Segmentación'], ['roles', 'ti-user-cog', 'Roles y Permisos'], ['onb', 'ti-door', 'Onboarding'],
  ['forms', 'ti-file-text', 'Formularios y Trámites'], ['docs', 'ti-file-text', 'Documentos'], ['vac', 'ti-beach', 'Vacaciones y permisos'],
];
let PID = null, PSEC = 'general';
function abrirPerfil(id, sec) {
  PID = id; PSEC = sec; const c = COLABORADORES[id];
  $('pNombre').textContent = c.nombre;
  $('perfil').classList.add('open'); document.body.style.overflow = 'hidden';
  pintarNav(); pintarPerfil();
}
function cerrarPerfil(silencioso) { $('perfil').classList.remove('open'); document.body.style.overflow = ''; PID = null; cerrarSheet(); if (!silencioso) location.hash = 'usuarios'; }
$('pBack').onclick = () => cerrarPerfil();
function pintarNav() {
  const enTrabajo = ['trabajo', 'historial', 'salario', 'acceso'].includes(PSEC);
  $('pNav').innerHTML = P_NAV.map(([k, ic, l, subs]) => subs
    ? `<div class="pn-grupo ${enTrabajo ? 'on' : ''}"><button class="pn-item" data-s="${k}"><i class="ti ${ic}"></i><span>${l}</span><i class="ti ti-chevron-down"></i></button>${subs.map(([sk, sl]) => `<button class="pn-sub" data-s="${sk}">${sl}</button>`).join('')}</div>`
    : `<button class="pn-item ${PSEC === k ? 'on' : ''}" data-s="${k}"><i class="ti ${ic}"></i><span>${l}</span></button>`).join('');
}
$('pNav').onclick = e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  const s = b.dataset.s;
  if (['historial', 'salario'].includes(s)) { if (PSEC !== 'trabajo') { location.hash = `usuario/${PID}/trabajo`; } setTimeout(() => { const t = $('pc-' + s); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); return; }
  location.hash = `usuario/${PID}/${s === 'acceso' ? 'acceso' : s}`;
};
const campo = (l, v, link) => `<div class="p-f"><span>${l}</span>${link && v !== '-' ? `<a>${escU(v)}</a>` : `<b>${escU(v)}</b>`}</div>`;
function pintarPerfil() {
  const c = COLABORADORES[PID], p = PERFILES[c.nombre], act = puestoActual(c.nombre);
  if (PSEC === 'general') {
    $('pMain').innerHTML = `<div class="p-col"><h2 class="p-h">Información del perfil</h2>
      <div class="p-card p-hero"><div class="p-banner"></div><div class="p-who"><span class="p-avatar">${iniciales(c.nombre)}<span class="p-cam"><i class="ti ti-camera"></i></span></span>
        <div><div class="p-name">${escU(c.nombre)}</div><div class="p-pos">${act ? `${escU(act.puesto)} | ${escU(act.depto)}` : 'Sin puesto asignado'} · Sede ${escU(c.sede)}</div></div><span class="u-pill" style="margin-left:auto;align-self:flex-start">Activado</span></div></div>
      <div class="p-card"><div class="p-ct"><b>Información básica</b><button class="p-edit" data-x aria-label="Editar"><i class="ti ti-pencil"></i></button></div>
        <div class="p-grid">${campo('Nombre *', p.nombre)}${campo('Apellido *', p.apellido)}${campo('Apodo', '-')}</div>
        <div class="p-grid">${campo('Fecha de nacimiento', '-')}${campo('Email', p.email, true)}${campo('Celular', '-')}</div>
        <div class="p-grid">${campo('Usuario *', p.email, true)}${campo('Fecha de contratación', fmtFecha(p.contratacion))}${campo('CUIL', '-')}</div></div>
      <div class="p-card"><div class="p-ct"><b>Redes sociales</b><button class="p-edit" data-x aria-label="Editar"><i class="ti ti-pencil"></i></button></div>
        <div class="p-grid">${campo('LinkedIn', '-')}${campo('Instagram', '-')}${campo('X', '-')}</div><div class="p-grid">${campo('Facebook', '-')}</div></div></div>`;
  } else if (PSEC === 'trabajo') {
    const hist = [...(HISTORIAL_LABORAL[c.nombre] || [])].map((x, i) => ({ ...x, i })).sort((a, b) => (a.fin ? 1 : 0) - (b.fin ? 1 : 0) || b.inicio.localeCompare(a.inicio));
    $('pMain').innerHTML = `<div class="p-col ancho"><h2 class="p-h" style="font-size:30px">Trabajo</h2>
      <div class="p-card" id="pc-historial"><div class="p-ct"><b>Historial laboral</b></div>
        <div class="p-gris"><div class="p-f"><span>Jefe directo</span><b>${act && act.jefe ? escU(act.jefe) : '-'}</b></div><div class="p-f"><span>Aprobador designado</span><b>${act && act.aprob ? escU(act.aprob) : '-'}</b></div><div class="p-f"><span>Departamento</span><b>${act ? escU(act.depto) : '-'}</b></div>
          <button class="p-edit round" id="pEditAct" aria-label="Editar puesto actual" ${act ? '' : 'disabled'}><i class="ti ti-pencil"></i></button></div>
        <div class="p-ct" style="margin-top:26px"><b>Puestos dentro de la organización</b><button class="btn-out" id="pAddPuesto">Agregar puesto <i class="ti ti-plus"></i></button></div>
        <div class="p-tabla"><table><thead><tr><th>Puesto</th><th>Fecha de inicio</th><th>Fecha de fin</th><th>Departamento</th><th>Jefe directo</th><th>Aprobador</th><th></th></tr></thead><tbody>
          ${hist.map(x => `<tr><td class="pu"><b>${escU(x.puesto)}</b>${act && x.inicio === act.inicio && x.puesto === act.puesto && x.fin === act.fin ? '<span class="u-act">Actual</span>' : ''}</td><td>${fmtFecha(x.inicio)}</td><td>${fmtFecha(x.fin)}</td><td>${escU(x.depto || '-')}</td><td><b>${escU(x.jefe || '-')}</b></td><td>${escU(x.aprob || '-')}</td><td class="u-k"><button class="u-kebab sm" data-i="${x.i}" aria-label="Acciones del puesto"><i class="ti ti-dots-vertical"></i></button></td></tr>`).join('') || '<tr><td colspan="7" class="u-vacio">No hay puestos cargados.</td></tr>'}
        </tbody></table></div>
        <p class="p-nota"><i class="ti ti-info-circle"></i>El puesto actual define el rol laboral de la persona en Turnos laborales: la cobertura, los conflictos y Programar lo usan.</p></div>
      <div class="p-card" id="pc-salario"><div class="p-ct"><div><b>Salario</b><div class="p-cs">Consulta el importe percibido y el historial salarial</div></div><div style="display:flex;gap:10px"><button class="btn-out" data-x>Historial salarial <i class="ti ti-refresh"></i></button><button class="p-edit" data-x aria-label="Editar"><i class="ti ti-pencil"></i></button></div></div>
        <div class="p-gris" style="justify-content:space-between"><div class="p-f"><span>Salario bruto</span><b>-</b></div><div class="p-f" style="text-align:right"><span>Vigente desde</span><b>-</b></div></div></div></div>`;
    $('pAddPuesto').onclick = () => abrirPuesto(null);
    if (act) $('pEditAct').onclick = () => abrirPuesto((HISTORIAL_LABORAL[c.nombre] || []).indexOf(act));
  } else {
    $('pMain').innerHTML = `<div class="p-col"><div class="p-card p-vacio"><i class="ti ti-info-circle"></i><b>Esta sección no forma parte del prototipo</b><span>El prototipo desarrolla Información general y Trabajo, donde se configura el puesto de cada persona.</span></div></div>`;
  }
  $('pMain').querySelectorAll('[data-x]').forEach(b => b.onclick = noDisponible);
  $('pMain').scrollTop = 0;
}
let puMenuI = null;
$('pMain').addEventListener('click', e => {
  const k = e.target.closest('.u-kebab[data-i]'); if (!k) return;
  e.stopPropagation(); const m = $('puMenu');
  if (m.classList.contains('open') && puMenuI === +k.dataset.i) return cerrarUMenus();
  cerrarUMenus(); puMenuI = +k.dataset.i;
  const r = k.getBoundingClientRect(); m.classList.add('open');
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = (r.right - m.offsetWidth) + 'px';
});
$('puMenu').onclick = e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  e.stopPropagation(); const i = puMenuI; cerrarUMenus();
  if (b.dataset.a === 'edit') return abrirPuesto(i);
  const c = COLABORADORES[PID];
  confirmar('¿Quieres eliminar este puesto?', 'Si lo eliminas, se quitará del historial laboral de la persona. Si era su puesto actual, la persona queda sin rol laboral asignado en Turnos laborales.', 'Eliminar puesto', () => {
    HISTORIAL_LABORAL[c.nombre].splice(i, 1); guardarPuestos(); aplicarPuestos(); pintarPerfil(); toast('El puesto se eliminó correctamente');
  });
};

/* ---------- Panel lateral: agregar o editar puesto ---------- */
const ENCARGADOS = () => COLABORADORES.filter(x => x.rol === 'Encargado de sucursal');
function abrirPuesto(i) {
  const c = COLABORADORES[PID], h = HISTORIAL_LABORAL[c.nombre] || (HISTORIAL_LABORAL[c.nombre] = []);
  const act = puestoActual(c.nombre);
  const x = i !== null ? h[i] : { puesto: '', inicio: '2026-11-30', fin: '', depto: act ? act.depto : 'Atención al público', jefe: act ? act.jefe : '', aprob: act ? act.aprob : '' };
  const sel = (id, opts, v, vacio) => `<select class="u-field" id="${id}">${vacio ? `<option value="">${vacio}</option>` : ''}${opts.map(o => `<option ${o === v ? 'selected' : ''}>${escU(o)}</option>`).join('')}</select>`;
  const personas = ENCARGADOS().filter(p => p.nombre !== c.nombre).map(p => p.nombre);
  $('shTit').textContent = i !== null ? 'Editar puesto' : 'Agregar puesto';
  $('shBody').innerHTML = `
    <div class="u-box"><label>Puesto</label>${sel('fPuesto', ROLES, x.puesto, 'Seleccionar')}</div>
    <div class="u-box"><label>Fecha de inicio</label><input type="date" class="u-field" id="fIni" value="${x.inicio}"></div>
    <div class="u-box"><label>Fecha de fin (Opcional)</label><input type="date" class="u-field" id="fFin" value="${x.fin}"><small>Si el puesto sigue vigente, dejá este campo vacío.</small></div>
    <div class="u-box"><label>Departamento</label>${sel('fDepto', DEPARTAMENTOS, x.depto)}</div>
    <div class="u-box"><label>Jefe directo (Opcional)</label>${sel('fJefe', personas, x.jefe, 'Sin jefe directo')}</div>
    <div class="u-box"><label>Aprobador (Opcional)</label>${sel('fAprob', personas, x.aprob, 'Sin aprobador')}</div>
    ${i === null ? '<p class="p-nota"><i class="ti ti-info-circle"></i>Si el nuevo puesto queda vigente, el puesto actual se cierra el día anterior a su fecha de inicio.</p>' : ''}`;
  $('shFoot').innerHTML = `<button class="u-link" id="shNo">Cancelar</button><button class="u-primary" id="shOk">${i !== null ? 'Guardar cambios' : 'Agregar puesto'}</button>`;
  const ok = () => $('fPuesto').value && $('fIni').value && (!$('fFin').value || $('fFin').value >= $('fIni').value);
  const val = () => { $('shOk').disabled = !ok(); };
  $('shBody').oninput = val; $('shBody').onchange = val; val();
  $('shNo').onclick = cerrarSheet;
  $('shOk').onclick = () => {
    if (!ok()) return;
    const nuevo = { puesto: $('fPuesto').value, inicio: $('fIni').value, fin: $('fFin').value, depto: $('fDepto').value, jefe: $('fJefe').value, aprob: $('fAprob').value };
    if (i !== null) h[i] = nuevo;
    else {
      h.forEach(p => { if (!p.fin && p.inicio < nuevo.inicio) { const d = new Date(nuevo.inicio + 'T00:00'); d.setDate(d.getDate() - 1); p.fin = d.toISOString().slice(0, 10); } });
      h.push(nuevo);
    }
    guardarPuestos(); aplicarPuestos(); cerrarSheet(); pintarPerfil();
    toast(i !== null ? 'Los cambios se guardaron correctamente' : 'El puesto se agregó correctamente');
  };
  $('uOv').classList.add('open'); $('uSheet').classList.add('open');
}
function cerrarSheet() { $('uOv').classList.remove('open'); $('uSheet').classList.remove('open'); }
$('shX').onclick = cerrarSheet; $('uOv').onclick = cerrarSheet;

/* ---------- Confirmación ---------- */
function confirmar(tit, txt, okTxt, fn) {
  $('umTit').textContent = tit; $('umTxt').textContent = txt; $('umOk').textContent = okTxt;
  $('uModal').classList.add('open');
  $('umOk').onclick = () => { $('uModal').classList.remove('open'); fn(); };
}
$('umNo').onclick = $('umX').onclick = () => $('uModal').classList.remove('open');
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if ($('uModal').classList.contains('open')) return $('uModal').classList.remove('open'); if ($('uSheet').classList.contains('open')) return cerrarSheet(); if (PID !== null) cerrarPerfil(); });

$('uQ').value = ''; // el buscador arranca vacío aunque el navegador recuerde una búsqueda anterior
window.addEventListener('pageshow', () => { $('uQ').value = ''; if ($('mainUsr').style.display !== 'none') pintarUsuarios(); });
ruta();
