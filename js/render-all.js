import { renderHeader, renderTape } from './header.js';
import { renderInicio } from './tabs/inicio.js';
import { renderCortes } from './tabs/cortes.js';
import { renderDeudas } from './tabs/deudas.js';

/* Punto único que refresca toda la interfaz tras cualquier cambio. */
export function renderAll() {
  renderHeader();
  renderTape();
  renderCortes();
  renderDeudas();
  if (!document.getElementById('tab-inicio').hidden) renderInicio();
}
