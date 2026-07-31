import { activeDebts, debtReductions, fmtCRC, fmtDateLong, lastBalance, toCRC } from '../utils.js';
import { strategySectionHTML, wireStrategySection } from './estrategia.js';
import { chartsSectionHTML, drawCharts } from './historial.js';

/* =========================================================
   PESTAÑA: INICIO
   El dashboard general: deudas más altas, cuál bajó más,
   hacia dónde apuntar el dinero extra (estrategia) y el
   histórico de cortes (gráficos).
   ========================================================= */
export function renderInicio() {
  const el = document.getElementById('tab-inicio');

  const ranked = activeDebts()
    .map(d => ({ d, crc: toCRC(lastBalance(d.id), d.currency) }))
    .filter(x => x.crc > 0)
    .sort((a, b) => b.crc - a.crc);
  const top = ranked.slice(0, 5);

  const reductions = debtReductions().filter(x => x.reduction > 0).sort((a, b) => b.reduction - a.reduction);
  const best = reductions[0];

  let html = '';

  html += `<div class="grid g2" style="margin-bottom:14px">`;

  html += `<div class="card">
    <div class="card-head"><h2>Deudas más altas</h2></div>
    ${top.length ? `<table><thead><tr><th></th><th>Deuda</th><th class="ta-r">Saldo (₡)</th></tr></thead><tbody>
      ${top.map((x, i) => `<tr>
        <td class="rank ${i === 0 ? 'first' : ''}">${String(i + 1).padStart(2, '0')}</td>
        <td>${x.d.name}<br><span class="dim" style="font-size:12px">${x.d.issuer || ''}</span></td>
        <td class="ta-r num">${fmtCRC(x.crc)}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="empty">Todavía no hay deudas activas con saldo.</div>`}
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>La que más bajó</h2></div>
    ${best ? `<p style="margin:0 0 10px;font-size:14px"><strong style="font-weight:500">${best.d.name}</strong> bajó <strong style="color:var(--down)">${fmtCRC(best.reduction)}</strong> desde el ${fmtDateLong(best.firstDate)}.</p>
      ${reductions.length > 1 ? `<table><thead><tr><th>Deuda</th><th class="ta-r">Bajó (₡)</th></tr></thead><tbody>
        ${reductions.slice(0, 5).map(x => `<tr><td>${x.d.name}</td><td class="ta-r num" style="color:var(--down)">${fmtCRC(x.reduction)}</td></tr>`).join('')}
      </tbody></table>` : ''}` : `<div class="empty">Todavía no hay suficientes cortes para medir avances por deuda.</div>`}
  </div>`;

  html += `</div>`;

  html += strategySectionHTML();
  html += chartsSectionHTML();

  el.innerHTML = html;
  wireStrategySection(renderInicio);
  drawCharts();
}
