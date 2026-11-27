/* =====================================================================
   Motor de reglas para la programación automática de turnos (v1, prototipo)

   Cómo decide:
   1. Restricciones (no negociables): filtran quién puede tomar cada turno.
      Una persona es candidata solo si tiene el rol y la sede correctos, el día libre
      y si la asignación no le genera ningún conflicto nuevo (regulación o licencia).
      Usa el mismo validador que el panel de Conflictos, por eso el borrador sale sin conflictos.
   2. Preferencias (ponderadas): ordenan a los candidatos con un puntaje
      puntaje = Σ peso × criterio (cada criterio entre 0 y 1).
   3. Orden de resolución: siempre se resuelve primero el hueco con menos candidatos
      ("el más difícil primero"). Si un hueco no tiene candidatos, queda sin cubrir y se informa.

   La configuración (MOTOR_CONFIG) es lo que más adelante se podría editar desde el Admin.
   ===================================================================== */

const MOTOR_CONFIG = {
  pesos: { ALTO: 3, MEDIO: 2, BAJO: 1, OFF: 0 },

  // Restricciones: se cumplen siempre, no llevan peso
  restricciones: [
    { id: 'cobertura',  descripcion: 'Cobertura requerida por turno, rol y sede', ponderacion: 'ALTO' },
    { id: 'timeOff',    descripcion: 'Ausencias, vacaciones y licencias aprobadas', ponderacion: 'ALTO' },
    { id: 'regulacion', descripcion: 'Regulación laboral: descansos y topes', ponderacion: 'ALTO' },
  ],

  // Parámetros de regulación laboral (inputs configurables)
  regulacion: {
    topeDiario: 8,              // horas máximas por día
    topeSemanal: 48,            // horas máximas por semana
    descansoEntreJornadas: 12,  // horas corridas mínimas entre el fin de una jornada y el inicio de la siguiente
    descansoSemanal: 35,        // horas corridas mínimas de descanso en la semana (franco rotativo)
    // Supuesto para medir el descanso en los bordes de la semana: la semana anterior terminó
    // el domingo a las 19:00 y la siguiente empieza el lunes a las 09:00.
    bordeInicio: -5,
    bordeFin: 7 * 24 + 9,
  },

  // Preferencias: ordenan a los candidatos que pasaron las restricciones
  preferencias: [
    { id: 'historial',   descripcion: 'Historial y costumbres propias de la industria', ponderacion: 'ALTO' },
    { id: 'regularidad', descripcion: 'Regularidad para el colaborador',                ponderacion: 'MEDIO' },
    { id: 'equidad',     descripcion: 'Reparto equitativo de fines de semana',          ponderacion: 'BAJO' },
  ],
  pesoDesempate: 0.5, // menor carga horaria relativa
  // Comportamiento de cada regulación en la grilla: 'A' advertencia (se puede publicar) o 'B' bloqueante
  severidad: { diario: 'A', semana: 'A', entre: 'B', semanal: 'B' },
};

/* Reglas configuradas desde Admin > Reglas (si existen). Una regla de regulación apagada queda en null y no se valida. */
const MOTOR_DEFAULTS = JSON.parse(JSON.stringify({ regulacion: MOTOR_CONFIG.regulacion, preferencias: MOTOR_CONFIG.preferencias, severidad: MOTOR_CONFIG.severidad }));
const TIPO_DE_REGLA = { topeDiario: 'diario', topeSemanal: 'semana', descansoEntreJornadas: 'entre', descansoSemanal: 'semanal' };
function aplicarReglasGuardadas() {
  // Se parte siempre de los valores predeterminados (modificando los mismos objetos, que la app referencia)
  Object.assign(MOTOR_CONFIG.regulacion, MOTOR_DEFAULTS.regulacion);
  Object.assign(MOTOR_CONFIG.severidad, MOTOR_DEFAULTS.severidad);
  MOTOR_CONFIG.preferencias.forEach((p, i) => p.ponderacion = MOTOR_DEFAULTS.preferencias[i].ponderacion);
  const cfg = typeof REGLAS_GUARDADAS !== 'undefined' ? REGLAS_GUARDADAS : null;
  if (!cfg) return;
  const reg = cfg.regulacion && cfg.regulacion.Argentina; // por ahora todas las sedes están en Argentina
  if (reg) ['topeDiario', 'topeSemanal', 'descansoEntreJornadas', 'descansoSemanal'].forEach(k => {
    if (reg[k]) MOTOR_CONFIG.regulacion[k] = reg[k].on ? Number(reg[k].valor) : null;
    if (reg[k] && (reg[k].sev === 'A' || reg[k].sev === 'B')) MOTOR_CONFIG.severidad[TIPO_DE_REGLA[k]] = reg[k].sev;
  });
  if (cfg.motor) MOTOR_CONFIG.preferencias.forEach(p => { if (cfg.motor[p.id]) p.ponderacion = cfg.motor[p.id]; });
}
aplicarReglasGuardadas();

const Motor = (() => {
  const hNum = t => { const [h, m] = t.split(':').map(Number); return h + m / 60; };
  const DIAS_NOMBRE = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

  /* Tipos de conflicto y su severidad: B = bloqueante, A = advertencia */
  const R = MOTOR_CONFIG.regulacion;
  const TIPOS = {
    solap:    { titulo: 'Turnos solapados',                    sev: 'B' },
    desc:     { titulo: 'Turno en día de descanso',            sev: 'B' },
    semanal:  { titulo: 'Descanso semanal obligatorio',        sev: MOTOR_CONFIG.severidad.semanal, regla: R.descansoSemanal != null ? `Mínimo ${R.descansoSemanal}h corridas en la semana` : '' },
    entre:    { titulo: 'Descanso entre jornadas',             sev: MOTOR_CONFIG.severidad.entre, regla: R.descansoEntreJornadas != null ? `Mínimo ${R.descansoEntreJornadas}h corridas` : '' },
    licencia: { titulo: 'Turno durante vacaciones o ausencia', sev: 'A' },
    diario:   { titulo: 'Máximo de horas diario',                sev: MOTOR_CONFIG.severidad.diario, regla: R.topeDiario != null ? `Máximo ${R.topeDiario}h por día` : '' },
    semana:   { titulo: 'Máximo de horas semanal',               sev: MOTOR_CONFIG.severidad.semana, regla: R.topeSemanal != null ? `Máximo ${R.topeSemanal}h por semana` : '' },
  };

  /* ---------- Validador: conflictos de un colaborador ---------- */
  function conflictosColab(c, ctx) {
    const { turnos, licencias, reglas } = ctx;
    const out = [];
    const lic = licencias[c.nombre];
    const tDia = d => c.semana[d].filter(k => turnos[k]);
    const hDia = d => tDia(d).reduce((a, k) => a + turnos[k].horas, 0);
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const s = tDia(d);
      for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
        const a = turnos[s[i]], b = turnos[s[j]];
        if (hNum(a.inicio) < hNum(b.fin) && hNum(b.inicio) < hNum(a.fin)) out.push({ tipo: 'solap', emp: c.id, d, turnos: [[d, s[i]], [d, s[j]]] });
      }
      if (c.semana[d].includes('D')) s.forEach(k => out.push({ tipo: 'desc', emp: c.id, d, turnos: [[d, k], [d, 'D']] }));
      if (lic && lic.dias.includes(d)) s.forEach(k => out.push({ tipo: 'licencia', emp: c.id, d, licencia: lic.tipo, turnos: [[d, k]] }));
      const hd = hDia(d); total += hd;
      if (reglas.topeDiario != null && hd > reglas.topeDiario) out.push({ tipo: 'diario', emp: c.id, d, horas: hd, turnos: s.map(k => [d, k]) });
      if (reglas.descansoEntreJornadas != null && d < 6 && s.length && tDia(d + 1).length) {
        const n = tDia(d + 1);
        const fin = Math.max(...s.map(k => hNum(turnos[k].fin))), ini = Math.min(...n.map(k => hNum(turnos[k].inicio)));
        const gap = 24 + ini - fin;
        if (gap < reglas.descansoEntreJornadas) {
          out.push({ tipo: 'entre', emp: c.id, d, gap, turnos: [[d, s.find(k => hNum(turnos[k].fin) === fin)], [d + 1, n.find(k => hNum(turnos[k].inicio) === ini)]] });
        }
      }
    }
    // Descanso semanal: el bloque libre más largo de la semana debe alcanzar el mínimo
    const iv = [];
    for (let d = 0; d < 7; d++) tDia(d).forEach(k => iv.push([d * 24 + hNum(turnos[k].inicio), d * 24 + hNum(turnos[k].fin)]));
    if (reglas.descansoSemanal != null && iv.length) {
      iv.sort((a, b) => a[0] - b[0]);
      let max = iv[0][0] - reglas.bordeInicio, fin = iv[0][1];
      for (const [a, b] of iv.slice(1)) { max = Math.max(max, a - fin); fin = Math.max(fin, b); }
      max = Math.max(max, reglas.bordeFin - fin);
      if (max < reglas.descansoSemanal) out.push({ tipo: 'semanal', emp: c.id, d: null, gap: max, turnos: [] });
    }
    if (reglas.topeSemanal != null && total > reglas.topeSemanal) out.push({ tipo: 'semana', emp: c.id, d: null, horas: total, turnos: [] });
    return out;
  }
  const conflictos = (colabs, ctx) => colabs.flatMap(c => conflictosColab(c, ctx));

  /* ---------- Programador ---------- */
  function programar({ colaboradores, sede, cobertura, turnos, licencias, historial, reglas = MOTOR_CONFIG.regulacion }) {
    const ctx = { turnos, licencias, reglas };
    const P = MOTOR_CONFIG.pesos;
    const peso = id => P[MOTOR_CONFIG.preferencias.find(p => p.id === id).ponderacion];
    const horas = c => c.semana.reduce((a, d) => a + d.filter(k => turnos[k]).reduce((b, k) => b + turnos[k].horas, 0), 0);

    // Si quedan huecos, se reintenta resolviendo primero esos huecos (hasta 5 intentos) y se queda el mejor resultado.
    let mejorRes = null, prioridad = [];
    for (let intento = 0; intento < 5; intento++) {
      const r = intentar(prioridad);
      if (!mejorRes || r.sinCubrir.length < mejorRes.sinCubrir.length) mejorRes = r;
      if (!r.sinCubrir.length) break;
      prioridad = [...prioridad, ...r.sinCubrir.map(h => `${h.d}-${h.turno}-${h.rol}`)];
    }
    return { asignaciones: mejorRes.asignaciones, sinCubrir: mejorRes.sinCubrir };

    function intentar(prioridad) {
    const pool = colaboradores.filter(c => c.sede === sede).map(c => ({ ...c, semana: c.semana.map(d => [...d]) }));
    // 1. Huecos de cobertura (descontando lo ya asignado)
    let huecos = [];
    for (let d = 0; d < 7; d++) for (const g of cobertura) for (const r of g.roles) {
      const ya = pool.filter(c => c.rol === r.rol && c.semana[d].includes(g.turno)).length;
      for (let i = ya; i < r.cant; i++) huecos.push({ d, turno: g.turno, rol: r.rol });
    }

    // 2. Restricciones: candidatos válidos para un hueco
    const elegibles = h => pool.filter(c => {
      if (c.rol !== h.rol || c.semana[h.d].length) return false;
      const antes = conflictosColab(c, ctx).length;
      c.semana[h.d].push(h.turno);
      const despues = conflictosColab(c, ctx).length;
      c.semana[h.d].pop();
      return despues === antes;
    });

    // 3. Preferencias: puntaje de un candidato
    function puntuar(c, h) {
      const hist = historial[c.nombre] || [];
      const vecesHist = hist.filter(sem => sem[h.d] === h.turno).length;
      const fHist = hist.length ? vecesHist / hist.length : 0;
      const otros = c.semana.flatMap(d => d.filter(k => turnos[k]));
      const fReg = otros.length ? otros.filter(k => k === h.turno).length / otros.length : 0.5;
      const finde = h.d >= 5;
      const yaFinde = [5, 6].filter(d => c.semana[d].some(k => turnos[k])).length;
      const fEq = finde ? 1 - yaFinde / 2 : 1;
      const fCarga = 1 - horas(c) / c.capacidad;
      const total = peso('historial') * fHist + peso('regularidad') * fReg + peso('equidad') * fEq + MOTOR_CONFIG.pesoDesempate * fCarga;
      const motivos = [];
      if (peso('historial') && fHist >= 0.5) motivos.push(`Historial: hizo este turno los ${DIAS_NOMBRE[h.d]} en ${vecesHist} de ${hist.length} semanas`);
      if (peso('regularidad') && otros.length && fReg === 1) motivos.push('Regularidad: mantiene el mismo turno que el resto de su semana');
      if (peso('equidad') && finde && yaFinde === 0) motivos.push('Equidad: todavía no tiene turnos este fin de semana');
      if (!motivos.length) motivos.push('Carga: es quien tiene más horas disponibles en la semana');
      return { total, motivos };
    }

    // Reparto: cada persona tiene una parte proporcional a sus horas disponibles (contrato menos licencias)
    const disp = c => Math.max(0, c.capacidad - ((licencias[c.nombre] || {}).dias || []).length * 8);
    const demandaRol = {};
    huecos.forEach(h => { demandaRol[h.rol] = (demandaRol[h.rol] || 0) + turnos[h.turno].horas; });
    pool.forEach(c => { demandaRol[c.rol] = (demandaRol[c.rol] || 0) + horas(c); });
    const dispRol = {};
    pool.forEach(c => { dispRol[c.rol] = (dispRol[c.rol] || 0) + disp(c); });
    const objetivo = c => dispRol[c.rol] ? disp(c) / dispRol[c.rol] * (demandaRol[c.rol] || 0) : 0;
    // Está "debajo" si con este turno no supera su parte proporcional en más de media jornada
    const debajo = (c, h) => horas(c) + turnos[h.turno].horas <= objetivo(c) + turnos[h.turno].horas / 2;

    // 4. Resolución: primero el hueco con menos candidatos
    const asignaciones = [], sinCubrir = [];
    while (huecos.length) {
      let mejor = null;
      const prio = huecos.filter(h => prioridad.includes(`${h.d}-${h.turno}-${h.rol}`));
      for (const h of (prio.length ? prio : huecos)) {
        const e = elegibles(h);
        if (!mejor || e.length < mejor.e.length || (e.length === mejor.e.length && h.d < mejor.h.d)) mejor = { h, e };
      }
      huecos = huecos.filter(x => x !== mejor.h);
      if (!mejor.e.length) { sinCubrir.push(mejor.h); continue; }
      // Primero quienes todavía no alcanzaron su parte proporcional de horas; dentro de cada grupo, el mejor puntaje
      const ranking = mejor.e.map(c => ({ c, tier: debajo(c, mejor.h) ? 0 : 1, ...puntuar(c, mejor.h) }))
        .sort((a, b) => a.tier - b.tier || b.total - a.total || a.c.nombre.localeCompare(b.c.nombre, 'es'));
      const g = ranking[0];
      if (g.tier === 0 && ranking.some(r => r.tier === 1 && r.total > g.total)) g.motivos = ['Reparto: todavía no completó su parte proporcional de horas en la semana', ...g.motivos.filter(m => !m.startsWith('Carga'))];
      g.c.semana[mejor.h.d].push(mejor.h.turno);
      asignaciones.push({ emp: g.c.id, d: mejor.h.d, turno: mejor.h.turno, puntaje: +g.total.toFixed(2), motivos: g.motivos });
    }
    return { asignaciones, sinCubrir };
    }
  }

  /* Vuelve a leer lo guardado en Admin > Reglas (por ejemplo, al volver del Admin a la app) */
  function recargarReglas() {
    if (typeof Store !== 'undefined') REGLAS_GUARDADAS = Store.get('reglas', null);
    aplicarReglasGuardadas();
    const R = MOTOR_CONFIG.regulacion;
    ['diario', 'semana', 'entre', 'semanal'].forEach(t => { TIPOS[t].sev = MOTOR_CONFIG.severidad[t]; });
    TIPOS.semanal.regla = R.descansoSemanal != null ? `Mínimo ${R.descansoSemanal}h corridas en la semana` : '';
    TIPOS.entre.regla = R.descansoEntreJornadas != null ? `Mínimo ${R.descansoEntreJornadas}h corridas` : '';
    TIPOS.diario.regla = R.topeDiario != null ? `Máximo ${R.topeDiario}h por día` : '';
    TIPOS.semana.regla = R.topeSemanal != null ? `Máximo ${R.topeSemanal}h por semana` : '';
  }

  return { TIPOS, conflictos, conflictosColab, programar, recargarReglas };
})();
