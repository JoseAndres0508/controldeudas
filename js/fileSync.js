import { clearHandle, getSavedHandle, saveHandle } from './fileHandle.js';
import { toast } from './toast.js';

/* =========================================================
   SINCRONIZACIÓN CON UN ARCHIVO REAL (File System Access API)
   El navegador exige un gesto del usuario (click) para dar o
   renovar permiso sobre un archivo; por eso, aunque el handle
   queda guardado entre sesiones, a veces hace falta un click
   de "Reconectar" antes de poder leer o escribir de nuevo.
   Solo Chrome/Edge (y similares) soportan esta API por ahora.
   ========================================================= */
export const supported = typeof window !== 'undefined' && !!window.showSaveFilePicker;

let handle = null;
let status = supported ? 'checking' : 'unsupported'; // checking | none | needs-permission | connected | unsupported

export function getStatus() { return status; }
export function getFileName() { return handle?.name || null; }

/** Al arrancar: recupera el handle guardado (si hay) sin pedir permiso todavía. */
export async function tryRestore() {
  if (!supported) { status = 'unsupported'; return; }
  const saved = await getSavedHandle();
  if (!saved) { status = 'none'; return; }
  handle = saved;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  status = perm === 'granted' ? 'connected' : 'needs-permission';
}

/** Pide de nuevo el permiso sobre el handle ya guardado (requiere click del usuario). */
export async function reconnect() {
  if (!handle) return false;
  try {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    status = perm === 'granted' ? 'connected' : 'needs-permission';
  } catch (e) { status = 'needs-permission'; }
  return status === 'connected';
}

/** Abre el selector para crear o elegir el archivo .json de datos. */
export async function connect() {
  if (!supported) return false;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: 'libro-deudas.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    await saveHandle(handle);
    status = 'connected';
    return true;
  } catch (e) { return false; } // el usuario canceló el diálogo
}

export async function disconnect() {
  handle = null;
  status = 'none';
  await clearHandle();
}

/** Lee el contenido actual del archivo conectado (o null si no hay/está vacío). */
export async function readFile() {
  if (status !== 'connected' || !handle) return null;
  try {
    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (e) { console.warn('No se pudo leer el archivo conectado', e); return null; }
}

/** Escribe el estado actual en el archivo conectado (si hay uno). */
export async function writeFile(data) {
  if (status !== 'connected' || !handle) return;
  try {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('No se pudo guardar en el archivo conectado', e);
    toast('No se pudo guardar en el archivo conectado. Revisá el permiso en Ajustes.', 'error');
  }
}
