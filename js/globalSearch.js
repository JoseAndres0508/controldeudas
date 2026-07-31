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

  const setOpen = open => {
    box.classList.toggle('open', open);
    input.setAttribute('aria-expanded', String(open));
  };

  function render() {
    const list = results(input.value);
    if (!input.value.trim()) { setOpen(false); box.innerHTML = ''; return; }
    box.innerHTML = list.length
      ? list.map(r => `<button type="button" role="option" aria-selected="false" class="search-item" data-r-type="${r.type}" data-r-id="${r.id}">
          <div class="k">${r.type}</div>
          <div class="v">${r.label}<br><span class="dim" style="font-size:.6875rem">${r.sub}</span></div>
        </button>`).join('')
      : `<div class="search-empty">Sin resultados.</div>`;
    setOpen(true);
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) setOpen(false);
  });

  // Teclado: flechas para recorrer los resultados, Escape para cerrar.
  input.addEventListener('keydown', e => {
    const items = [...box.querySelectorAll('.search-item')];
    if (e.key === 'Escape') { setOpen(false); input.blur(); return; }
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[0].focus(); }
  });
  box.addEventListener('keydown', e => {
    const items = [...box.querySelectorAll('.search-item')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { setOpen(false); input.focus(); return; }
    if (e.key === 'ArrowDown' && i > -1) { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp' && i > -1) {
      e.preventDefault();
      if (i === 0) input.focus(); else items[i - 1].focus();
    }
  });

  box.addEventListener('click', e => {
    const btn = e.target.closest('[data-r-type]');
    if (!btn) return;
    const { rType, rId } = btn.dataset;
    setOpen(false);
    input.value = '';
    if (rType === 'deuda') { showTab('deudas'); openDebtDetail(rId); }
    else if (rType === 'acreedor') { showTab('acreedores'); openCreditor(rId); }
  });
}
