import { uid } from './uid.js';

/* =========================================================
   MODELO + SEMILLA CON DATOS REALES
   ========================================================= */
export const SEED_DATES = ['2025-08-30', '2025-09-30', '2025-10-30', '2025-11-30', '2025-12-30', '2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30', '2026-05-15', '2026-05-30', '2026-06-15', '2026-06-30', '2026-07-15', '2026-07-30'];
const N = null;
export const SEED_DEBTS = [
  { name: 'Tarjeta Promérica', issuer: 'Promérica', kind: 'tarjeta', currency: 'CRC', rate: null, minPayment: null,
    hist: [0, 515919.75, 1146600.54, 1065211.20, 1187976.30, 91520.65, 999835.63, 1247780.09, 216593.54, 181656.39, 723725.00, 1166243.92, 1319662.05, 1337221.92, 1300066.00] },
  { name: 'Tarjeta Promérica USD', issuer: 'Promérica', kind: 'tarjeta', currency: 'USD', rate: null, minPayment: null,
    hist: [N, N, N, N, N, N, N, N, 0, 0, 0, 0, 48.29, 58.97, 50.31] },
  { name: 'Tarjeta Popular', issuer: 'Banco Popular', kind: 'tarjeta', currency: 'CRC', rate: null, minPayment: null,
    hist: [0, 0, 0, 0, 0, 0, 0, 30000, 460349.13, 375249.13, 375249.13, 369018.41, 463056.89, 415777.10, 415777.10] },
  { name: 'Tarjeta Popular USD', issuer: 'Banco Popular', kind: 'tarjeta', currency: 'USD', rate: null, minPayment: null,
    hist: [N, N, N, N, N, N, N, N, 0, 0, 0, 0, 0, 0, 11.29] },
  { name: 'Gollo impresora', issuer: 'Gollo', kind: 'tienda', currency: 'CRC', rate: null, minPayment: null,
    hist: [N, N, N, N, N, 131047, 0, 0, 0, 0, 0, N, 0, N, 0] },
  { name: 'Gollo principal', issuer: 'Gollo', kind: 'tienda', currency: 'CRC', rate: null, minPayment: null,
    hist: [1600000, 1577934, 1549201.55, 1522633.25, 1188846.90, 1154743, 1112558, 1072657.40, 1019155, 987112, 1004748, 973461, 973461, 953004, 953004] },
  { name: 'Instacredit', issuer: 'Instacredit', kind: 'prestamo', currency: 'CRC', rate: null, minPayment: null,
    hist: [N, N, N, N, N, N, N, N, 1500000, 1680380.78, 1680380.78, 1668906.08, 1668906.08, 1657139.53, 1657139.53] },
  { name: 'Préstamo Popular', issuer: 'Banco Popular', kind: 'prestamo', currency: 'CRC', rate: null, minPayment: null,
    hist: [7, 19167027.80, 19129556.85, 19083745.05, 19045215.10, 18999387.95, 18999387.95, 18926657.70, 18886449.45, 18886449.45, 18828362.10, 18828362.10, 18787027.70, 18787024.70, 18737440.00] },
  { name: 'Popular deudas', issuer: 'Banco Popular', kind: 'prestamo', currency: 'CRC', rate: null, minPayment: null,
    hist: [N, N, N, N, N, 4975164.20, 4949321.60, 4939515.60, 4918968.85, 4851303.10, 4841576.00, 4810866.40, 4810866.40, 4792036.30, 4792036.30] }
];

export function buildSeed() {
  const debts = SEED_DEBTS.map(d => ({
    id: uid(), name: d.name, issuer: d.issuer, kind: d.kind, currency: d.currency,
    rate: d.rate, minPayment: d.minPayment, notes: '', archived: false, startDate: null
  }));
  const periods = SEED_DATES.map((date, i) => {
    const entries = {};
    debts.forEach((dbt, j) => {
      const v = SEED_DEBTS[j].hist[i];
      if (v !== null && v !== undefined) entries[dbt.id] = { balance: v, paid: null };
    });
    return { id: uid(), date, entries, note: '' };
  });
  return { version: 1, settings: { fx: 512, strategy: 'avalancha', extra: 0 }, debts, periods, creditors: [], payments: [] };
}
