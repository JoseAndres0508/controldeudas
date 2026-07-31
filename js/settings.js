import { DB, save, setDB } from './state.js';
import { buildSeed } from './seed.js';
import { Store } from './store.js';
import { parseNum } from './utils.js';
import { closeModal, showModal } from './modal.js';
import { renderAll } from './render-all.js';
import { connect, disconnect, getFileName, getStatus, readFile, reconnect, supported } from './fileSync.js';
import { confirmDialog } from './confirmDialog.js';
import { toast } from './toast.js';

/* =========================================================
   AJUSTES / RESPALDO
   ========================================================= */
function fileSection() {
  const st = getStatus();
  if (!supported) {
    return `<p class="muted" style="font-size:.8125rem;margin:0 0 12px">Tu navegador no permite guardar directamente en un archivo de tu compu (funciona en Chrome/Edge). Los datos quedan en este navegador; usá <strong>Exportar respaldo</strong> seguido para no perderlos.</p>`;
  }
  if (st === 'connected') {
    return `<p class="muted" style="font-size:.8125rem;margin:0 0 10px">Conectado a <strong>${getFileName()}</strong>. Cada cambio se guarda ahí, además del navegador.</p>
      <div class="btn-row"><button class="btn" id="fDisconnect">Desconectar archivo</button></div>`;
  }
  if (st === 'needs-permission') {
    return `<p class="muted" style="font-size:.8125rem;margin:0 0 10px">Hay un archivo conectado (<strong>${getFileName()}</strong>) pero el navegador necesita que confirmes el acceso de nuevo esta sesión.</p>
      <div class="btn-row"><button class="btn primary" id="fReconnect">Reconectar archivo</button></div>`;
  }
  return `<p class="muted" style="font-size:.8125rem;margin:0 0 10px">Conectá un archivo .json (por ejemplo, dentro de esta misma carpeta del proyecto) para que cada cambio se guarde ahí automáticamente, además del navegador. Al abrir el sistema, se lee ese archivo para traer la última versión.</p>
    <div class="btn-row"><button class="btn primary" id="fConnect">Conectar archivo</button></div>`;
}

export function openSettings() {
  showModal(`
    <h2>Ajustes</h2>
    <div class="grid g2">
      <div><label>Tipo de cambio ₡ por $1</label><input class="num-in" id="sFx" value="${DB.settings.fx || 512}" inputmode="decimal"></div>
      <div><label>Moneda base de visualización</label>
        <select id="sBaseCurrency">
          <option value="CRC" ${DB.settings.baseCurrency !== 'USD' ? 'selected' : ''}>Colones (₡)</option>
          <option value="USD" ${DB.settings.baseCurrency === 'USD' ? 'selected' : ''}>Dólares ($)</option>
        </select>
      </div>
    </div>
    <p class="muted" style="font-size:.8125rem;margin:12px 0 0">El tipo de cambio se usa para convertir las deudas en dólares y sumarlas junto a las de colones. La moneda base define en cuál se muestran los totales generales (Inicio y Reportes).</p>
    <hr style="margin:18px 0">
    <h3 style="margin-bottom:6px">Archivo de datos</h3>
    ${fileSection()}
    <hr style="margin:18px 0">
    <h3 style="margin-bottom:6px">Datos</h3>
    <p class="muted" style="font-size:.8125rem;margin:0 0 12px">${Store.persistent ? 'Se guardan en este navegador. Exportá de vez en cuando: si limpiás datos del sitio, se borran.' : 'Este navegador bloqueó el almacenamiento local. Exportá antes de cerrar.'}</p>
    <div class="btn-row">
      <button class="btn danger" id="sReset">Borrar todo y volver a la semilla</button>
    </div>
    <div class="modal-foot"><button class="btn" data-close>Cerrar</button><button class="btn primary" id="sSave">Guardar</button></div>
  `);
  document.getElementById('sSave').onclick = () => {
    DB.settings.fx = parseNum(document.getElementById('sFx').value) || 512;
    DB.settings.baseCurrency = document.getElementById('sBaseCurrency').value;
    save(); closeModal(); renderAll();
    toast('Ajustes guardados.', 'success');
  };
  document.getElementById('sReset').onclick = async () => {
    if (!(await confirmDialog('Esto borra todos tus cortes y deudas y vuelve a los datos de ejemplo. ¿Seguro?'))) return;
    setDB(buildSeed()); save(); closeModal(); renderAll();
    toast('Datos reiniciados a la semilla de ejemplo.', 'success');
  };
  const fConnect = document.getElementById('fConnect');
  if (fConnect) fConnect.onclick = async () => {
    const ok = await connect();
    if (ok) {
      const data = await readFile();
      if (data && data.debts && data.periods) setDB(data);
      save();
    }
    closeModal(); renderAll();
  };
  const fReconnect = document.getElementById('fReconnect');
  if (fReconnect) fReconnect.onclick = async () => {
    const ok = await reconnect();
    if (ok) {
      const data = await readFile();
      if (data && data.debts && data.periods) { setDB(data); save(); }
    }
    closeModal(); renderAll();
  };
  const fDisconnect = document.getElementById('fDisconnect');
  if (fDisconnect) fDisconnect.onclick = async () => {
    await disconnect();
    closeModal(); openSettings();
  };
}

export function exportJSON() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `libro-deudas-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}

export function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data.debts || !data.periods) throw new Error('formato');
      setDB(data); save(); renderAll();
      toast('Respaldo importado.', 'success');
    } catch (e) { toast('Ese archivo no tiene el formato del libro de deudas.', 'error'); }
  };
  r.readAsText(file);
}
