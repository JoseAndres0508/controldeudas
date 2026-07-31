import { renderHeader, renderTape } from './header.js';
import { renderCortes } from './tabs/cortes.js';
import { renderDeudas } from './tabs/deudas.js';
import { renderEstrategia } from './tabs/estrategia.js';
import { renderHistorial } from './tabs/historial.js';

/* Punto único que refresca toda la interfaz tras cualquier cambio. */
export function renderAll() {
  renderHeader();
  renderTape();
  renderCortes();
  renderDeudas();
  renderEstrategia();
  if (!document.getElementById('tab-historial').hidden) renderHistorial();
}
