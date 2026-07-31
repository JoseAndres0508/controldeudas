import { activeDebts, fmtCRC, fmtDate, fmtDateLong, fmtSigned, series } from './utils.js';

/* =========================================================
   CABECERA + CINTA DE CORTES
   ========================================================= */
export function renderHeader() {
  const s = series();
  const last = s[s.length - 1];
  if (!last) { document.getElementById('heroFig').textContent = fmtCRC(0); document.getElementById('heroSub').textContent = 'Sin cortes todavía'; return; }
  document.getElementById('heroFig').textContent = fmtCRC(last.total);
  document.getElementById('heroSub').textContent = `Deuda total al ${fmtDateLong(last.date)} · ${activeDebts().length} deudas activas`;
  const el = document.getElementById('heroDelta');
  if (last.delta === null || last.delta === 0) { el.textContent = ''; el.className = 'delta'; }
  else {
    el.className = 'delta ' + (last.delta > 0 ? 'd-down' : 'd-up');
    el.textContent = `${fmtSigned(last.delta)} ${last.delta > 0 ? 'menos' : 'más'} que el corte anterior`;
  }
}

export function renderTape() {
  const s = series().slice(1);
  const track = document.getElementById('tapeTrack'), labels = document.getElementById('tapeLabels');
  document.getElementById('tapeCount').textContent = `${series().length} cortes`;
  const max = Math.max(1, ...s.map(x => Math.abs(x.delta || 0)));
  track.innerHTML = s.map(x => {
    const mag = Math.abs(x.delta || 0);
    const h = Math.max(2, Math.round((Math.sqrt(mag) / Math.sqrt(max)) * 100));
    const cls = !x.delta ? 'b-none' : x.delta > 0 ? 'b-down' : 'b-up';
    const word = !x.delta ? 'sin cambio' : x.delta > 0 ? 'bajó' : 'subió';
    return `<div class="tick" title="${fmtDateLong(x.date)} — la deuda ${word} ${fmtCRC(Math.abs(x.delta || 0))}"><div class="bar ${cls}" style="height:${h}%"></div></div>`;
  }).join('');
  labels.innerHTML = s.map(x => `<span>${fmtDate(x.date).slice(0, 5)}</span>`).join('');
}
