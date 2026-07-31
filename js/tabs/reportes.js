import { activeDebts, debtsByCreditor, fmtCRC, fmtDateLong, lastBalance, toCRC } from '../utils.js';
import { dueInfo, STATUS_LABEL, totalPaidCRC } from '../payments.js';
import { exportExcel, exportPDF } from '../reportExport.js';

/* =========================================================
   PESTAÑA: REPORTES
   ========================================================= */
export function renderReportes() {
  const el = document.getElementById('tab-reportes');

  const totalDebt = activeDebts().reduce((s, d) => s + toCRC(lastBalance(d.id), d.currency), 0);
  const totalPaid = totalPaidCRC();
  const byCreditor = debtsByCreditor();
  const vencidas = activeDebts()
    .map(d => ({ d, info: dueInfo(d) }))
    .filter(x => x.info && x.info.status === 'vencido');

  let html = '';

  html += `<div class="stat-row">
    <div class="stat"><div class="k">Total adeudado</div><div class="v">${fmtCRC(totalDebt)}</div></div>
    <div class="stat"><div class="k">Total pagado (histórico)</div><div class="v">${fmtCRC(totalPaid)}</div></div>
    <div class="stat"><div class="k">Deudas vencidas</div><div class="v">${vencidas.length}</div></div>
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
        <td><span class="dot vencido" title="${STATUS_LABEL.vencido}"></span></td>
        <td>${d.name}</td>
        <td class="hide-sm num">${fmtDateLong(info.date)}</td>
        <td class="ta-r num">${fmtCRC(toCRC(lastBalance(d.id), d.currency))}</td>
      </tr>`).join('')}
    </tbody></table>` : `<div class="empty">No hay deudas vencidas ahora mismo.</div>`}
  </div>`;

  html += `<div class="card">
    <div class="card-head"><h2>Exportar</h2></div>
    <p class="dim" style="font-size:13px;margin:0 0 12px">Generá un archivo con el estado actual para guardar o compartir.</p>
    <div class="btn-row">
      <button class="btn" id="btnExportExcel">Exportar Excel</button>
      <button class="btn" id="btnExportPDF">Exportar PDF</button>
    </div>
  </div>`;

  el.innerHTML = html;
  document.getElementById('btnExportExcel').onclick = exportExcel;
  document.getElementById('btnExportPDF').onclick = exportPDF;
}
