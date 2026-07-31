import { DB, save, setDB } from './state.js';
import { renderAll } from './render-all.js';
import { initModal } from './modal.js';
import { initNav, showTab } from './nav.js';
import { openCut } from './tabs/cortes.js';
import { openDebt } from './tabs/deudas.js';
import { renderInicio } from './tabs/inicio.js';
import { exportJSON, importJSON, openSettings } from './settings.js';
import { getStatus, readFile, tryRestore } from './fileSync.js';

/* =========================================================
   PUNTO DE ARRANQUE
   Conecta los módulos entre sí, cablea los eventos globales
   y dispara el primer render.
   ========================================================= */
initModal();
initNav();

document.body.addEventListener('click', e => {
  const t = e.target.closest('[data-newcut],[data-editcut],[data-editdebt],[data-strat],[data-goto]');
  if (!t) return;
  if (t.hasAttribute('data-newcut')) openCut(t.dataset.newcut || null, null);
  else if (t.hasAttribute('data-editcut')) openCut(null, t.dataset.editcut);
  else if (t.hasAttribute('data-editdebt')) openDebt(t.dataset.editdebt);
  else if (t.hasAttribute('data-strat')) { DB.settings.strategy = t.dataset.strat; save(); renderInicio(); }
  else if (t.hasAttribute('data-goto')) showTab(t.dataset.goto);
});
document.body.addEventListener('click', e => { if (e.target.id === 'btnNewDebt') openDebt(null); });

document.getElementById('btnExport').onclick = exportJSON;
document.getElementById('btnImport').onclick = () => document.getElementById('fileImport').click();
document.getElementById('fileImport').onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); };
document.getElementById('btnSettings').onclick = openSettings;

/** Al arrancar: si hay un archivo conectado y con permiso vigente,
 *  lo lee y lo toma como fuente de verdad antes del primer render. */
async function boot() {
  await tryRestore();
  if (getStatus() === 'connected') {
    const data = await readFile();
    if (data && data.debts && data.periods) setDB(data);
    save();
  }
  renderAll();
}
boot();
