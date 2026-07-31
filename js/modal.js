/* =========================================================
   MODAL genérico usado por todas las pestañas
   ========================================================= */
const scrim = document.getElementById('scrim');
const modal = document.getElementById('modal');
let lastFocus = null;

export function showModal(html) {
  lastFocus = document.activeElement;
  modal.innerHTML = html;
  scrim.classList.add('open');
  const f = modal.querySelector('input,select,textarea,button');
  f?.focus();
}

export function closeModal() {
  scrim.classList.remove('open');
  modal.innerHTML = '';
  lastFocus?.focus();
}

export function initModal() {
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.hasAttribute('data-close')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && scrim.classList.contains('open')) closeModal(); });
}
