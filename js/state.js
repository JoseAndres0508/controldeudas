import { Store } from './store.js';
import { buildSeed } from './seed.js';
import { writeFile } from './fileSync.js';
import { uid } from './uid.js';

/* =========================================================
   ESTADO GLOBAL (DB)
   Único lugar donde la referencia DB puede reasignarse
   (reset / importar respaldo). El resto del código solo
   lee y muta sus propiedades.
   ========================================================= */
export let DB = Store.load() || buildSeed();

/** Migración suave: agrega arreglos nuevos si faltan (respaldos
 *  viejos) y convierte el "issuer" de texto libre de cada deuda
 *  en un acreedor propio, reutilizando uno existente por nombre. */
function migrate() {
  if (!Array.isArray(DB.creditors)) DB.creditors = [];
  if (!Array.isArray(DB.payments)) DB.payments = [];
  if (!DB.settings.baseCurrency) DB.settings.baseCurrency = 'CRC';
  // Antes todos los registros eran abonos; ahora hay consumos y ajustes.
  DB.payments.forEach(p => { if (!p.type) p.type = 'pago'; });
  DB.debts.forEach(d => {
    if (!d.creditorId && d.issuer && d.issuer.trim()) {
      const name = d.issuer.trim();
      let c = DB.creditors.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!c) { c = { id: uid(), name, phone: '', email: '', address: '', notes: '' }; DB.creditors.push(c); }
      d.creditorId = c.id;
    }
    if (d.creditorId === undefined) d.creditorId = null;
  });
}
migrate();

/** Guarda en localStorage (caché rápida) y, si hay un archivo
 *  conectado, también ahí (fuente de verdad entre sesiones). */
export function save() {
  Store.save(DB);
  writeFile(DB);
}

/** Reemplaza la base de datos completa (usado por reset e import). */
export function setDB(data) { DB = data; migrate(); }
