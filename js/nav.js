import { renderHistorial } from './tabs/historial.js';

/* =========================================================
   NAVEGACIÓN ENTRE PESTAÑAS
   ========================================================= */
export function showTab(name) {
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  ['cortes', 'deudas', 'estrategia', 'historial'].forEach(t => document.getElementById('tab-' + t).hidden = (t !== name));
  if (name === 'historial') renderHistorial();
}

export function initNav() {
  document.querySelector('nav').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
}
