import { DB } from '../state.js';
import { activeDebts, creditorName, debtById, debtProgress, debtsByCreditor, fmtBase, fmtCRC, fmtDateLong, fmtMoney, lastBalance, overallProgress, toCRC } from '../utils.js';
import { dueInfo, movementAmountHTML, movementLabel, statusDotHTML, totalChargedCRC, totalPaidCRC } from '../payments.js';
import { exportExcel, exportPDF } from '../reportExport.js';

/* =========================================================
   PESTAÑA: REPORTES
   ========================================================= */
/** Estado del buscador de movimientos (se mantiene entre renders). */
let movSearch = '';
let movFrom = '';
let movTo = '';

/** Todos los pagos que coinciden con el texto (deuda, acreedor o nota)
 *  y el rango de fechas, del más reciente al más viejo. */
function filteredMovements() {
  const term = movSearch.trim().toLowerCase();
  return DB.payments
    .filter(p => {
      if (movFrom && p.date < movFrom) return false;
      if (movTo && p.date > movTo) return false;
      if (!term) return true;
      const d = debtById(p.debtId);
      const haystack = [d ? d.name : '', d ? creditorName(d) : '', p.note || '', movementLabel(p)].join(' ').toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function renderReportes() {
  const el = document.getElementById('tab-reportes');

  const totalDebt = activeDebts().reduce((s, d) => s + toCRC(lastBalance(d.id), d.currency), 0);
  const totalPaid = totalPaidCRC();
  const totalCharged = totalChargedCRC();
  const byCreditor = debtsByCreditor();
  const vencidas = activeDebts()
    .map(d => ({ d, info: dueInfo(d) }))
    .filter(x => x.info && x.info.status === 'vencido');

  let html = '';

  html += `<div class="stat-row">
    <div class="stat"><div class="k">Total adeudado</div><div class="v">${fmtBase(totalDebt)}</div></div>
    <div class="stat"><div class="k">Total pagado (histórico)</div><div class="v">${fmtBase(totalPaid)}</div></div>
    ${totalCharged > 0 ? `<div class="stat"><div class="k">Total consumido</div><div class="v">${fmtBase(totalCharged)}</div></div>` : ''}
    <div class="stat"><div class="k">Deudas vencidas</div><div class="v">${vencidas.length}</div></div>
  </div>`;

  const overall = overallProgress();
  if (overall) {
    html += `<div class="card">
      <div class="card-head">
        <h2>Avance general</h2>
        <span class="num" style="font-size:.8125rem">${overall.pct !== null ? overall.pct.toFixed(1) + '%' : ''}</span>
      </div>
      <div class="mini-track" style="height:8px"><div class="mini-fill f-down" style="width:${overall.pct ?? 0}%"></div></div>
      <p class="dim" style="font-size:.8125rem;margin:8px 0 0">Arrancaste con <strong>${fmtBase(overall.initial)}</strong> y hoy debés <strong>${fmtBase(overall.current)}</strong>: llevás <strong style="color:var(--down)">${fmtBase(overall.paid)}</strong> pagados sobre ${overall.count} deuda${overall.count === 1 ? '' : 's'}.</p>
    </div>`;
  }

  const progRows = activeDebts()
    .map(d => ({ d, p: debtProgress(d) }))
    .sort((a, b) => (b.p?.pct ?? -1) - (a.p?.pct ?? -1));

  html += `<div class="card">
    <div class="card-head"><h2>Avance por deuda</h2></div>
    ${progRows.length ? `<table><thead><tr><th>Deuda</th><th class="ta-r hide-sm">Saldo inicial</th><th class="ta-r">Saldo actual</th><th class="ta-r hide-sm">Pagado</th><th>Avance</th></tr></thead><tbody>
      ${progRows.map(({ d, p }) => `<tr>
        <td><strong style="font-weight:500">${d.name}</strong><br><span class="dim" style="font-size:.75rem">${creditorName(d)}</span></td>
        <td class="ta-r num hide-sm">${p ? fmtMoney(p.initial, d.currency) : '<span class="chip warn">falta</span>'}</td>
        <td class="ta-r num">${fmtMoney(lastBalance(d.id), d.currency)}</td>
        <td class="ta-r num hide-sm">${p ? (p.grew ? `<span style="color:var(--up)">+${fmtMoney(p.grown, d.currency)}</span>` : `<span style="color:var(--down)">${fmtMoney(p.paid, d.currency)}</span>`) : '<span class="dim">—</span>'}</td>
        <td>${!p ? '<span class="dim">Cargá el saldo inicial</span>'
          : p.grew ? '<span class="chip vencido">creció</span>'
          : `<div style="min-width:100px"><div class="mini-track"><div class="mini-fill f-down" style="width:${p.pct ?? 0}%"></div></div><span class="num dim" style="font-size:.6875rem">${p.pct !== null ? p.pct.toFixed(1) + '%' : '—'}</span></div>`}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="empty">Todavía no hay deudas activas.</div>`}
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>Deudas por acreedor</h2></div>
    ${byCreditor.length ? `<table><thead><tr><th>Acreedor</th><th class="ta-r hide-sm">Deudas</th><th class="ta-r">Total (₡)</th></tr></thead><tbody>
      ${byCreditor.map(g => `<tr>
        <td>${g.creditor ? g.creditor.name : '<span class="dim">Sin acreedor</span>'}</td>
        <td class="ta-r num hide-sm">${g.count}</td>
        <td class="ta-r num">${fmtCRC(g.total)}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="empty">Todavía no hay deudas activas con saldo.</div>`}
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>Deudas vencidas</h2></div>
    ${vencidas.length ? `<table><thead><tr><th></th><th>Deuda</th><th class="hide-sm">Venció el</th><th class="ta-r">Saldo</th></tr></thead><tbody>
      ${vencidas.map(({ d, info }) => `<tr>
        <td>${statusDotHTML(info)}</td>
        <td>${d.name}</td>
        <td class="hide-sm num">${fmtDateLong(info.date)}</td>
        <td class="ta-r num">${fmtCRC(toCRC(lastBalance(d.id), d.currency))}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="empty">No hay deudas vencidas ahora mismo.</div>`}
  </div>`;

  const movs = filteredMovements();
  // Neto de lo listado: los pagos bajan la deuda, los consumos la suben,
  // los ajustes no son dinero movido y no entran en la suma.
  const movNetCRC = movs.reduce((s, p) => {
    const d = debtById(p.debtId);
    if (!d || p.type === 'ajuste') return s;
    return s + (p.type === 'consumo' ? 1 : -1) * toCRC(p.amount, d.currency);
  }, 0);

  html += `<div class="card">
    <div class="card-head">
      <h2>Todos los movimientos</h2>
      <span class="dim" style="font-size:.8125rem">${movs.length} movimiento${movs.length === 1 ? '' : 's'} · neto ${movNetCRC > 0 ? '+' : movNetCRC < 0 ? '−' : ''}${fmtBase(Math.abs(movNetCRC))}</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
      <div style="flex:1;min-width:180px"><label>Buscar</label><input id="movSearch" placeholder="Deuda, acreedor o nota…" value="${movSearch}"></div>
      <div><label>Desde</label><input type="date" id="movFrom" value="${movFrom}"></div>
      <div><label>Hasta</label><input type="date" id="movTo" value="${movTo}"></div>
      ${movSearch || movFrom || movTo ? '<button class="btn ghost" id="movClear">Limpiar</button>' : ''}
    </div>
    ${movs.length ? `<table><thead><tr><th>Fecha</th><th>Deuda</th><th class="hide-sm">Tipo</th><th class="hide-sm">Nota</th><th class="ta-r">Monto</th><th class="ta-r"></th></tr></thead><tbody>
      ${movs.map(p => {
        const d = debtById(p.debtId);
        return `<tr>
          <td class="num" style="font-size:.8125rem">${fmtDateLong(p.date)}</td>
          <td>${d ? d.name : '<span class="dim">(deuda borrada)</span>'}${d ? `<br><span class="dim" style="font-size:.75rem">${creditorName(d)}</span>` : ''}</td>
          <td class="hide-sm"><span class="chip">${movementLabel(p)}</span></td>
          <td class="hide-sm">${p.note ? `<span style="font-size:.8125rem">${p.note}</span>` : '<span class="dim">—</span>'}${p.receipt ? ` <a href="${p.receipt.dataUrl}" download="${p.receipt.name}" title="Descargar comprobante">📎</a>` : ''}</td>
          <td class="ta-r">${d ? movementAmountHTML(p, d.currency) : ''}</td>
          <td class="ta-r">${d ? `<button class="btn ghost" data-verdebt="${d.id}">Ver</button>` : ''}</td>
        </tr>`;
      }).join('')}
    </tbody></table>` : `<div class="empty">${DB.payments.length ? 'Ningún movimiento coincide con la búsqueda.' : 'Todavía no hay pagos registrados.'}</div>`}
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>Exportar</h2></div>
    <p class="dim" style="font-size:.8125rem;margin:0 0 12px">Generá un archivo con el estado actual para guardar o compartir.</p>
    <div class="btn-row">
      <button class="btn" id="btnExportExcel">Exportar Excel</button>
      <button class="btn" id="btnExportPDF">Exportar PDF</button>
    </div>
  </div>`;

  el.innerHTML = html;
  document.getElementById('btnExportExcel').onclick = exportExcel;
  document.getElementById('btnExportPDF').onclick = exportPDF;

  const s = document.getElementById('movSearch');
  s.oninput = () => { movSearch = s.value; renderReportes(); const n = document.getElementById('movSearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  document.getElementById('movFrom').onchange = e => { movFrom = e.target.value; renderReportes(); };
  document.getElementById('movTo').onchange = e => { movTo = e.target.value; renderReportes(); };
  const clear = document.getElementById('movClear');
  if (clear) clear.onclick = () => { movSearch = ''; movFrom = ''; movTo = ''; renderReportes(); };
}
