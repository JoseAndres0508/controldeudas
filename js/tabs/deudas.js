import { DB, save } from '../state.js';
import { activeDebts, addMonthsISO, creditorById, creditorName, debtById, fmtCRC, fmtDateLong, fmtMoney, lastBalance, parseNum, toCRC } from '../utils.js';
import { closeModal, showModal } from '../modal.js';
import { uid } from '../uid.js';
import { renderAll } from '../render-all.js';
import { singleDebtProjection } from './estrategia.js';
import { openCreditor } from './acreedores.js';
import { debtStatus, dueInfo, openPago, paymentsHistoryHTML, statusDotHTML, STATUS_LABEL, wirePaymentsHistory } from '../payments.js';
import { confirmDialog } from '../confirmDialog.js';
import { toast } from '../toast.js';

/* =========================================================
   PESTAÑA: INGRESAR DEUDAS
   ========================================================= */
const FILTERS = [
  { key: 'activa', label: 'Activas' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'pagada', label: 'Pagadas' },
  { key: 'todas', label: 'Todas' }
];
let searchText = '';
let statusFilter = 'activa';

function finEstimadoHTML(d, crc) {
  const proj = singleDebtProjection(crc, d.rate, toCRC(d.minPayment || 0, d.currency));
  if (!proj) return '<span class="chip warn">falta dato</span>';
  if (!proj.reached) return '<span class="chip warn">cuota insuficiente</span>';
  return fmtDateLong(addMonthsISO(proj.months));
}

function dueHTML(d) {
  const info = dueInfo(d);
  if (!info) return '<span class="dim">—</span>';
  return `${statusDotHTML(info)} <span class="num" style="font-size:12px">${fmtDateLong(info.date)}</span>`;
}

export function renderDeudas() {
  const el = document.getElementById('tab-deudas');
  const missing = activeDebts().filter(d => d.rate === null || d.rate === undefined);
  let html = '';
  if (missing.length) {
    html += `<div class="banner"><span><strong>${missing.length} deuda${missing.length > 1 ? 's' : ''} sin tasa de interés.</strong> La avalancha no sirve hasta que las completés — es el dato que decide cuál te está costando más caro.</span></div>`;
  }
  html += `<div class="card">
    <div class="card-head">
      <h2>Ingresar deudas</h2>
      <button class="btn primary" id="btnNewDebt">Agregar deuda</button>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <input id="debtSearch" placeholder="Buscar deuda…" value="${searchText}" style="max-width:220px">
      <div class="seg">
        ${FILTERS.map(f => `<button data-filter="${f.key}" aria-pressed="${statusFilter === f.key}">${f.label}</button>`).join('')}
      </div>
    </div>`;

  const rows = DB.debts
    .map(d => ({ d, crc: toCRC(lastBalance(d.id), d.currency) }))
    .filter(({ d }) => d.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    .filter(({ d, crc }) => statusFilter === 'todas' || debtStatus(d, crc) === statusFilter)
    .sort((a, b) => b.crc - a.crc);

  if (!rows.length) {
    html += `<div class="empty">Ninguna deuda coincide con la búsqueda o el filtro.</div>`;
  } else {
    html += `<table><thead><tr>
      <th></th><th>Deuda</th><th class="hide-sm">Tipo</th><th class="ta-r">Tasa anual</th><th class="ta-r hide-sm">Cuota mínima</th><th class="ta-r">Saldo actual</th><th class="hide-sm">Vencimiento</th><th class="ta-r hide-sm">Fin estimado</th><th class="ta-r"></th>
    </tr></thead><tbody>`;
    rows.forEach(({ d, crc }) => {
      const bal = lastBalance(d.id);
      const st = debtStatus(d, crc);
      html += `<tr${st === 'pagada' ? ' style="opacity:.6"' : ''}>
        <td><span class="chip">${d.currency}</span></td>
        <td><strong style="font-weight:500">${d.name}</strong>${st === 'pagada' ? ' <span class="chip">pagada</span>' : ''}<br><span class="dim" style="font-size:12px">${creditorName(d)}</span></td>
        <td class="hide-sm"><span class="chip">${d.kind}</span></td>
        <td class="ta-r num">${d.rate === null || d.rate === undefined ? '<span class="chip warn">falta</span>' : d.rate.toFixed(2) + '%'}</td>
        <td class="ta-r num hide-sm">${d.minPayment ? fmtMoney(d.minPayment, d.currency) : '<span class="dim">—</span>'}</td>
        <td class="ta-r num">${fmtMoney(bal, d.currency)}${d.currency === 'USD' ? `<br><span class="dim" style="font-size:11px">${fmtCRC(crc)}</span>` : ''}</td>
        <td class="hide-sm">${dueHTML(d)}</td>
        <td class="ta-r num hide-sm">${finEstimadoHTML(d, crc)}</td>
        <td class="ta-r"><div class="btn-row" style="justify-content:flex-end"><button class="btn ghost" data-verdebt="${d.id}">Ver</button><button class="btn ghost" data-pagar="${d.id}">Pagar</button><button class="btn ghost" data-editdebt="${d.id}">Editar</button></div></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  el.innerHTML = html;

  const search = document.getElementById('debtSearch');
  search.oninput = () => { searchText = search.value; renderDeudas(); search.focus(); search.setSelectionRange(search.value.length, search.value.length); };
  document.querySelectorAll('#tab-deudas [data-filter]').forEach(btn => {
    btn.onclick = () => { statusFilter = btn.dataset.filter; renderDeudas(); };
  });
}

function creditorFieldHTML(d) {
  return `<div><label>Acreedor</label>
    <div style="display:flex;gap:6px">
      <select id="dCreditor" style="flex:1">
        <option value="">Sin acreedor</option>
        ${DB.creditors.map(c => `<option value="${c.id}" ${d.creditorId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <button type="button" class="btn ghost" id="dNewCreditor">+ Nuevo</button>
    </div>
  </div>`;
}

export function openDebt(id, preselectCreditorId) {
  // Copia de solo lectura para el formulario: nunca se toca DB.debts
  // directamente acá, solo al hacer clic en "Guardar" (más abajo).
  const existing = id ? debtById(id) : null;
  const d = existing
    ? { ...existing, creditorId: preselectCreditorId || existing.creditorId }
    : { id: null, name: '', creditorId: preselectCreditorId || null, kind: 'tarjeta', currency: 'CRC', rate: null, minPayment: null, notes: '', archived: false, startDate: null, dueDay: null };

  showModal(`
    <h2>${id ? 'Editar deuda' : 'Nueva deuda'}</h2>
    <div class="grid g2">
      <div><label>Nombre</label><input id="dName" value="${d.name}" placeholder="Ej: Tarjeta Promérica"></div>
      ${creditorFieldHTML(d)}
      <div><label>Tipo</label><select id="dKind">
        ${['tarjeta', 'prestamo', 'tienda', 'otro'].map(k => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></div>
      <div><label>Moneda</label><select id="dCur">
        <option value="CRC" ${d.currency === 'CRC' ? 'selected' : ''}>Colones (₡)</option>
        <option value="USD" ${d.currency === 'USD' ? 'selected' : ''}>Dólares ($)</option>
      </select></div>
      <div><label>Tasa de interés anual %</label><input class="num-in" id="dRate" value="${d.rate ?? ''}" placeholder="Ej: 48.5" inputmode="decimal"></div>
      <div><label>Cuota mínima mensual</label><input class="num-in" id="dMin" value="${d.minPayment ?? ''}" placeholder="Ej: 45000" inputmode="decimal"></div>
      <div><label>Fecha de inicio</label><input type="date" id="dStart" value="${d.startDate || ''}"></div>
      <div><label>Día de pago (1-31)</label><input class="num-in" id="dDue" value="${d.dueDay ?? ''}" placeholder="Ej: 15" inputmode="numeric"></div>
    </div>
    <div style="margin-top:12px"><label>Notas</label><textarea id="dNotes" rows="2" placeholder="Fecha de corte, número de cuenta, condiciones…">${d.notes || ''}</textarea></div>
    ${id ? `<div style="margin-top:12px"><label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:13px;color:var(--ink-2)"><input type="checkbox" id="dArch" ${d.archived ? 'checked' : ''} style="width:auto"> Archivar (ya está saldada, no aparece en cortes ni estrategia)</label></div>
    <hr style="margin:16px 0 10px">
    <h3 style="margin-bottom:4px">Historial de pagos</h3>
    ${paymentsHistoryHTML(id)}` : ''}
    <div class="modal-foot">
      ${id ? '<button class="btn danger" id="dDelete" style="margin-right:auto">Eliminar</button>' : ''}
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="dSave">Guardar</button>
    </div>
  `);

  if (id) wirePaymentsHistory(() => openDebt(id));

  document.getElementById('dNewCreditor').onclick = () => {
    openCreditor(null, (created) => openDebt(id, created.id));
  };

  document.getElementById('dSave').onclick = () => {
    const obj = {
      name: document.getElementById('dName').value.trim() || 'Sin nombre',
      creditorId: document.getElementById('dCreditor').value || null,
      kind: document.getElementById('dKind').value,
      currency: document.getElementById('dCur').value,
      rate: parseNum(document.getElementById('dRate').value),
      minPayment: parseNum(document.getElementById('dMin').value),
      startDate: document.getElementById('dStart').value || null,
      dueDay: (() => { const n = parseNum(document.getElementById('dDue').value); return n ? Math.min(31, Math.max(1, Math.round(n))) : null; })(),
      notes: document.getElementById('dNotes').value,
      archived: id ? document.getElementById('dArch').checked : false
    };
    if (id) Object.assign(debtById(id), obj);
    else DB.debts.push({ id: uid(), ...obj });
    save(); closeModal(); renderAll();
    toast(id ? 'Deuda actualizada.' : 'Deuda agregada.', 'success');
  };
  const del = document.getElementById('dDelete');
  if (del) del.onclick = async () => {
    if (!(await confirmDialog('Esto borra la deuda y su historial en todos los cortes. ¿Seguro? Mejor archivala si ya la pagaste.'))) return;
    DB.debts = DB.debts.filter(x => x.id !== id);
    DB.periods.forEach(p => delete p.entries[id]);
    DB.payments = DB.payments.filter(p => p.debtId !== id);
    save(); closeModal(); renderAll();
    toast('Deuda eliminada.', 'success');
  };
}

/** Vista de solo lectura con todo lo relevante de una deuda: acreedor,
 *  proyección de pago e historial de abonos. */
export function openDebtDetail(id) {
  const d = debtById(id);
  if (!d) return;
  const bal = lastBalance(d.id);
  const crc = toCRC(bal, d.currency);
  const c = creditorById(d.creditorId);
  const info = dueInfo(d);
  const proj = singleDebtProjection(crc, d.rate, toCRC(d.minPayment || 0, d.currency));

  showModal(`
    <h2>${d.name}${info ? `<span style="margin-left:8px">${statusDotHTML(info)}</span>` : ''}</h2>
    <p class="dim" style="font-size:13px;margin:0 0 14px">${creditorName(d) || 'Sin acreedor'} · ${d.kind}</p>
    <div class="stat-row">
      <div class="stat"><div class="k">Saldo actual</div><div class="v">${fmtMoney(bal, d.currency)}</div></div>
      <div class="stat"><div class="k">Tasa anual</div><div class="v">${d.rate != null ? d.rate.toFixed(2) + '%' : '—'}</div></div>
      <div class="stat"><div class="k">Cuota mínima</div><div class="v" style="font-size:15px">${d.minPayment ? fmtMoney(d.minPayment, d.currency) : '—'}</div></div>
      <div class="stat"><div class="k">Fin estimado</div><div class="v" style="font-size:15px">${proj && proj.reached ? fmtDateLong(addMonthsISO(proj.months)) : '—'}</div></div>
    </div>
    ${c ? `<div class="card">
      <div class="card-head"><h3>Acreedor</h3></div>
      <p style="margin:0;font-size:14px"><strong style="font-weight:500">${c.name}</strong></p>
      ${c.phone ? `<p class="dim" style="font-size:13px;margin:4px 0 0">${c.phone}</p>` : ''}
      ${c.email ? `<p class="dim" style="font-size:13px;margin:2px 0 0">${c.email}</p>` : ''}
      ${!c.phone && !c.email ? `<p class="dim" style="font-size:13px;margin:4px 0 0">Sin datos de contacto — completalos en Acreedores.</p>` : ''}
    </div>` : ''}
    <h3 style="margin-bottom:4px">Historial de pagos</h3>
    ${paymentsHistoryHTML(id)}
    <div class="modal-foot">
      <button class="btn" data-close>Cerrar</button>
      <button class="btn" id="vdPagar">Registrar pago</button>
      <button class="btn primary" id="vdEditar">Editar</button>
    </div>
  `);
  wirePaymentsHistory(() => openDebtDetail(id));
  document.getElementById('vdEditar').onclick = () => openDebt(id);
  document.getElementById('vdPagar').onclick = () => openPago(id, () => openDebtDetail(id));
}
