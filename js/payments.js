import { DB, save } from './state.js';
import { debtById, fmtDateLong, fmtMoney, parseNum } from './utils.js';
import { uid } from './uid.js';
import { closeModal, showModal } from './modal.js';

/* =========================================================
   PAGOS
   Registros individuales de abono, separados de los cortes.
   Cada pago reduce el saldo "actual" de su deuda (ver
   lastBalance en utils.js) hasta que un corte nuevo lo confirme.
   ========================================================= */
export const paymentsForDebt = debtId =>
  DB.payments.filter(p => p.debtId === debtId).sort((a, b) => b.date.localeCompare(a.date));

/* =========================================================
   VENCIMIENTOS
   A partir del "día de pago" (dueDay) de cada deuda, calcula
   si está al día, próxima a vencer o vencida.
   ========================================================= */
const WARN_DAYS = 5;
export const STATUS_LABEL = { aldia: 'Al día', proximo: 'Próximo a vencer', vencido: 'Vencido' };

function dueDateInMonth(dueDay, ref) {
  const y = ref.getFullYear(), m = ref.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(dueDay, daysInMonth));
}

/** Devuelve {status, date} según el día de pago configurado, o null si no hay dato. */
export function dueInfo(d) {
  if (!d.dueDay) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let due = dueDateInMonth(d.dueDay, today);
  let status;
  if (due < today) {
    const dueISO = due.toISOString().slice(0, 10);
    const paid = paymentsForDebt(d.id).some(p => p.date >= dueISO);
    if (!paid) {
      status = 'vencido';
    } else {
      const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      due = dueDateInMonth(d.dueDay, next);
      status = Math.round((due - today) / 86400000) <= WARN_DAYS ? 'proximo' : 'aldia';
    }
  } else {
    status = Math.round((due - today) / 86400000) <= WARN_DAYS ? 'proximo' : 'aldia';
  }
  return { status, date: due.toISOString().slice(0, 10) };
}

/** Estado general de una deuda para el filtro de "Ingresar deudas":
 *  pagada (archivada o saldo en cero), vencida (pago atrasado) o activa. */
export function debtStatus(d, crcBalance) {
  if (d.archived || (crcBalance !== undefined && crcBalance <= 0)) return 'pagada';
  const info = dueInfo(d);
  if (info && info.status === 'vencido') return 'vencida';
  return 'activa';
}

export function registerPayment({ debtId, date, amount, note }) {
  DB.payments.push({ id: uid(), debtId, date, amount, note: note || '' });
  save();
}

export function deletePayment(id) {
  DB.payments = DB.payments.filter(p => p.id !== id);
  save();
}

/** Fragmento de historial de pagos de una deuda, con botón de borrar por fila. */
export function paymentsHistoryHTML(debtId) {
  const list = paymentsForDebt(debtId);
  const d = debtById(debtId);
  if (!list.length) return `<p class="dim" style="font-size:13px;margin:8px 0 0">Todavía no hay pagos registrados para esta deuda.</p>`;
  return `<div style="margin-top:8px">
    ${list.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--rule-soft)">
      <div>
        <span class="num" style="font-size:13px">${fmtDateLong(p.date)}</span>
        ${p.note ? `<span class="dim" style="font-size:12px"> · ${p.note}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="num" style="font-size:13px;color:var(--down)">${fmtMoney(p.amount, d.currency)}</span>
        <button type="button" class="btn ghost" data-delpay="${p.id}" style="padding:2px 6px">✕</button>
      </div>
    </div>`).join('')}
  </div>`;
}

/** Conecta los botones de borrar de paymentsHistoryHTML(); llamar tras insertarlo en el DOM. */
export function wirePaymentsHistory(rerender) {
  document.querySelectorAll('[data-delpay]').forEach(btn => {
    btn.onclick = () => { deletePayment(btn.dataset.delpay); rerender(); };
  });
}

/** Modal rápido para registrar un pago de una deuda puntual. */
export function openPago(debtId, onDone) {
  const d = debtById(debtId);
  if (!d) return;
  showModal(`
    <h2>Registrar pago — ${d.name}</h2>
    <div class="grid g2">
      <div><label>Fecha</label><input type="date" id="pDate" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div><label>Monto ${d.currency === 'USD' ? '($)' : '(₡)'}</label><input class="num-in" id="pAmount" placeholder="0" inputmode="decimal"></div>
    </div>
    <div style="margin-top:12px"><label>Nota o comprobante (opcional)</label><input id="pNote" placeholder="Ej: comprobante Nº 4521"></div>
    ${paymentsHistoryHTML(debtId)}
    <div class="modal-foot">
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="pSave">Registrar pago</button>
    </div>
  `);
  wirePaymentsHistory(() => openPago(debtId, onDone));
  document.getElementById('pSave').onclick = () => {
    const amount = parseNum(document.getElementById('pAmount').value);
    const date = document.getElementById('pDate').value;
    if (!date || !amount || amount <= 0) return;
    registerPayment({ debtId, date, amount, note: document.getElementById('pNote').value.trim() });
    closeModal();
    if (onDone) onDone();
  };
}
