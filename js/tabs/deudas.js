import { DB, save } from '../state.js';
import { activeDebts, debtById, fmtCRC, fmtMoney, lastBalance, parseNum, toCRC } from '../utils.js';
import { closeModal, showModal } from '../modal.js';
import { uid } from '../uid.js';
import { renderAll } from '../render-all.js';

/* =========================================================
   PESTAÑA: DEUDAS
   ========================================================= */
export function renderDeudas() {
  const el = document.getElementById('tab-deudas');
  const missing = activeDebts().filter(d => d.rate === null || d.rate === undefined);
  let html = '';
  if (missing.length) {
    html += `<div class="banner"><span><strong>${missing.length} deuda${missing.length > 1 ? 's' : ''} sin tasa de interés.</strong> La avalancha no sirve hasta que las completés — es el dato que decide cuál te está costando más caro.</span></div>`;
  }
  html += `<div class="card">
    <div class="card-head">
      <h2>Deudas</h2>
      <button class="btn primary" id="btnNewDebt">Agregar deuda</button>
    </div>
    <table><thead><tr>
      <th></th><th>Deuda</th><th class="hide-sm">Tipo</th><th class="ta-r">Tasa anual</th><th class="ta-r hide-sm">Cuota mínima</th><th class="ta-r">Saldo actual</th><th class="ta-r"></th>
    </tr></thead><tbody>`;

  const rows = activeDebts().map(d => ({ d, crc: toCRC(lastBalance(d.id), d.currency) })).sort((a, b) => b.crc - a.crc);
  rows.forEach(({ d, crc }) => {
    const bal = lastBalance(d.id);
    html += `<tr>
      <td><span class="chip">${d.currency}</span></td>
      <td><strong style="font-weight:500">${d.name}</strong><br><span class="dim" style="font-size:12px">${d.issuer || ''}</span></td>
      <td class="hide-sm"><span class="chip">${d.kind}</span></td>
      <td class="ta-r num">${d.rate === null || d.rate === undefined ? '<span class="chip warn">falta</span>' : d.rate.toFixed(2) + '%'}</td>
      <td class="ta-r num hide-sm">${d.minPayment ? fmtMoney(d.minPayment, d.currency) : '<span class="dim">—</span>'}</td>
      <td class="ta-r num">${fmtMoney(bal, d.currency)}${d.currency === 'USD' ? `<br><span class="dim" style="font-size:11px">${fmtCRC(crc)}</span>` : ''}</td>
      <td class="ta-r"><button class="btn ghost" data-editdebt="${d.id}">Editar</button></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;

  const arch = DB.debts.filter(d => d.archived);
  if (arch.length) {
    html += `<div class="card"><h3 style="margin-bottom:10px">Archivadas</h3>` +
      arch.map(d => `<div style="display:flex;justify-content:space-between;padding:6px 0"><span class="muted">${d.name}</span><button class="btn ghost" data-editdebt="${d.id}">Editar</button></div>`).join('') + `</div>`;
  }
  el.innerHTML = html;
}

export function openDebt(id) {
  const d = id ? debtById(id) : { id: null, name: '', issuer: '', kind: 'tarjeta', currency: 'CRC', rate: null, minPayment: null, notes: '', archived: false };
  showModal(`
    <h2>${id ? 'Editar deuda' : 'Nueva deuda'}</h2>
    <div class="grid g2">
      <div><label>Nombre</label><input id="dName" value="${d.name}" placeholder="Ej: Tarjeta Promérica"></div>
      <div><label>Entidad</label><input id="dIssuer" value="${d.issuer || ''}" placeholder="Ej: Promérica"></div>
      <div><label>Tipo</label><select id="dKind">
        ${['tarjeta', 'prestamo', 'tienda', 'otro'].map(k => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></div>
      <div><label>Moneda</label><select id="dCur">
        <option value="CRC" ${d.currency === 'CRC' ? 'selected' : ''}>Colones (₡)</option>
        <option value="USD" ${d.currency === 'USD' ? 'selected' : ''}>Dólares ($)</option>
      </select></div>
      <div><label>Tasa de interés anual %</label><input class="num-in" id="dRate" value="${d.rate ?? ''}" placeholder="Ej: 48.5" inputmode="decimal"></div>
      <div><label>Cuota mínima mensual</label><input class="num-in" id="dMin" value="${d.minPayment ?? ''}" placeholder="Ej: 45000" inputmode="decimal"></div>
    </div>
    <div style="margin-top:12px"><label>Notas</label><textarea id="dNotes" rows="2" placeholder="Fecha de corte, número de cuenta, condiciones…">${d.notes || ''}</textarea></div>
    ${id ? `<div style="margin-top:12px"><label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:13px;color:var(--ink-2)"><input type="checkbox" id="dArch" ${d.archived ? 'checked' : ''} style="width:auto"> Archivar (ya está saldada, no aparece en cortes ni estrategia)</label></div>` : ''}
    <div class="modal-foot">
      ${id ? '<button class="btn danger" id="dDelete" style="margin-right:auto">Eliminar</button>' : ''}
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="dSave">Guardar</button>
    </div>
  `);

  document.getElementById('dSave').onclick = () => {
    const obj = {
      name: document.getElementById('dName').value.trim() || 'Sin nombre',
      issuer: document.getElementById('dIssuer').value.trim(),
      kind: document.getElementById('dKind').value,
      currency: document.getElementById('dCur').value,
      rate: parseNum(document.getElementById('dRate').value),
      minPayment: parseNum(document.getElementById('dMin').value),
      notes: document.getElementById('dNotes').value,
      archived: id ? document.getElementById('dArch').checked : false
    };
    if (id) Object.assign(debtById(id), obj);
    else DB.debts.push({ id: uid(), ...obj });
    save(); closeModal(); renderAll();
  };
  const del = document.getElementById('dDelete');
  if (del) del.onclick = () => {
    if (!confirm('Esto borra la deuda y su historial en todos los cortes. ¿Seguro? Mejor archivala si ya la pagaste.')) return;
    DB.debts = DB.debts.filter(x => x.id !== id);
    DB.periods.forEach(p => delete p.entries[id]);
    save(); closeModal(); renderAll();
  };
}
