import { DB, save, setDB } from '../state.js';
import { activeDebts, fmtCRC, fmtDateLong, fmtMoney, fmtSigned, lastBalance, parseNum, pendingCutDate, series } from '../utils.js';
import { closeModal, showModal } from '../modal.js';
import { Store } from '../store.js';
import { uid } from '../uid.js';
import { renderAll } from '../render-all.js';
import { getFileName, getStatus, readFile, reconnect } from '../fileSync.js';

/* =========================================================
   PESTAÑA: CORTES
   ========================================================= */
export function renderCortes() {
  const el = document.getElementById('tab-cortes');
  const pending = pendingCutDate();
  const s = series();
  let html = '';

  if (!Store.persistent) {
    html += `<div class="banner">Este navegador bloqueó el almacenamiento local, así que los cambios viven solo en esta pestaña. Al publicarlo en GitHub Pages sí se guardan. Usá <strong>Exportar respaldo</strong> antes de cerrar.</div>`;
  }
  if (getStatus() === 'needs-permission') {
    html += `<div class="banner due"><span>Reconectá el archivo <strong>${getFileName()}</strong> para traer la última versión guardada.</span><button class="btn primary" id="btnReconnectFile">Reconectar archivo</button></div>`;
  }
  if (pending) {
    html += `<div class="banner due"><span>Falta registrar el corte del <strong>${fmtDateLong(pending)}</strong>.</span><button class="btn primary" data-newcut="${pending}">Registrar corte</button></div>`;
  }

  html += `<div class="card">
    <div class="card-head">
      <div><h2>Cortes registrados</h2><div class="dim" style="font-size:13px">Los días 15 y 30 anotás cuánto abonaste y con qué saldo quedó cada deuda.</div></div>
      <div class="btn-row">
        <button class="btn" data-newcut="">Nuevo corte</button>
      </div>
    </div>`;

  if (!s.length) {
    html += `<div class="empty">Todavía no hay cortes. Registrá el primero para empezar a medir.</div>`;
  } else {
    html += `<table><thead><tr>
      <th>Fecha</th><th class="ta-r">Deuda total (₡)</th><th class="ta-r">Cambio</th><th class="hide-sm">Resultado</th><th class="ta-r"></th>
    </tr></thead><tbody>`;
    [...s].reverse().forEach(x => {
      const cls = x.delta === null ? '' : x.delta > 0 ? 'd-down' : x.delta < 0 ? 'd-up' : '';
      const verdict = x.delta === null ? '<span class="dim">Punto de partida</span>'
        : x.delta > 0 ? '<span style="color:var(--down)">Avanzaste</span>'
        : x.delta < 0 ? '<span style="color:var(--up)">La deuda creció</span>'
        : '<span class="dim">Sin movimiento</span>';
      html += `<tr>
        <td class="num">${fmtDateLong(x.date)}</td>
        <td class="ta-r num">${fmtCRC(x.total)}</td>
        <td class="ta-r">${x.delta === null ? '<span class="dim">—</span>' : `<span class="delta ${cls}">${fmtSigned(x.delta)}</span>`}</td>
        <td class="hide-sm">${verdict}</td>
        <td class="ta-r"><button class="btn ghost" data-editcut="${x.id}">Abrir</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `</div>`;
  el.innerHTML = html;

  const btnRe = document.getElementById('btnReconnectFile');
  if (btnRe) btnRe.onclick = async () => {
    const ok = await reconnect();
    if (ok) {
      const data = await readFile();
      if (data && data.debts && data.periods) { setDB(data); save(); }
    }
    renderAll();
  };
}

/* ---- modal de corte ---- */
export function openCut(dateOrNull, periodId) {
  const existing = periodId ? DB.periods.find(p => p.id === periodId) : null;
  const date = existing ? existing.date : (dateOrNull || new Date().toISOString().slice(0, 10));
  const debts = activeDebts();

  const rows = debts.map(d => {
    const e = existing ? existing.entries[d.id] : null;
    const prev = lastBalance(d.id);
    const bal = e && e.balance !== null && e.balance !== undefined ? e.balance : prev;
    const paid = e && e.paid !== null && e.paid !== undefined ? e.paid : '';
    return `<div class="snap-row">
      <div class="snap-name">${d.name}<small>${d.issuer || ''} · saldo anterior ${fmtMoney(prev, d.currency)}</small></div>
      <div><label>Abono ${d.currency === 'USD' ? '($)' : '(₡)'}</label><input class="num-in" data-paid="${d.id}" value="${paid}" placeholder="0" inputmode="decimal"></div>
      <div><label>Saldo hoy ${d.currency === 'USD' ? '($)' : '(₡)'}</label><input class="num-in" data-bal="${d.id}" value="${bal}" inputmode="decimal"></div>
    </div>`;
  }).join('');

  showModal(`
    <h2>${existing ? 'Corte del ' + fmtDateLong(date) : 'Registrar corte'}</h2>
    <div class="grid g2" style="margin-bottom:6px">
      <div><label>Fecha del corte</label><input type="date" id="cutDate" value="${date}"></div>
      <div><label>Nota (opcional)</label><input id="cutNote" value="${existing ? (existing.note || '') : ''}" placeholder="Ej: pagué aguinaldo a Gollo"></div>
    </div>
    <hr style="margin:14px 0 4px">
    ${rows || '<div class="empty">Agregá deudas primero.</div>'}
    <div class="modal-foot">
      ${existing ? '<button class="btn danger" id="cutDelete" style="margin-right:auto">Eliminar corte</button>' : ''}
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" id="cutSave">Guardar corte</button>
    </div>
  `);

  document.getElementById('cutSave').onclick = () => {
    const newDate = document.getElementById('cutDate').value;
    if (!newDate) return;
    const entries = {};
    debts.forEach(d => {
      const bal = parseNum(document.querySelector(`[data-bal="${d.id}"]`).value);
      const paid = parseNum(document.querySelector(`[data-paid="${d.id}"]`).value);
      if (bal !== null) entries[d.id] = { balance: bal, paid };
    });
    const note = document.getElementById('cutNote').value;
    if (existing) { existing.date = newDate; existing.entries = { ...existing.entries, ...entries }; existing.note = note; }
    else {
      const clash = DB.periods.find(p => p.date === newDate);
      if (clash) { clash.entries = { ...clash.entries, ...entries }; clash.note = note; }
      else DB.periods.push({ id: uid(), date: newDate, entries, note });
    }
    save(); closeModal(); renderAll();
  };
  const del = document.getElementById('cutDelete');
  if (del) del.onclick = () => {
    if (!confirm('¿Eliminar este corte? No se puede deshacer.')) return;
    DB.periods = DB.periods.filter(p => p.id !== periodId);
    save(); closeModal(); renderAll();
  };
}
