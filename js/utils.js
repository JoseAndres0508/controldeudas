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
/** Fecha ISO de hoy + n meses (para proyectar fechas de pago). */
export const addMonthsISO = n => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

export const sortedPeriods = () => [...DB.periods].sort((a, b) => a.date.localeCompare(b.date));
export const activeDebts = () => DB.debts.filter(d => !d.archived);
export const debtById = id => DB.debts.find(d => d.id === id);
export const creditorById = id => DB.creditors.find(c => c.id === id);
/** Nombre a mostrar del acreedor de una deuda (con respaldo al "issuer" viejo). */
export const creditorName = d => creditorById(d.creditorId)?.name || d.issuer || '';

/** Saldo actual de una deuda (en su moneda): el último corte confirmado
 *  menos los pagos registrados después de ese corte (aún no confirmados
 *  por un corte nuevo, pero ya reflejados en el saldo). */
export function lastBalance(debtId) {
  const ps = sortedPeriods();
  let base = 0, baseDate = null;
  for (let i = ps.length - 1; i >= 0; i--) {
    const e = ps[i].entries[debtId];
    if (e && e.balance !== null && e.balance !== undefined) { base = e.balance; baseDate = ps[i].date; break; }
  }
  const paidAfter = DB.payments
    .filter(p => p.debtId === debtId && (!baseDate || p.date > baseDate))
    .reduce((s, p) => s + p.amount, 0);
  return Math.max(0, base - paidAfter);
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

/** Para cada deuda activa con al menos 2 registros: cuánto bajó (₡) entre
 *  su primer y su último saldo conocido. Base de la sección "La que más bajó". */
export function debtReductions() {
  return activeDebts().map(d => {
    const ps = sortedPeriods().filter(p => {
      const e = p.entries[d.id];
      return e && e.balance !== null && e.balance !== undefined;
    });
    if (ps.length < 2) return null;
    const first = ps[0], last = ps[ps.length - 1];
    const firstCRC = toCRC(first.entries[d.id].balance, d.currency);
    const lastCRC = toCRC(last.entries[d.id].balance, d.currency);
    return { d, reduction: firstCRC - lastCRC, firstDate: first.date, lastDate: last.date };
  }).filter(Boolean);
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
