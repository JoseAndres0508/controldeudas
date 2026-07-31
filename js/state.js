import { Store } from './store.js';
import { buildSeed } from './seed.js';

/* =========================================================
   ESTADO GLOBAL (DB)
   Único lugar donde la referencia DB puede reasignarse
   (reset / importar respaldo). El resto del código solo
   lee y muta sus propiedades.
   ========================================================= */
export let DB = Store.load() || buildSeed();

export function save() { Store.save(DB); }

/** Reemplaza la base de datos completa (usado por reset e import). */
export function setDB(data) { DB = data; }
