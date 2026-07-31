import { activeDebts, fmtBase, fmtCRC, fmtDate, fmtDateLong, fmtSigned, series } from './utils.js';

/* =========================================================
   HERO + CINTA DE CORTES
   Ya no son globales: se insertan como las primeras tarjetas
   de la pestaña "Inicio" (js/tabs/inicio.js).
   ========================================================= */
export function heroHTML() {
  const s = series();
  const last = s[s.length - 1];
  if (!last) {
    return `<div class="card hero-card">
      <div class="eyebrow">Deuda total</div>
      <div class="fig num">${fmtBase(0)}</div>
      <div class="sub">Sin cortes todavía</div>
    </div>`;
  }
  let deltaHTML = '';
  if (last.delta !== null && last.delta !== 0) {
    const cls = last.delta > 0 ? 'd-down' : 'd-up';
    deltaHTML = `<span class="delta ${cls}">${fmtSigned(last.delta)} ${last.delta > 0 ? 'menos' : 'más'} que el corte anterior</span>`;
  }
  return `<div class="card hero-card">
    <div class="eyebrow">Deuda total</div>
    <div class="fig num">${fmtBase(last.total)}</div>
    <div class="sub">al ${fmtDateLong(last.date)} · ${activeDebts().length} deudas activas ${deltaHTML}</div>
  </div>`;
}

export function tapeHTML() {
  const all = series();
  const s = all.slice(1);
  const max = Math.max(1, ...s.map(x => Math.abs(x.delta || 0)));
  const track = s.map(x => {
    const mag = Math.abs(x.delta || 0);
    const h = Math.max(2, Math.round((Math.sqrt(mag) / Math.sqrt(max)) * 100));
    const cls = !x.delta ? 'b-none' : x.delta > 0 ? 'b-down' : 'b-up';
    const word = !x.delta ? 'sin cambio' : x.delta > 0 ? 'bajó' : 'subió';
    return `<div class="tick" title="${fmtDateLong(x.date)} — la deuda ${word} ${fmtCRC(Math.abs(x.delta || 0))}"><div class="bar ${cls}" style="height:${h}%"></div></div>`;
  }).join('');
  const labels = s.map(x => `<span>${fmtDate(x.date).slice(0, 5)}</span>`).join('');
  return `<div class="tape">
    <div class="tape-head">
      <div>
        <div class="eyebrow">Cinta de cortes</div>
        <div class="muted" style="font-size:.8125rem">Cada barra es un corte. Altura = cuánto se movió la deuda total.</div>
      </div>
      <div class="num dim" style="font-size:.75rem">${all.length} cortes</div>
    </div>
    <div class="tape-track">${track}</div>
    <div class="tape-labels">${labels}</div>
    <div class="tape-legend">
      <span><i style="background:var(--down)"></i>La deuda bajó (avanzaste)</span>
      <span><i style="background:var(--up)"></i>La deuda subió</span>
      <span><i style="background:var(--rule)"></i>Sin movimiento</span>
    </div>
  </div>`;
}
