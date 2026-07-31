import { DB, save } from './state.js';
import { activeDebts, debtById, fmtDateLong, fmtMoney, parseNum, toCRC } from './utils.js';
import { uid } from './uid.js';
import { closeModal, showModal } from './modal.js';
import { confirmDialog } from './confirmDialog.js';
import { toast } from './toast.js';

/* =========================================================
   PAGOS
   Registros individuales de abono, separados de los cortes.
   Cada pago reduce el saldo "actual" de su deuda (ver
   lastBalance en utils.js) hasta que un corte nuevo lo confirme.
   ========================================================= */
/** Suma histórica de todos los pagos registrados, en colones. */
export function totalPaidCRC() {
  return DB.payments.reduce((s, p) => {
    const d = debtById(p.debtId);
    return d ? s + toCRC(p.amount, d.currency) : s;
  }, 0);
}

export const paymentsForDebt = debtId =>
  DB.payments.filter(p => p.debtId === debtId).sort((a, b) => b.date.localeCompare(a.date));

/** Últimos N pagos de cualquier deuda, para el feed de "Últimos movimientos". */
export function recentPayments(limit = 6) {
  return [...DB.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

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

/** Punto único de armado del "semáforo" (usado en Ingresar deudas, Inicio y Reportes). */
export function statusDotHTML(info) {
  if (!info) return '';
  return `<span class="dot ${info.status}" title="${STATUS_LABEL[info.status]}"></span>`;
}

/** Estado general de una deuda para el filtro de "Ingresar deudas":
 *  pagada (archivada o saldo en cero), vencida (pago atrasado) o activa. */
export function debtStatus(d, crcBalance) {
  if (d.archived || (crcBalance !== undefined && crcBalance <= 0)) return 'pagada';
  const info = dueInfo(d);
  if (info && info.status === 'vencido') return 'vencida';
  return 'activa';
}

export function registerPayment({ debtId, date, amount, note, receipt }) {
  DB.payments.push({ id: uid(), debtId, date, amount, note: note || '', receipt: receipt || null });
  save();
}

export function deletePayment(id) {
  DB.payments = DB.payments.filter(p => p.id !== id);
  save();
}

/** Lee un archivo chico (comprobante) como data URL. Rechaza si pesa demasiado
 *  para no inflar el respaldo JSON / localStorage. */
const MAX_RECEIPT_BYTES = 1.5 * 1024 * 1024;
function fileToReceipt(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast('El comprobante pesa más de 1.5MB; el pago se guarda sin adjuntarlo.', 'error');
      resolve(null);
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, type: file.type, dataUrl: r.result });
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
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
        ${p.receipt ? `<a href="${p.receipt.dataUrl}" download="${p.receipt.name}" style="font-size:12px;margin-left:6px" title="Descargar comprobante">📎</a>` : ''}
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
    btn.onclick = async () => {
      if (!(await confirmDialog('¿Eliminar este pago? No se puede deshacer.'))) return;
      deletePayment(btn.dataset.delpay);
      toast('Pago eliminado.', 'success');
      rerender();
    };
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
    <div style="margin-top:12px"><label>Nota (opcional)</label><input id="pNote" placeholder="Ej: pago de contado"></div>
    <div style="margin-top:12px"><label>Comprobante (opcional, imagen o PDF, máx. 1.5MB)</label><input type="file" id="pFile" accept="image/*,.pdf"></div>
    ${paymentsHistoryHTML(debtId)}
    <div class="modal-foot">
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="pSave">Registrar pago</button>
    </div>
  `);
  wirePaymentsHistory(() => openPago(debtId, onDone));
  document.getElementById('pSave').onclick = async () => {
    const amount = parseNum(document.getElementById('pAmount').value);
    const date = document.getElementById('pDate').value;
    if (!date || !amount || amount <= 0) return;
    const btn = document.getElementById('pSave');
    btn.disabled = true;
    const receipt = await fileToReceipt(document.getElementById('pFile').files[0]);
    registerPayment({ debtId, date, amount, note: document.getElementById('pNote').value.trim(), receipt });
    closeModal();
    toast('Pago registrado.', 'success');
    if (onDone) onDone();
  };
}

/** Acceso rápido: elegí primero la deuda, después se abre el registro de pago. */
export function openQuickPago(onDone) {
  const debts = activeDebts();
  if (!debts.length) { toast('Todavía no hay deudas activas para registrarles un pago.', 'error'); return; }
  showModal(`
    <h2>Registrar pago</h2>
    <div><label>Deuda</label><select id="qpDebt">
      ${debts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
    </select></div>
    <div class="modal-foot">
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="qpNext">Continuar</button>
    </div>
  `);
  document.getElementById('qpNext').onclick = () => {
    const id = document.getElementById('qpDebt').value;
    if (id) openPago(id, onDone);
  };
}
