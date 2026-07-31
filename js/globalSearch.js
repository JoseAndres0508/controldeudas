import { DB } from './state.js';
import { creditorName, fmtMoney, lastBalance } from './utils.js';
import { showTab } from './nav.js';
import { openDebtDetail } from './tabs/deudas.js';
import { openCreditor } from './tabs/acreedores.js';

/* =========================================================
   BUSCADOR GLOBAL
   Busca por nombre de deuda o de acreedor desde cualquier
   pestaña (input fijo en la barra lateral) y salta directo
   al detalle correspondiente.
   ========================================================= */
function results(q) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const debtHits = DB.debts
    .filter(d => d.name.toLowerCase().includes(term))
    .slice(0, 6)
    .map(d => ({ type: 'deuda', id: d.id, label: d.name, sub: `${creditorName(d) || 'Sin acreedor'} · ${fmtMoney(lastBalance(d.id), d.currency)}` }));
  const creditorHits = DB.creditors
    .filter(c => c.name.toLowerCase().includes(term))
    .slice(0, 4)
    .map(c => ({ type: 'acreedor', id: c.id, label: c.name, sub: 'Acreedor' }));
  return [...debtHits, ...creditorHits];
}

export function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const box = document.getElementById('globalSearchResults');
  if (!input || !box) return;

  function render() {
    const list = results(input.value);
    if (!input.value.trim()) { box.classList.remove('open'); box.innerHTML = ''; return; }
    box.innerHTML = list.length
      ? list.map(r => `<button type="button" class="search-item" data-r-type="${r.type}" data-r-id="${r.id}">
          <div class="k">${r.type}</div>
          <div class="v">${r.label}<br><span class="dim" style="font-size:11px">${r.sub}</span></div>
        </button>`).join('')
      : `<div class="search-empty">Sin resultados.</div>`;
    box.classList.add('open');
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) { box.classList.remove('open'); }
  });

  box.addEventListener('click', e => {
    const btn = e.target.closest('[data-r-type]');
    if (!btn) return;
    const { rType, rId } = btn.dataset;
    box.classList.remove('open');
    input.value = '';
    if (rType === 'deuda') { showTab('deudas'); openDebtDetail(rId); }
    else if (rType === 'acreedor') { showTab('acreedores'); openCreditor(rId); }
  });
}
