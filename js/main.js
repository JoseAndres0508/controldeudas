import { DB, save, setDB } from './state.js';
import { renderAll } from './render-all.js';
import { initModal } from './modal.js';
import { initNav, showTab } from './nav.js';
import { openCut } from './tabs/cortes.js';
import { openDebt, openDebtDetail } from './tabs/deudas.js';
import { renderEstrategia } from './tabs/estrategia.js';
import { openCreditor } from './tabs/acreedores.js';
import { openPago, openQuickPago } from './payments.js';
import { exportJSON, importJSON, openSettings } from './settings.js';
import { getStatus, readFile, tryRestore } from './fileSync.js';
import { initGlobalSearch } from './globalSearch.js';
import { initAppearance, onThemeChange } from './appearance.js';
import { drawCharts } from './tabs/historial.js';

/* =========================================================
   PUNTO DE ARRANQUE
   Conecta los módulos entre sí, cablea los eventos globales
   y dispara el primer render.
   ========================================================= */
initAppearance();
initModal();
initNav();
initGlobalSearch();

/* Los gráficos llevan colores calculados en JS: al cambiar de tema o de
   tamaño de letra hay que volver a dibujarlos con la paleta nueva. */
onThemeChange(() => { if (!document.getElementById('tab-inicio').hidden) drawCharts(); });

document.body.addEventListener('click', e => {
  const t = e.target.closest('[data-newcut],[data-editcut],[data-editdebt],[data-strat],[data-goto],[data-editcreditor],[data-pagar],[data-consumo],[data-ajuste],[data-verdebt],[data-newdebt],[data-quickpago],[data-quickconsumo]');
  if (!t) return;
  if (t.hasAttribute('data-newcut')) openCut(t.dataset.newcut || null, null);
  else if (t.hasAttribute('data-editcut')) openCut(null, t.dataset.editcut);
  else if (t.hasAttribute('data-editdebt')) openDebt(t.dataset.editdebt);
  else if (t.hasAttribute('data-strat')) { DB.settings.strategy = t.dataset.strat; save(); renderEstrategia(); }
  else if (t.hasAttribute('data-goto')) showTab(t.dataset.goto);
  else if (t.hasAttribute('data-editcreditor')) openCreditor(t.dataset.editcreditor);
  else if (t.hasAttribute('data-pagar')) openPago(t.dataset.pagar, () => renderAll(), 'pago');
  else if (t.hasAttribute('data-consumo')) openPago(t.dataset.consumo, () => renderAll(), 'consumo');
  else if (t.hasAttribute('data-ajuste')) openPago(t.dataset.ajuste, () => renderAll(), 'ajuste');
  else if (t.hasAttribute('data-verdebt')) openDebtDetail(t.dataset.verdebt);
  else if (t.hasAttribute('data-newdebt')) openDebt(null);
  else if (t.hasAttribute('data-quickpago')) openQuickPago(() => renderAll(), 'pago');
  else if (t.hasAttribute('data-quickconsumo')) openQuickPago(() => renderAll(), 'consumo');
});
document.body.addEventListener('click', e => {
  if (e.target.id === 'btnNewDebt') openDebt(null);
  else if (e.target.id === 'btnNewCreditor') openCreditor(null);
});

/* Cierra los menús "⋯" de las filas al hacer clic fuera o al elegir una acción. */
document.body.addEventListener('click', e => {
  const inside = e.target.closest('.row-menu');
  document.querySelectorAll('.row-menu[open]').forEach(m => {
    if (m !== inside || e.target.closest('.row-menu-pop')) m.open = false;
  });
});

const pickImportFile = () => document.getElementById('fileImport').click();

document.getElementById('btnExport').onclick = exportJSON;
document.getElementById('btnImport').onclick = pickImportFile;
document.getElementById('fileImport').onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); };
document.getElementById('btnSettings').onclick = openSettings;

/* Atajos del pie de página. Usan data-act en vez de repetir los id de
   arriba, porque un id duplicado rompería getElementById. */
const FOOT_ACTIONS = { export: exportJSON, import: pickImportFile, settings: openSettings };
document.body.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && FOOT_ACTIONS[b.dataset.act]) FOOT_ACTIONS[b.dataset.act]();
});

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
