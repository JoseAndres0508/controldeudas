/* =========================================================
   MODAL genérico usado por todas las pestañas
   Accesibilidad: atrapa el foco mientras está abierto, se
   cierra con Escape, devuelve el foco al elemento que lo
   abrió y se anuncia con aria-labelledby apuntando al <h2>.
   ========================================================= */
const scrim = document.getElementById('scrim');
const modal = document.getElementById('modal');
let lastFocus = null;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

const focusables = () => [...modal.querySelectorAll(FOCUSABLE)];

export function showModal(html) {
  lastFocus = document.activeElement;
  modal.innerHTML = html;

  // El primer <h2> del modal es su título accesible.
  const title = modal.querySelector('h2');
  if (title) { title.id = 'modalTitle'; modal.setAttribute('aria-labelledby', 'modalTitle'); }
  else modal.removeAttribute('aria-labelledby');

  scrim.classList.add('open');
  document.body.style.overflow = 'hidden';   // evita que el fondo haga scroll

  const first = focusables()[0];
  (first || modal).focus();
}

export function closeModal() {
  scrim.classList.remove('open');
  modal.innerHTML = '';
  document.body.style.overflow = '';
  lastFocus?.focus();
}

export const isModalOpen = () => scrim.classList.contains('open');

export function initModal() {
  scrim.addEventListener('click', e => {
    if (e.target === scrim || e.target.hasAttribute('data-close')) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (!isModalOpen()) return;

    if (e.key === 'Escape') { closeModal(); return; }

    // Tab circular: el foco no se escapa del diálogo.
    if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });
}
