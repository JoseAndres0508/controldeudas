import { DB } from './state.js';

/* =========================================================
   UTILIDADES DE FORMATO Y CÁLCULO
   ========================================================= */
export const fmtCRC = n => '₡' + Math.round(n).toLocaleString('es-CR');
export const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (n, cur) => (n < 0 ? '-' : '') + (cur === 'USD' ? fmtUSD(Math.abs(n)) : fmtCRC(Math.abs(n)));
export const fmtSigned = n => (n > 0 ? '+' : n < 0 ? '-' : '') + fmtCRC(Math.abs(n));
export const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
export const fmtDateLong = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
export const toCRC = (amount, cur) => cur === 'USD' ? amount * (DB.settings.fx || 512) : amount;
export const parseNum = s => { if (s === '' || s === null || s === undefined) return null; const v = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? null : v; };

export const sortedPeriods = () => [...DB.periods].sort((a, b) => a.date.localeCompare(b.date));
export const activeDebts = () => DB.debts.filter(d => !d.archived);
export const debtById = id => DB.debts.find(d => d.id === id);

/** Último saldo conocido de una deuda (en su moneda). */
export function lastBalance(debtId) {
  const ps = sortedPeriods();
  for (let i = ps.length - 1; i >= 0; i--) {
    const e = ps[i].entries[debtId];
    if (e && e.balance !== null && e.balance !== undefined) return e.balance;
  }
  return 0;
}

/** Total en colones de un periodo (convierte USD). */
export function periodTotalCRC(period) {
  let t = 0;
  for (const [id, e] of Object.entries(period.entries)) {
    const d = debtById(id);
    if (!d || e.balance === null || e.balance === undefined) continue;
    t += toCRC(e.balance, d.currency);
  }
  return t;
}

/** Serie [{date,total,delta}] — delta>0 significa que la deuda BAJÓ. */
export function series() {
  const ps = sortedPeriods();
  return ps.map((p, i) => {
    const total = periodTotalCRC(p);
    const prev = i > 0 ? periodTotalCRC(ps[i - 1]) : null;
    return { id: p.id, date: p.date, total, delta: prev === null ? null : prev - total };
  });
}

/** Fecha del próximo corte esperado (15 o fin de mes) que aún no existe. */
export function pendingCutDate() {
  const today = new Date();
  const cuts = [];
  for (let back = 0; back < 3; back++) {
    const d = new Date(today.getFullYear(), today.getMonth() - back + 1, 0);
    const y = d.getFullYear(), m = d.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    cuts.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(30, last)).padStart(2, '0')}`);
    cuts.push(`${y}-${String(m + 1).padStart(2, '0')}-15`);
  }
  const iso = today.toISOString().slice(0, 10);
  const have = new Set(DB.periods.map(p => p.date));
  return cuts.filter(c => c <= iso && !have.has(c)).sort().pop() || null;
}
