import { DB } from '../state.js';
import { activeDebts, debtById, debtReductions, fmtBase, fmtCRC, fmtDateLong, lastBalance, overallProgress, toCRC } from '../utils.js';
import { heroHTML, tapeHTML } from '../header.js';
import { simulate } from './estrategia.js';
import { chartsSectionHTML, drawCharts } from './historial.js';
import { dueInfo, movementAmountHTML, movementLabel, recentPayments, statusDotHTML, STATUS_LABEL } from '../payments.js';

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

  html += `<div class="btn-row" style="margin-bottom:14px">
    <button class="btn primary" data-newdebt>+ Agregar deuda</button>
    <button class="btn" data-quickpago>Registrar pago</button>
    <button class="btn" data-quickconsumo>Registrar consumo</button>
    <button class="btn" data-goto="estrategia">Ver estrategia</button>
  </div>`;

  const overall = overallProgress();
  html += `<div class="stat-row">
    <div class="stat"><div class="k">Libre en</div><div class="v">${sim && sim.reached ? sim.months + ' meses' : '—'}</div></div>
    <div class="stat"><div class="k">Avance total</div><div class="v">${overall && overall.pct !== null ? overall.pct.toFixed(1) + '%' : '—'}</div></div>
    <div class="stat"><div class="k">La que más bajó</div><div class="v" style="font-size:.9375rem">${best ? best.d.name : '—'}</div></div>
  </div>`;

  if (overall && overall.pct !== null) {
    html += `<div class="card">
      <div class="card-head"><h2>Avance desde el inicio</h2><span class="num" style="font-size:.8125rem">${overall.pct.toFixed(1)}%</span></div>
      <div class="mini-track" style="height:8px"><div class="mini-fill f-down" style="width:${overall.pct}%"></div></div>
      <p class="dim" style="font-size:.8125rem;margin:8px 0 0">De <strong>${fmtBase(overall.initial)}</strong> iniciales llevás <strong style="color:var(--down)">${fmtBase(overall.paid)}</strong> pagados. Quedan ${fmtBase(overall.current)}.</p>
    </div>`;
  }

  const dues = activeDebts()
    .map(d => ({ d, info: dueInfo(d) }))
    .filter(x => x.info && (x.info.status === 'vencido' || x.info.status === 'proximo'))
    .sort((a, b) => (a.info.status === b.info.status ? a.info.date.localeCompare(b.info.date) : a.info.status === 'vencido' ? -1 : 1));

  const duesCard = dues.length ? `<div class="card">
      <div class="card-head"><h2>Pagos próximos y vencidos</h2></div>
      ${dues.map(({ d, info }) => `<div class="mini-row">
          ${statusDotHTML(info)}
          <div class="mini-main"><p class="mini-name">${d.name}</p><span class="dim" style="font-size:.75rem">${STATUS_LABEL[info.status]} · ${fmtDateLong(info.date)}</span></div>
          <button class="btn ghost" data-pagar="${d.id}">Pagar</button>
        </div>`).join('')}
    </div>` : null;

  const topCard = `<div class="card">
    <div class="card-head"><h2>Deudas más altas</h2></div>
    ${top.length ? top.map((x, i) => { const info = dueInfo(x.d); return `<div class="mini-row">
        <span class="rank ${i === 0 ? 'first' : ''}">${String(i + 1).padStart(2, '0')}</span>
        ${statusDotHTML(info)}
        <div class="mini-main">
          <p class="mini-name">${x.d.name}</p>
          <div class="mini-track"><div class="mini-fill ${i === 0 ? 'f-first' : ''}" style="width:${Math.round((x.crc / maxCRC) * 100)}%"></div></div>
        </div>
        <span class="mini-val num">${fmtCRC(x.crc)}</span>
      </div>`; }).join('') : `<div class="empty">Todavía no hay deudas activas con saldo.</div>`}
  </div>`;

  // Dos tarjetas por fila en vez de apiladas: agrupa alertas + ranking,
  // y avance + actividad reciente, para que el dashboard no sea una
  // columna interminable de tarjetas.
  html += duesCard ? `<div class="grid g2">${duesCard}${topCard}</div>` : topCard;

  const bestCard = `<div class="card">
    <div class="card-head"><h2>La que más bajó</h2></div>
    ${best ? `<p style="margin:0 0 10px;font-size:.875rem"><strong style="font-weight:500">${best.d.name}</strong> bajó <strong style="color:var(--down)">${fmtCRC(best.reduction)}</strong> desde el ${fmtDateLong(best.firstDate)}.</p>
      ${reductions.length > 1 ? reductions.slice(0, 5).map(x => `<div class="mini-row">
          <div class="mini-main"><p class="mini-name">${x.d.name}</p>
            <div class="mini-track"><div class="mini-fill f-down" style="width:${Math.round((x.reduction / reductions[0].reduction) * 100)}%"></div></div>
          </div>
          <span class="mini-val num" style="color:var(--down)">${fmtCRC(x.reduction)}</span>
        </div>`).join('') : ''}` : `<div class="empty">Todavía no hay suficientes cortes para medir avances por deuda.</div>`}
  </div>`;

  const recent = recentPayments(6);
  const recentCard = `<div class="card">
    <div class="card-head"><h2>Últimos movimientos</h2></div>
    ${recent.length ? recent.map(p => {
      const d = debtById(p.debtId);
      return `<div class="mini-row">
        <div class="mini-main"><p class="mini-name">${d ? d.name : '(deuda borrada)'}</p><span class="dim" style="font-size:.75rem">${fmtDateLong(p.date)} · ${movementLabel(p)}${p.note ? ' · ' + p.note : ''}</span></div>
        <span class="mini-val">${d ? movementAmountHTML(p, d.currency) : ''}</span>
      </div>`;
    }).join('') : `<div class="empty">Todavía no hay pagos registrados.</div>`}
  </div>`;

  html += `<div class="grid g2">${bestCard}${recentCard}</div>`;

  html += tapeHTML();
  html += chartsSectionHTML();

  el.innerHTML = html;
  drawCharts();
}
