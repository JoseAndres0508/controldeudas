import { DB, save } from './state.js';
import { activeDebts, debtById, fmtDateLong, fmtMoney, lastBalance, parseNum, toCRC } from './utils.js';
import { uid } from './uid.js';
import { closeModal, showModal } from './modal.js';
import { confirmDialog } from './confirmDialog.js';
import { toast } from './toast.js';

/* =========================================================
   MOVIMIENTOS
   Registros individuales entre corte y corte. Hay tres tipos:

     pago    → abono, baja el saldo
     consumo → compra o cargo, sube el saldo (tarjetas revolventes)
     ajuste  → "hoy debo exactamente esto"; fija el saldo, igual que
               un corte pero para una sola deuda

   El cálculo del saldo vive en lastBalance() (utils.js).
   ========================================================= */
export const MOVE_TYPES = {
  pago:    { label: 'Pago',            verb: 'Registrar pago',   sign: -1, color: 'var(--down)' },
  consumo: { label: 'Consumo / cargo', verb: 'Registrar consumo', sign: 1, color: 'var(--up)' },
  ajuste:  { label: 'Ajuste de saldo', verb: 'Ajustar saldo',     sign: 0, color: 'var(--ink-2)' }
};
const moveType = p => MOVE_TYPES[p.type] ? p.type : 'pago';

/** Suma histórica de lo efectivamente abonado, en colones.
 *  Solo cuenta pagos: los consumos suben la deuda y los ajustes
 *  no son dinero movido. */
export function totalPaidCRC() {
  return DB.payments.reduce((s, p) => {
    if (moveType(p) !== 'pago') return s;
    const d = debtById(p.debtId);
    return d ? s + toCRC(p.amount, d.currency) : s;
  }, 0);
}

/** Suma histórica de consumos/cargos, en colones. */
export function totalChargedCRC() {
  return DB.payments.reduce((s, p) => {
    if (moveType(p) !== 'consumo') return s;
    const d = debtById(p.debtId);
    return d ? s + toCRC(p.amount, d.currency) : s;
  }, 0);
}

export const paymentsForDebt = debtId =>
  DB.payments.filter(p => p.debtId === debtId).sort((a, b) => b.date.localeCompare(a.date));

/** Últimos N movimientos de cualquier deuda, para el feed de Inicio. */
export function recentPayments(limit = 6) {
  return [...DB.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** Monto con signo y color según el tipo, para listados. */
export function movementAmountHTML(p, currency) {
  const t = moveType(p);
  const { sign, color } = MOVE_TYPES[t];
  const prefix = sign > 0 ? '+' : sign < 0 ? '−' : '=';
  return `<span class="num" style="font-size:.8125rem;color:${color}">${prefix} ${fmtMoney(p.amount, currency)}</span>`;
}

export function movementLabel(p) { return MOVE_TYPES[moveType(p)].label; }

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
    // Solo un abono real cuenta como "ya pagué este mes".
    const paid = paymentsForDebt(d.id).some(p => moveType(p) === 'pago' && p.date >= dueISO);
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

export function registerPayment({ debtId, date, amount, note, receipt, type = 'pago' }) {
  DB.payments.push({ id: uid(), debtId, date, amount, note: note || '', receipt: receipt || null, type });
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

/** Fragmento de historial de movimientos de una deuda, con botón de borrar por fila. */
export function paymentsHistoryHTML(debtId) {
  const list = paymentsForDebt(debtId);
  const d = debtById(debtId);
  if (!list.length) return `<p class="dim" style="font-size:.8125rem;margin:8px 0 0">Todavía no hay movimientos registrados para esta deuda.</p>`;
  return `<div style="margin-top:8px">
    ${list.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--rule-soft)">
      <div>
        <span class="num" style="font-size:.8125rem">${fmtDateLong(p.date)}</span>
        <span class="chip" style="margin-left:6px">${movementLabel(p)}</span>
        ${p.note ? `<span class="dim" style="font-size:.75rem"> · ${p.note}</span>` : ''}
        ${p.receipt ? `<a href="${p.receipt.dataUrl}" download="${p.receipt.name}" style="font-size:.75rem;margin-left:6px" title="Descargar comprobante">📎</a>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${movementAmountHTML(p, d.currency)}
        <button type="button" class="btn ghost" data-delpay="${p.id}" style="padding:2px 6px">✕</button>
      </div>
    </div>`).join('')}
  </div>`;
}

/** Conecta los botones de borrar de paymentsHistoryHTML(); llamar tras insertarlo en el DOM. */
export function wirePaymentsHistory(rerender) {
  document.querySelectorAll('[data-delpay]').forEach(btn => {
    btn.onclick = async () => {
      if (!(await confirmDialog('¿Eliminar este movimiento? No se puede deshacer.'))) return;
      deletePayment(btn.dataset.delpay);
      toast('Movimiento eliminado.', 'success');
      rerender();
    };
  });
}

const HINTS = {
  pago: 'Baja el saldo. Es el abono que hiciste.',
  consumo: 'Sube el saldo. Usalo cuando compraste con la tarjeta o te cargaron intereses.',
  ajuste: 'Fija el saldo exacto de hoy, sin importar los movimientos anteriores. Usalo cuando mirás el estado de cuenta y querés que el sistema diga lo mismo.'
};

/** Modal de movimiento (pago, consumo o ajuste) de una deuda puntual.
 *  `type` define con cuál arranca seleccionado. */
export function openPago(debtId, onDone, type = 'pago') {
  const d = debtById(debtId);
  if (!d) return;
  const saldo = lastBalance(d.id);
  const cur = d.currency === 'USD' ? '($)' : '(₡)';

  showModal(`
    <h2>Movimiento — ${d.name}</h2>
    <p class="dim" style="font-size:.8125rem;margin:-8px 0 14px">Saldo actual: <span class="num">${fmtMoney(saldo, d.currency)}</span></p>
    <div><label>Tipo de movimiento</label>
      <div class="seg" id="pType" style="display:flex">
        ${Object.entries(MOVE_TYPES).map(([k, v]) =>
          `<button type="button" data-ptype="${k}" aria-pressed="${k === type}" style="flex:1">${v.label}</button>`).join('')}
      </div>
    </div>
    <p class="dim" id="pHint" style="font-size:.75rem;margin:8px 0 0">${HINTS[type]}</p>
    <div class="grid g2" style="margin-top:12px">
      <div><label>Fecha</label><input type="date" id="pDate" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div><label id="pAmountLabel">${type === 'ajuste' ? `Saldo real hoy ${cur}` : `Monto ${cur}`}</label><input class="num-in" id="pAmount" value="${type === 'ajuste' ? saldo : ''}" placeholder="0" inputmode="decimal"></div>
    </div>
    <div style="margin-top:12px"><label>Nota (opcional)</label><input id="pNote" placeholder="Ej: pago de contado"></div>
    <div style="margin-top:12px"><label>Comprobante (opcional, imagen o PDF, máx. 1.5MB)</label><input type="file" id="pFile" accept="image/*,.pdf"></div>
    <hr style="margin:16px 0 10px">
    <h3 style="margin-bottom:4px">Historial de movimientos</h3>
    ${paymentsHistoryHTML(debtId)}
    <div class="modal-foot">
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="pSave">${MOVE_TYPES[type].verb}</button>
    </div>
  `);
  wirePaymentsHistory(() => openPago(debtId, onDone, type));

  let current = type;
  const amountEl = document.getElementById('pAmount');
  document.querySelectorAll('[data-ptype]').forEach(btn => {
    btn.onclick = () => {
      const next = btn.dataset.ptype;
      // Al pasar a "ajuste" precargamos el saldo actual: casi siempre se
      // corrige a partir de ahí. Al salir de ajuste, se limpia.
      if (next === 'ajuste' && current !== 'ajuste') amountEl.value = saldo;
      else if (next !== 'ajuste' && current === 'ajuste') amountEl.value = '';
      current = next;
      document.querySelectorAll('[data-ptype]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ptype === next)));
      document.getElementById('pHint').textContent = HINTS[next];
      document.getElementById('pAmountLabel').textContent = next === 'ajuste' ? `Saldo real hoy ${cur}` : `Monto ${cur}`;
      document.getElementById('pSave').textContent = MOVE_TYPES[next].verb;
      amountEl.focus();
    };
  });

  document.getElementById('pSave').onclick = async () => {
    const amount = parseNum(amountEl.value);
    const date = document.getElementById('pDate').value;
    // Un ajuste sí puede ser 0 (deuda saldada); pagos y consumos no.
    if (!date || amount === null || amount < 0) return;
    if (current !== 'ajuste' && amount <= 0) return;
    const btn = document.getElementById('pSave');
    btn.disabled = true;
    const receipt = await fileToReceipt(document.getElementById('pFile').files[0]);
    registerPayment({ debtId, date, amount, note: document.getElementById('pNote').value.trim(), receipt, type: current });
    closeModal();
    toast(current === 'ajuste' ? 'Saldo ajustado.' : `${MOVE_TYPES[current].label} registrado.`, 'success');
    if (onDone) onDone();
  };
}

/** Acceso rápido: elegí primero la deuda, después se abre el movimiento. */
export function openQuickPago(onDone, type = 'pago') {
  const debts = activeDebts();
  if (!debts.length) { toast('Todavía no hay deudas activas para registrarles un movimiento.', 'error'); return; }
  showModal(`
    <h2>${MOVE_TYPES[type].verb}</h2>
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
    if (id) openPago(id, onDone, type);
  };
}
