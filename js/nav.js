import { renderInicio } from './tabs/inicio.js';

/* =========================================================
   NAVEGACIÓN ENTRE PESTAÑAS
   ========================================================= */
export function showTab(name) {
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  ['inicio', 'deudas', 'cortes'].forEach(t => document.getElementById('tab-' + t).hidden = (t !== name));
  if (name === 'inicio') renderInicio();
}

export function initNav() {
  document.querySelector('nav').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
}
