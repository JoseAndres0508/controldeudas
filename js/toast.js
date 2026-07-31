/* =========================================================
   TOASTS
   Mensajes cortos de confirmación/error que reemplazan a los
   alert() nativos del navegador. El contenedor es una región
   aria-live, así que un lector de pantalla los anuncia sin
   robarle el foco al usuario.
   ========================================================= */
let container = null;
function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-wrap';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

/** type: 'info' (por defecto) | 'success' | 'error' */
export function toast(message, type = 'info') {
  const wrap = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  // Los errores interrumpen la lectura; el resto espera su turno.
  if (type === 'error') el.setAttribute('role', 'alert');
  el.textContent = message;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 3200);
}
