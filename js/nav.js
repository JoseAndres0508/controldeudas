import { renderInicio } from './tabs/inicio.js';

/* =========================================================
   NAVEGACIÓN ENTRE PESTAÑAS
   Sigue el patrón ARIA de tabs: sólo la pestaña activa entra
   en el orden de tabulación (roving tabindex) y las flechas
   mueven entre ellas. Los selectores apuntan a .side-nav
   explícitamente porque ahora también hay un <nav> en el pie.
   ========================================================= */
const TITLES = { inicio: 'Inicio', deudas: 'Ingresar deudas', cortes: 'Cortes', estrategia: 'Estrategia', acreedores: 'Acreedores', reportes: 'Reportes' };
const TABS = ['inicio', 'deudas', 'cortes', 'estrategia', 'acreedores', 'reportes'];

export function showTab(name) {
  if (!TABS.includes(name)) return;

  document.querySelectorAll('.side-nav button[data-tab]').forEach(b => {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  TABS.forEach(t => { document.getElementById('tab-' + t).hidden = (t !== name); });

  const title = document.getElementById('pageTitle');
  if (title) title.textContent = TITLES[name] || '';
  document.title = `${TITLES[name] || 'Inicio'} — Libro de deudas`;

  if (name === 'inicio') renderInicio();
}

export function initNav() {
  const nav = document.querySelector('.side-nav');
  if (!nav) return;

  nav.addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  nav.addEventListener('keydown', e => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const btns = [...nav.querySelectorAll('button[data-tab]')];
    const i = btns.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();

    let next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = btns.length - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % btns.length;
    else next = (i - 1 + btns.length) % btns.length;

    btns[next].focus();
    showTab(btns[next].dataset.tab);
  });
}
