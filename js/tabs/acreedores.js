import { DB, save } from '../state.js';
import { creditorById } from '../utils.js';
import { closeModal, showModal } from '../modal.js';
import { uid } from '../uid.js';
import { renderAll } from '../render-all.js';
import { confirmDialog } from '../confirmDialog.js';
import { toast } from '../toast.js';

/* =========================================================
   PESTAÑA: ACREEDORES
   ========================================================= */
let filterText = '';

export function renderAcreedores() {
  const el = document.getElementById('tab-acreedores');
  const list = DB.creditors
    .filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  let html = `<div class="card">
    <div class="card-head">
      <h2>Acreedores</h2>
      <button class="btn primary" id="btnNewCreditor">Agregar acreedor</button>
    </div>
    <div style="margin-bottom:14px;max-width:280px"><input id="creditorSearch" placeholder="Buscar acreedor…" value="${filterText}"></div>`;

  if (!list.length) {
    html += `<div class="empty">${DB.creditors.length ? 'Ningún acreedor coincide con la búsqueda.' : 'Todavía no hay acreedores. Se crean automáticamente al agregar una deuda, o los agregás aquí.'}</div>`;
  } else {
    html += `<table><thead><tr><th>Nombre</th><th class="hide-sm">Contacto</th><th class="ta-r">Deudas</th><th class="ta-r"></th></tr></thead><tbody>`;
    list.forEach(c => {
      const count = DB.debts.filter(d => d.creditorId === c.id && !d.archived).length;
      // Teléfono y correo en una sola celda: casi siempre uno de los dos
      // está vacío, y dos columnas de guiones no aportan nada.
      const contacto = [c.phone, c.email].filter(Boolean);
      html += `<tr>
        <td><strong style="font-weight:500">${c.name}</strong></td>
        <td class="hide-sm">${contacto.length
          ? contacto.map(v => `<span style="font-size:.8125rem">${v}</span>`).join('<br>')
          : '<span class="dim">Sin datos de contacto</span>'}</td>
        <td class="ta-r num">${count}</td>
        <td class="ta-r"><button class="btn ghost" data-editcreditor="${c.id}">Editar</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  el.innerHTML = html;

  const search = document.getElementById('creditorSearch');
  search.oninput = () => { filterText = search.value; renderAcreedores(); search.focus(); search.setSelectionRange(search.value.length, search.value.length); };
}

export function openCreditor(id, onSaved) {
  const c = id ? creditorById(id) : { id: null, name: '', phone: '', email: '', address: '', notes: '' };
  const debtCount = id ? DB.debts.filter(d => d.creditorId === id).length : 0;
  showModal(`
    <h2>${id ? 'Editar acreedor' : 'Nuevo acreedor'}</h2>
    <div class="grid g2">
      <div><label>Nombre</label><input id="cName" value="${c.name}" placeholder="Ej: Banco Popular"></div>
      <div><label>Teléfono</label><input id="cPhone" value="${c.phone || ''}" placeholder="Ej: 2222-3333"></div>
      <div><label>Correo</label><input id="cEmail" value="${c.email || ''}" placeholder="Ej: contacto@banco.com"></div>
      <div><label>Dirección</label><input id="cAddress" value="${c.address || ''}" placeholder="Opcional"></div>
    </div>
    <div style="margin-top:12px"><label>Notas</label><textarea id="cNotes" rows="2" placeholder="Condiciones, número de cuenta, etc.">${c.notes || ''}</textarea></div>
    <div class="modal-foot">
      ${id ? `<button class="btn danger" id="cDelete" style="margin-right:auto">Eliminar</button>` : ''}
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="cSave">Guardar</button>
    </div>
  `);

  document.getElementById('cSave').onclick = () => {
    const obj = {
      name: document.getElementById('cName').value.trim() || 'Sin nombre',
      phone: document.getElementById('cPhone').value.trim(),
      email: document.getElementById('cEmail').value.trim(),
      address: document.getElementById('cAddress').value.trim(),
      notes: document.getElementById('cNotes').value
    };
    let saved;
    if (id) { Object.assign(creditorById(id), obj); saved = creditorById(id); }
    else { saved = { id: uid(), ...obj }; DB.creditors.push(saved); }
    save(); closeModal();
    if (onSaved) onSaved(saved); else renderAll();
  };
  const del = document.getElementById('cDelete');
  if (del) del.onclick = async () => {
    const msg = debtCount
      ? `Este acreedor está asociado a ${debtCount} deuda${debtCount > 1 ? 's' : ''}; quedarán sin acreedor asignado. ¿Eliminar de todas formas?`
      : '¿Eliminar este acreedor?';
    if (!(await confirmDialog(msg))) return;
    DB.creditors = DB.creditors.filter(x => x.id !== id);
    DB.debts.forEach(d => { if (d.creditorId === id) d.creditorId = null; });
    save(); closeModal(); renderAll();
    toast('Acreedor eliminado.', 'success');
  };
}
