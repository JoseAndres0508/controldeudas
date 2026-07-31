import { DB, save, setDB } from './state.js';
import { buildSeed } from './seed.js';
import { Store } from './store.js';
import { parseNum } from './utils.js';
import { closeModal, showModal } from './modal.js';
import { renderAll } from './render-all.js';

/* =========================================================
   AJUSTES / RESPALDO
   ========================================================= */
export function openSettings() {
  showModal(`
    <h2>Ajustes</h2>
    <div class="grid g2">
      <div><label>Tipo de cambio ₡ por $1</label><input class="num-in" id="sFx" value="${DB.settings.fx || 512}" inputmode="decimal"></div>
    </div>
    <p class="muted" style="font-size:13px;margin:12px 0 0">Se usa para convertir las deudas en dólares y poder sumarlas y ordenarlas junto a las de colones.</p>
    <hr style="margin:18px 0">
    <h3 style="margin-bottom:6px">Datos</h3>
    <p class="muted" style="font-size:13px;margin:0 0 12px">${Store.persistent ? 'Se guardan en este navegador. Exportá de vez en cuando: si limpiás datos del sitio, se borran.' : 'Este navegador bloqueó el almacenamiento local. Exportá antes de cerrar.'}</p>
    <div class="btn-row">
      <button class="btn danger" id="sReset">Borrar todo y volver a la semilla</button>
    </div>
    <div class="modal-foot"><button class="btn" data-close>Cerrar</button><button class="btn primary" id="sSave">Guardar</button></div>
  `);
  document.getElementById('sSave').onclick = () => {
    DB.settings.fx = parseNum(document.getElementById('sFx').value) || 512;
    save(); closeModal(); renderAll();
  };
  document.getElementById('sReset').onclick = () => {
    if (!confirm('Esto borra todos tus cortes y deudas y vuelve a los datos de ejemplo. ¿Seguro?')) return;
    setDB(buildSeed()); save(); closeModal(); renderAll();
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
    } catch (e) { alert('Ese archivo no tiene el formato del libro de deudas.'); }
  };
  r.readAsText(file);
}
