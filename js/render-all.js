import { renderInicio } from './tabs/inicio.js';
import { renderCortes } from './tabs/cortes.js';
import { renderDeudas } from './tabs/deudas.js';
import { renderEstrategia } from './tabs/estrategia.js';
import { renderAcreedores } from './tabs/acreedores.js';
import { renderReportes } from './tabs/reportes.js';
import { renderHeaderPulse } from './header.js';

/* Punto único que refresca toda la interfaz tras cualquier cambio. */
export function renderAll() {
  renderHeaderPulse();
  renderCortes();
  renderDeudas();
  renderEstrategia();
  renderAcreedores();
  renderReportes();
  if (!document.getElementById('tab-inicio').hidden) renderInicio();
}
