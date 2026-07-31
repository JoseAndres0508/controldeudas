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
/** Convierte un monto en colones a la moneda base elegida en Ajustes y lo formatea. */
export const fmtBase = crcAmount => {
  const base = DB.settings.baseCurrency || 'CRC';
  return base === 'USD' ? fmtUSD(crcAmount / (DB.settings.fx || 512)) : fmtCRC(crcAmount);
};
export const parseNum = s => { if (s === '' || s === null || s === undefined) return null; const v = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return isNaN(v) ? null : v; };

/* =========================================================
   CALENDARIO DE PAGOS
   Sólo se abona los días 15 y 30 de cada mes. Todo el sistema
   —cortes, proyecciones y fechas de salida— se mueve sobre
   esas dos fechas, así que hay 24 oportunidades de pago al año,
   no 12. En los meses sin día 30 (febrero) cae en el último día.
   ========================================================= */
export const PAY_DAYS = [15, 30];
export const PERIODS_PER_YEAR = 24;   // dos quincenas por mes

/** El día de pago real de ese mes: 15 tal cual, y 30 recortado
 *  al último día si el mes es más corto. */
export function payDateInMonth(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/** La n-ésima fecha de pago contando desde `from` (n = 1 es la próxima).
 *  Devuelve ISO 'YYYY-MM-DD', o null si se pasa del horizonte. */
export function payDateAfter(n, from = new Date()) {
  if (!n || n < 1) return null;
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  let year = start.getFullYear(), month = start.getMonth(), found = 0;
  for (let guard = 0; guard < 1200; guard++) {
    for (const day of PAY_DAYS) {
      const cand = payDateInMonth(year, month, day);
      if (cand > start && ++found === n) {
        return `${cand.getFullYear()}-${String(cand.getMonth() + 1).padStart(2, '0')}-${String(cand.getDate()).padStart(2, '0')}`;
      }
    }
    if (++month > 11) { month = 0; year++; }
  }
  return null;
}

/** Texto corto de una cantidad de quincenas: "18 meses", "1 mes y medio". */
export function fmtPeriods(periods) {
  const months = Math.floor(periods / 2);
  const half = periods % 2 === 1;
  if (months === 0) return half ? 'medio mes' : '—';
  const base = `${months} ${months === 1 ? 'mes' : 'meses'}`;
  return half ? `${base} y medio` : base;
}

export const sortedPeriods = () => [...DB.periods].sort((a, b) => a.date.localeCompare(b.date));
export const activeDebts = () => DB.debts.filter(d => !d.archived);
export const debtById = id => DB.debts.find(d => d.id === id);
export const creditorById = id => DB.creditors.find(c => c.id === id);
/** Nombre a mostrar del acreedor de una deuda (con respaldo al "issuer" viejo). */
export const creditorName = d => creditorById(d.creditorId)?.name || d.issuer || '';

/** Saldo actual de una deuda, en su moneda.
 *
 *  Punto de partida = lo más reciente entre el último corte con saldo y el
 *  último "ajuste de saldo" de esa deuda (un ajuste dice cuánto se debe de
 *  verdad ese día, igual que un corte pero para una sola deuda).
 *
 *  Sobre esa base se aplican los movimientos posteriores: los pagos restan
 *  y los consumos suman. Así una tarjeta puede subir por uso y bajar por
 *  abonos sin tener que registrar un corte completo. */
export function lastBalance(debtId) {
  const ps = sortedPeriods();
  let base = 0, baseDate = null;
  for (let i = ps.length - 1; i >= 0; i--) {
    const e = ps[i].entries[debtId];
    if (e && e.balance !== null && e.balance !== undefined) { base = e.balance; baseDate = ps[i].date; break; }
  }

  // Un ajuste igual o posterior al corte manda sobre él.
  const adjustments = DB.payments
    .filter(p => p.debtId === debtId && p.type === 'ajuste')
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastAdj = adjustments.filter(a => !baseDate || a.date >= baseDate).pop();
  if (lastAdj) { base = lastAdj.amount; baseDate = lastAdj.date; }

  const delta = DB.payments
    .filter(p => p.debtId === debtId && p.type !== 'ajuste' && (!baseDate || p.date > baseDate))
    .reduce((s, p) => s + (p.type === 'consumo' ? p.amount : -p.amount), 0);

  return Math.max(0, base + delta);
}

/** Avance de una deuda contra su saldo inicial.
 *
 *  Devuelve null si no hay saldo inicial cargado. Si el inicial es 0 (una
 *  tarjeta que te dieron en cero) no hay porcentaje que calcular: solo se
 *  reporta cuánto creció. `grew` marca las deudas que hoy deben más que al
 *  inicio, para no mostrar porcentajes negativos. */
export function debtProgress(d) {
  const initial = d.initialBalance;
  if (initial === null || initial === undefined) return null;
  const current = lastBalance(d.id);
  const diff = initial - current;          // positivo = bajó
  const grew = diff < 0;
  const pct = initial > 0 ? Math.max(0, Math.min(100, (diff / initial) * 100)) : null;
  return { initial, current, paid: Math.max(0, diff), grown: Math.max(0, -diff), grew, pct, done: current <= 0 };
}

/** Avance agregado de todas las deudas activas con saldo inicial, en colones. */
export function overallProgress() {
  const rows = activeDebts()
    .map(d => ({ d, p: debtProgress(d) }))
    .filter(x => x.p);
  if (!rows.length) return null;
  const initial = rows.reduce((s, { d, p }) => s + toCRC(p.initial, d.currency), 0);
  const current = rows.reduce((s, { d, p }) => s + toCRC(p.current, d.currency), 0);
  const pct = initial > 0 ? Math.max(0, Math.min(100, ((initial - current) / initial) * 100)) : null;
  return { initial, current, paid: Math.max(0, initial - current), pct, count: rows.length };
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

/** Deuda total agrupada por acreedor (solo deudas activas con saldo). */
export function debtsByCreditor() {
  const groups = new Map();
  activeDebts().forEach(d => {
    const crc = toCRC(lastBalance(d.id), d.currency);
    if (crc <= 0) return;
    const key = d.creditorId || '__sin__';
    if (!groups.has(key)) groups.set(key, { creditor: creditorById(d.creditorId), total: 0, count: 0 });
    const g = groups.get(key);
    g.total += crc; g.count += 1;
  });
  return [...groups.values()].sort((a, b) => b.total - a.total);
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
