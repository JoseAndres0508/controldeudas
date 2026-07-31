/* =========================================================
   Persistencia del FileSystemFileHandle en IndexedDB.
   localStorage no puede guardar un handle; IndexedDB sí,
   porque los handles son "structured-cloneable".
   ========================================================= */
const DB_NAME = 'libro-deudas-fs';
const STORE = 'handles';
const KEY = 'file';

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSavedHandle() {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}

export async function saveHandle(handle) {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* no bloquea el flujo si falla */ }
}

export async function clearHandle() {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* no bloquea el flujo si falla */ }
}
