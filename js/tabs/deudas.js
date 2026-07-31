import { DB, save } from '../state.js';
import { activeDebts, bankPayoffDate, creditorById, creditorName, debtById, debtProgress, fmtCRC, fmtDateLong, fmtMoney, lastBalance, monthsBetween, parseNum, payDayOf, toCRC } from '../utils.js';
import { closeModal, showModal } from '../modal.js';
import { uid } from '../uid.js';
import { renderAll } from '../render-all.js';
import { singleDebtProjection } from './estrategia.js';
import { openCreditor } from './acreedores.js';
import { debtStatus, dueInfo, openPago, paymentsHistoryHTML, statusDotHTML, wirePaymentsHistory } from '../payments.js';
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
/** Las columnas secundarias (tipo, cuota, fin estimado) quedan ocultas
 *  por defecto para que la tabla no abrume; se muestran con el toggle. */
let showDetails = false;

const projFor = (d, crc) => singleDebtProjection(crc, d.rate, toCRC(d.minPayment || 0, d.currency), payDayOf(d));

function finEstimadoHTML(d, crc) {
  const proj = projFor(d, crc);
  if (!proj) return '<span class="chip warn">falta dato</span>';
  if (!proj.reached) return '<span class="chip warn">cuota insuficiente</span>';
  // La fecha siempre cae en el día de pago de la deuda: 15 o 30.
  return fmtDateLong(proj.endDate);
}

/** Compara la fecha propia contra el plazo que puso la entidad. */
function bankComparisonHTML(d, proj) {
  const bank = bankPayoffDate(d);
  if (!bank) {
    return `<p class="dim" style="font-size:.8125rem;margin:0">Cargá <strong>fecha de inicio</strong> y <strong>plazo del banco</strong> en Editar para comparar contra lo que te puso la entidad.</p>`;
  }
  if (!proj || !proj.reached) {
    return `<p style="font-size:.875rem;margin:0">Según la entidad, esta deuda termina el <strong>${fmtDateLong(bank)}</strong> (${d.termMonths} meses de plazo).</p>`;
  }
  const diff = monthsBetween(proj.endDate, bank);   // + = el banco termina después
  const label = diff > 0
    ? `<strong style="color:var(--down)">${diff} ${diff === 1 ? 'mes' : 'meses'} antes</strong> de lo que dice la entidad`
    : diff < 0
      ? `<strong style="color:var(--up)">${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'mes' : 'meses'} después</strong> del plazo de la entidad`
      : `<strong>justo en el plazo</strong> de la entidad`;
  return `<p style="font-size:.875rem;margin:0">La entidad la puso a <strong>${d.termMonths} meses</strong>, hasta el ${fmtDateLong(bank)}.
    Pagando la cuota mínima salís el <strong>${fmtDateLong(proj.endDate)}</strong>: ${label}.</p>`;
}

function dueHTML(d) {
  const info = dueInfo(d);
  if (!info) return '<span class="dim">—</span>';
  return `${statusDotHTML(info)} <span class="num" style="font-size:.75rem">${fmtDateLong(info.date)}</span>`;
}

/** Mini barra de avance contra el saldo inicial, para la tabla. */
function progressCellHTML(d) {
  const p = debtProgress(d);
  if (!p) return '<span class="chip warn">falta inicial</span>';
  if (p.grew) return `<span class="num" style="font-size:.75rem;color:var(--up)">+${fmtMoney(p.grown, d.currency)}</span>`;
  return `<div style="min-width:110px">
    <div class="mini-track"><div class="mini-fill f-down" style="width:${p.pct ?? 0}%"></div></div>
    <span class="num dim" style="font-size:.6875rem;display:block;margin-top:4px">${p.pct !== null ? p.pct.toFixed(0) + '%' : '—'}</span>
  </div>`;
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
      <button class="btn ghost" id="btnToggleDetails" style="margin-left:auto">${showDetails ? 'Ocultar detalles' : 'Mostrar detalles'}</button>
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
      <th></th><th>Deuda</th>${showDetails ? '<th class="hide-sm">Tipo</th>' : ''}<th class="ta-r">Tasa anual</th>${showDetails ? '<th class="ta-r hide-sm">Saldo inicial</th><th class="ta-r hide-sm">Cuota mínima</th>' : ''}<th class="ta-r">Saldo actual</th><th class="hide-sm">Avance</th><th class="hide-sm">Vencimiento</th>${showDetails ? '<th class="ta-r hide-sm">Fin estimado</th>' : ''}<th class="ta-r"></th>
    </tr></thead><tbody>`;
    rows.forEach(({ d, crc }) => {
      const bal = lastBalance(d.id);
      const st = debtStatus(d, crc);
      html += `<tr${st === 'pagada' ? ' style="opacity:.6"' : ''}>
        <td><span class="chip">${d.currency}</span></td>
        <td><strong style="font-weight:500">${d.name}</strong>${st === 'pagada' ? ' <span class="chip">pagada</span>' : ''}<br><span class="dim" style="font-size:.75rem">${creditorName(d)}</span></td>
        ${showDetails ? `<td class="hide-sm"><span class="chip">${d.kind}</span></td>` : ''}
        <td class="ta-r num">${d.rate === null || d.rate === undefined ? '<span class="chip warn">falta</span>' : d.rate.toFixed(2) + '%'}</td>
        ${showDetails ? `<td class="ta-r num hide-sm">${d.initialBalance != null ? fmtMoney(d.initialBalance, d.currency) : '<span class="chip warn">falta</span>'}</td><td class="ta-r num hide-sm">${d.minPayment ? fmtMoney(d.minPayment, d.currency) : '<span class="dim">—</span>'}</td>` : ''}
        <td class="ta-r num">${fmtMoney(bal, d.currency)}${d.currency === 'USD' ? `<br><span class="dim" style="font-size:.6875rem">${fmtCRC(crc)}</span>` : ''}</td>
        <td class="hide-sm">${progressCellHTML(d)}</td>
        <td class="hide-sm">${dueHTML(d)}</td>
        ${showDetails ? `<td class="ta-r num hide-sm">${finEstimadoHTML(d, crc)}</td>` : ''}
        <td class="ta-r">
          <details class="row-menu">
            <summary title="Acciones" aria-label="Acciones">⋯</summary>
            <div class="row-menu-pop">
              <button type="button" data-verdebt="${d.id}">Ver detalle</button>
              <button type="button" data-pagar="${d.id}">Registrar pago</button>
              <button type="button" data-consumo="${d.id}">Registrar consumo</button>
              <button type="button" data-ajuste="${d.id}">Ajustar saldo</button>
              <button type="button" data-editdebt="${d.id}">Editar</button>
            </div>
          </details>
        </td>
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
  const toggle = document.getElementById('btnToggleDetails');
  if (toggle) toggle.onclick = () => { showDetails = !showDetails; renderDeudas(); };

  // Un solo menú abierto a la vez.
  el.querySelectorAll('.row-menu').forEach(m => {
    m.addEventListener('toggle', () => {
      if (!m.open) return;
      el.querySelectorAll('.row-menu[open]').forEach(o => { if (o !== m) o.open = false; });
    });
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
    : { id: null, name: '', creditorId: preselectCreditorId || null, kind: 'tarjeta', currency: 'CRC', rate: null, minPayment: null, notes: '', archived: false, startDate: null, dueDay: null, initialBalance: null };

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
      <div><label>Día de pago</label>
        <select id="dDue">
          <option value="" ${d.dueDay == null ? 'selected' : ''}>Sin definir</option>
          <option value="15" ${d.dueDay === 15 ? 'selected' : ''}>Día 15</option>
          <option value="30" ${d.dueDay === 30 ? 'selected' : ''}>Día 30 (fin de mes)</option>
        </select>
      </div>
      <div><label>Saldo inicial ${d.currency === 'USD' ? '($)' : '(₡)'}</label><input class="num-in" id="dInitial" value="${d.initialBalance ?? ''}" placeholder="Ej: 1600000" inputmode="decimal"></div>
      <div><label>Plazo del banco (meses)</label><input class="num-in" id="dTerm" value="${d.termMonths ?? ''}" placeholder="Ej: 60" inputmode="numeric"></div>
    </div>
    <p class="dim" style="font-size:.75rem;margin:8px 0 0">El <strong>saldo inicial</strong> es con cuánto arrancó la deuda; en una tarjeta que te dieron en cero, poné 0. El <strong>plazo del banco</strong> es a cuántos meses te la puso la entidad: junto con la fecha de inicio sirve para comparar si vas adelantado o atrasado.</p>
    <div style="margin-top:12px"><label>Notas</label><textarea id="dNotes" rows="2" placeholder="Fecha de corte, número de cuenta, condiciones…">${d.notes || ''}</textarea></div>
    ${id ? `<div style="margin-top:12px"><label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:.8125rem;color:var(--ink-2)"><input type="checkbox" id="dArch" ${d.archived ? 'checked' : ''} style="width:auto"> Archivar (ya está saldada, no aparece en cortes ni estrategia)</label></div>
    <hr style="margin:16px 0 10px">
    <h3 style="margin-bottom:4px">Historial de movimientos</h3>
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
      initialBalance: parseNum(document.getElementById('dInitial').value),
      dueDay: (() => { const v = document.getElementById('dDue').value; return v === '15' ? 15 : v === '30' ? 30 : null; })(),
      termMonths: (() => { const n = parseNum(document.getElementById('dTerm').value); return n && n > 0 ? Math.round(n) : null; })(),
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

/** Tarjeta de avance contra el saldo inicial, para el detalle de la deuda. */
function progressCardHTML(d, prog) {
  if (!prog) {
    return `<div class="card"><div class="card-head"><h3>Avance</h3></div>
      <p class="dim" style="font-size:.8125rem;margin:0">Cargá el <strong>saldo inicial</strong> en Editar para poder medir cuánto llevás pagado de esta deuda.</p></div>`;
  }
  if (prog.grew) {
    return `<div class="card"><div class="card-head"><h3>Avance</h3></div>
      <p style="margin:0;font-size:.875rem">Hoy debés <strong style="color:var(--up)">${fmtMoney(prog.grown, d.currency)}</strong> más que al inicio (${fmtMoney(prog.initial, d.currency)}).</p></div>`;
  }
  return `<div class="card"><div class="card-head">
      <h3>Avance</h3>
      <span class="num" style="font-size:.8125rem">${prog.pct !== null ? prog.pct.toFixed(1) + '%' : ''}</span>
    </div>
    <div class="mini-track" style="height:8px"><div class="mini-fill f-down" style="width:${prog.pct ?? 0}%"></div></div>
    <p class="dim" style="font-size:.8125rem;margin:8px 0 0">Llevás <strong style="color:var(--down)">${fmtMoney(prog.paid, d.currency)}</strong> pagados de ${fmtMoney(prog.initial, d.currency)}${prog.done ? ' — deuda saldada.' : '.'}</p>
  </div>`;
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
  const proj = projFor(d, crc);
  const prog = debtProgress(d);

  showModal(`
    <h2>${d.name}${info ? `<span style="margin-left:8px">${statusDotHTML(info)}</span>` : ''}</h2>
    <p class="dim" style="font-size:.8125rem;margin:0 0 14px">${creditorName(d) || 'Sin acreedor'} · ${d.kind} · paga el ${payDayOf(d)}${d.dueDay == null ? ' (asumido)' : ''}</p>
    <div class="stat-row">
      <div class="stat"><div class="k">Saldo inicial</div><div class="v">${prog ? fmtMoney(prog.initial, d.currency) : '—'}</div></div>
      <div class="stat"><div class="k">Saldo actual</div><div class="v">${fmtMoney(bal, d.currency)}</div></div>
      <div class="stat"><div class="k">Tasa anual</div><div class="v">${d.rate != null ? d.rate.toFixed(2) + '%' : '—'}</div></div>
      <div class="stat"><div class="k">Cuota mínima</div><div class="v" style="font-size:.9375rem">${d.minPayment ? fmtMoney(d.minPayment, d.currency) : '—'}</div></div>
      <div class="stat"><div class="k">Fin estimado</div><div class="v" style="font-size:.9375rem">${proj && proj.reached ? fmtDateLong(proj.endDate) : '—'}</div></div>
    </div>
    ${progressCardHTML(d, prog)}
    <div class="card">
      <div class="card-head"><h3>Plazo de la entidad</h3>${d.termMonths ? `<span class="chip">${d.termMonths} meses</span>` : ''}</div>
      ${bankComparisonHTML(d, proj)}
    </div>
    ${c ? `<div class="card">
      <div class="card-head"><h3>Acreedor</h3></div>
      <p style="margin:0;font-size:.875rem"><strong style="font-weight:500">${c.name}</strong></p>
      ${c.phone ? `<p class="dim" style="font-size:.8125rem;margin:4px 0 0">${c.phone}</p>` : ''}
      ${c.email ? `<p class="dim" style="font-size:.8125rem;margin:2px 0 0">${c.email}</p>` : ''}
      ${!c.phone && !c.email ? `<p class="dim" style="font-size:.8125rem;margin:4px 0 0">Sin datos de contacto — completalos en Acreedores.</p>` : ''}
    </div>` : ''}
    <h3 style="margin-bottom:4px">Historial de movimientos</h3>
    ${paymentsHistoryHTML(id)}
    <div class="modal-foot">
      <button class="btn" data-close>Cerrar</button>
      <button class="btn" id="vdAjuste">Ajustar saldo</button>
      <button class="btn" id="vdConsumo">Consumo</button>
      <button class="btn" id="vdPagar">Pago</button>
      <button class="btn primary" id="vdEditar">Editar</button>
    </div>
  `);
  wirePaymentsHistory(() => openDebtDetail(id));
  document.getElementById('vdEditar').onclick = () => openDebt(id);
  document.getElementById('vdPagar').onclick = () => openPago(id, () => openDebtDetail(id), 'pago');
  document.getElementById('vdConsumo').onclick = () => openPago(id, () => openDebtDetail(id), 'consumo');
  document.getElementById('vdAjuste').onclick = () => openPago(id, () => openDebtDetail(id), 'ajuste');
}
