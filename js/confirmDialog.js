import { closeModal, showModal } from './modal.js';

/* =========================================================
   CONFIRMACIÓN
   Reemplaza al confirm() nativo del navegador con un modal
   propio, consistente con el resto de la interfaz.
   Devuelve una Promise<boolean>: true si confirmó.
   ========================================================= */
export function confirmDialog(message, { confirmLabel = 'Eliminar', danger = true } = {}) {
  return new Promise(resolve => {
    showModal(`
      <h2>Confirmar</h2>
      <p style="font-size:.875rem;margin:0">${message}</p>
      <div class="modal-foot">
        <button class="btn" id="cfNo">Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" id="cfYes">${confirmLabel}</button>
      </div>
    `);
    document.getElementById('cfNo').onclick = () => { closeModal(); resolve(false); };
    document.getElementById('cfYes').onclick = () => { closeModal(); resolve(true); };
  });
}
