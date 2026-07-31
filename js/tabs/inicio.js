import { DB } from '../state.js';
import { activeDebts, debtReductions, fmtCRC, fmtDateLong, lastBalance, toCRC } from '../utils.js';
import { heroHTML, tapeHTML } from '../header.js';
import { simulate, strategySectionHTML, wireStrategySection } from './estrategia.js';
import { chartsSectionHTML, drawCharts } from './historial.js';

/* =========================================================
   PESTAÑA: INICIO
   El dashboard general: total y cinta de cortes, hacia dónde
   apuntar el dinero extra, deudas más altas, cuál bajó más,
   y el histórico completo.
   ========================================================= */
export function renderInicio() {
  const el = document.getElementById('tab-inicio');

  const ranked = activeDebts()
    .map(d => ({ d, crc: toCRC(lastBalance(d.id), d.currency) }))
    .filter(x => x.crc > 0)
    .sort((a, b) => b.crc - a.crc);
  const top = ranked.slice(0, 5);
  const maxCRC = top.length ? top[0].crc : 1;

  const reductions = debtReductions().filter(x => x.reduction > 0).sort((a, b) => b.reduction - a.reduction);
  const best = reductions[0];

  const strategy = DB.settings.strategy || 'avalancha';
  const sim = simulate(strategy, DB.settings.extra || 0);

  let html = '';

  html += heroHTML();

  html += `<div class="stat-row">
    <div class="stat"><div class="k">Libre en</div><div class="v">${sim && sim.reached ? sim.months + ' meses' : '—'}</div></div>
    <div class="stat"><div class="k">La que más bajó</div><div class="v" style="font-size:15px">${best ? best.d.name : '—'}</div></div>
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>Deudas más altas</h2></div>
    ${top.length ? top.map((x, i) => `<div class="mini-row">
        <span class="rank ${i === 0 ? 'first' : ''}">${String(i + 1).padStart(2, '0')}</span>
        <div class="mini-main">
          <p class="mini-name">${x.d.name}</p>
          <div class="mini-track"><div class="mini-fill ${i === 0 ? 'f-first' : ''}" style="width:${Math.round((x.crc / maxCRC) * 100)}%"></div></div>
        </div>
        <span class="mini-val num">${fmtCRC(x.crc)}</span>
      </div>`).join('') : `<div class="empty">Todavía no hay deudas activas con saldo.</div>`}
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>La que más bajó</h2></div>
    ${best ? `<p style="margin:0 0 10px;font-size:14px"><strong style="font-weight:500">${best.d.name}</strong> bajó <strong style="color:var(--down)">${fmtCRC(best.reduction)}</strong> desde el ${fmtDateLong(best.firstDate)}.</p>
      ${reductions.length > 1 ? reductions.slice(0, 5).map(x => `<div class="mini-row">
          <div class="mini-main"><p class="mini-name">${x.d.name}</p>
            <div class="mini-track"><div class="mini-fill f-down" style="width:${Math.round((x.reduction / reductions[0].reduction) * 100)}%"></div></div>
          </div>
          <span class="mini-val num" style="color:var(--down)">${fmtCRC(x.reduction)}</span>
        </div>`).join('') : ''}` : `<div class="empty">Todavía no hay suficientes cortes para medir avances por deuda.</div>`}
  </div>`;

  html += tapeHTML();
  html += strategySectionHTML();
  html += chartsSectionHTML();

  el.innerHTML = html;
  wireStrategySection(renderInicio);
  drawCharts();
}
