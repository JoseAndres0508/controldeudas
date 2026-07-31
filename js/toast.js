/* =========================================================
   TOASTS
   Mensajes cortos de confirmación/error que reemplazan a los
   alert() nativos del navegador.
   ========================================================= */
let container = null;
function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-wrap';
  document.body.appendChild(container);
  return container;
}

/** type: 'info' (por defecto) | 'success' | 'error' */
export function toast(message, type = 'info') {
  const wrap = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 3200);
}
