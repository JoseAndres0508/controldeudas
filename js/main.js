import { DB, save, setDB } from './state.js';
import { renderAll } from './render-all.js';
import { initModal } from './modal.js';
import { initNav, showTab } from './nav.js';
import { openCut } from './tabs/cortes.js';
import { openDebt, openDebtDetail } from './tabs/deudas.js';
import { renderInicio } from './tabs/inicio.js';
import { openCreditor } from './tabs/acreedores.js';
import { openPago, openQuickPago } from './payments.js';
import { exportJSON, importJSON, openSettings } from './settings.js';
import { getStatus, readFile, tryRestore } from './fileSync.js';
import { initGlobalSearch } from './globalSearch.js';

/* =========================================================
   PUNTO DE ARRANQUE
   Conecta los módulos entre sí, cablea los eventos globales
   y dispara el primer render.
   ========================================================= */
initModal();
initNav();
initGlobalSearch();

document.body.addEventListener('click', e => {
  const t = e.target.closest('[data-newcut],[data-editcut],[data-editdebt],[data-strat],[data-goto],[data-editcreditor],[data-pagar],[data-verdebt],[data-newdebt],[data-quickpago]');
  if (!t) return;
  if (t.hasAttribute('data-newcut')) openCut(t.dataset.newcut || null, null);
  else if (t.hasAttribute('data-editcut')) openCut(null, t.dataset.editcut);
  else if (t.hasAttribute('data-editdebt')) openDebt(t.dataset.editdebt);
  else if (t.hasAttribute('data-strat')) { DB.settings.strategy = t.dataset.strat; save(); renderInicio(); }
  else if (t.hasAttribute('data-goto')) showTab(t.dataset.goto);
  else if (t.hasAttribute('data-editcreditor')) openCreditor(t.dataset.editcreditor);
  else if (t.hasAttribute('data-pagar')) openPago(t.dataset.pagar, () => renderAll());
  else if (t.hasAttribute('data-verdebt')) openDebtDetail(t.dataset.verdebt);
  else if (t.hasAttribute('data-newdebt')) openDebt(null);
  else if (t.hasAttribute('data-quickpago')) openQuickPago(() => renderAll());
});
document.body.addEventListener('click', e => {
  if (e.target.id === 'btnNewDebt') openDebt(null);
  else if (e.target.id === 'btnNewCreditor') openCreditor(null);
});

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
