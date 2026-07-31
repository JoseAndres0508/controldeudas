import { DB, save } from '../state.js';
import { activeDebts, fmtCRC, lastBalance, parseNum, toCRC } from '../utils.js';

/* =========================================================
   PESTAÑA: ESTRATEGIA (bola de nieve vs avalancha)
   ========================================================= */
export function orderedPlan(strategy) {
  const list = activeDebts()
    .map(d => ({ d, bal: toCRC(lastBalance(d.id), d.currency), rate: d.rate, min: toCRC(d.minPayment || 0, d.currency) }))
    .filter(x => x.bal > 0);
  if (strategy === 'avalancha') list.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.bal - b.bal);
  else list.sort((a, b) => a.bal - b.bal);
  return list;
}

/** Simula mes a mes: interés, cuotas mínimas, y el extra al objetivo. */
export function simulate(strategy, extra) {
  const plan = orderedPlan(strategy);
  if (!plan.length || plan.some(p => p.rate === null || p.rate === undefined)) return null;
  let debts = plan.map(p => ({ name: p.d.name, bal: p.bal, rate: p.rate / 100 / 12, min: p.min }));
  const totalMin = debts.reduce((s, d) => s + d.min, 0);
  if (totalMin <= 0) return null;
  let months = 0, interest = 0;
  const payoff = {};
  while (debts.some(d => d.bal > 0.5) && months < 600) {
    months++;
    let pool = totalMin + extra;
    debts.forEach(d => { if (d.bal > 0) { const i = d.bal * d.rate; d.bal += i; interest += i; } });
    debts.forEach(d => { if (d.bal > 0) { const pay = Math.min(d.min, d.bal); d.bal -= pay; pool -= pay; } });
    for (const d of debts) {
      if (pool <= 0) break;
      if (d.bal > 0) { const pay = Math.min(pool, d.bal); d.bal -= pay; pool -= pay; }
    }
    debts.forEach(d => { if (d.bal <= 0.5 && !payoff[d.name]) { payoff[d.name] = months; d.bal = 0; } });
  }
  return { months, interest, payoff, reached: months < 600 };
}

export function renderEstrategia() {
  const el = document.getElementById('tab-estrategia');
  const st = DB.settings.strategy || 'avalancha';
  const extra = DB.settings.extra || 0;
  const plan = orderedPlan(st);
  const missing = plan.filter(p => p.rate === null || p.rate === undefined);
  const noMin = plan.filter(p => !p.min);

  let html = `<div class="card">
    <div class="card-head">
      <div><h2>¿Cuál ataco primero?</h2><div class="dim" style="font-size:13px">Pagás la cuota mínima de todas y cualquier plata extra va completa a la primera de la lista.</div></div>
      <div class="seg">
        <button data-strat="avalancha" aria-pressed="${st === 'avalancha'}">Avalancha</button>
        <button data-strat="bola" aria-pressed="${st === 'bola'}">Bola de nieve</button>
      </div>
    </div>
    <p class="muted" style="font-size:13px;margin:0 0 14px">${st === 'avalancha'
      ? 'Avalancha: primero la tasa más alta. Es la que menos intereses te cuesta en total.'
      : 'Bola de nieve: primero el saldo más pequeño. Cuesta un poco más en intereses, pero cerrás deudas rápido y eso sostiene la motivación.'}</p>`;

  if (missing.length) html += `<div class="banner" style="margin-bottom:14px"><span>Faltan tasas en: <strong>${missing.map(m => m.d.name).join(', ')}</strong>. El orden de avalancha las manda al final por defecto.</span><button class="btn" data-goto="deudas">Completar tasas</button></div>`;

  html += `<div style="margin-bottom:16px;max-width:260px"><label>Pago extra mensual (₡)</label><input class="num-in" id="extraIn" value="${extra}" inputmode="decimal"></div>`;

  html += `<table><thead><tr><th></th><th>Orden de ataque</th><th class="ta-r">Tasa</th><th class="ta-r hide-sm">Cuota mín.</th><th class="ta-r">Saldo (₡)</th></tr></thead><tbody>`;
  plan.forEach((p, i) => {
    html += `<tr>
      <td class="rank ${i === 0 ? 'first' : ''}">${String(i + 1).padStart(2, '0')}</td>
      <td>${i === 0 ? '<strong style="font-weight:500">' : ''}${p.d.name}${i === 0 ? '</strong> <span class="chip warn">objetivo</span>' : ''}</td>
      <td class="ta-r num">${p.rate === null || p.rate === undefined ? '<span class="chip warn">falta</span>' : p.rate.toFixed(2) + '%'}</td>
      <td class="ta-r num hide-sm">${p.min ? fmtCRC(p.min) : '<span class="dim">—</span>'}</td>
      <td class="ta-r num">${fmtCRC(p.bal)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;

  const simA = simulate('avalancha', extra), simB = simulate('bola', extra);
  if (simA && simB && simA.reached && simB.reached) {
    const diff = simB.interest - simA.interest;
    const mdiff = simB.months - simA.months;
    html += `<div class="card"><h3 style="margin-bottom:12px">Proyección con estos datos</h3>
      <div class="stat-row">
        <div class="stat"><div class="k">Avalancha · libre en</div><div class="v">${simA.months} meses</div></div>
        <div class="stat"><div class="k">Avalancha · intereses</div><div class="v">${fmtCRC(simA.interest)}</div></div>
        <div class="stat"><div class="k">Bola de nieve · libre en</div><div class="v">${simB.months} meses</div></div>
        <div class="stat"><div class="k">Bola de nieve · intereses</div><div class="v">${fmtCRC(simB.interest)}</div></div>
      </div>
      <p class="muted" style="font-size:13px;margin:0">La avalancha te ahorra <strong>${fmtCRC(Math.abs(diff))}</strong> en intereses y ${Math.abs(mdiff)} mes${Math.abs(mdiff) === 1 ? '' : 'es'} respecto a la bola de nieve. Elegí bola de nieve solo si necesitás ver deudas cerradas para no rendirte.</p></div>`;
  } else {
    html += `<div class="card"><h3 style="margin-bottom:8px">Proyección</h3>
      <p class="muted" style="font-size:14px;margin:0">Para simular en cuánto tiempo salís y cuánto pagás en intereses, cada deuda activa necesita <strong>tasa anual</strong> y <strong>cuota mínima</strong>. ${noMin.length ? `Faltan cuotas en: ${noMin.map(m => m.d.name).join(', ')}.` : ''}</p>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-goto="deudas">Ir a completar los datos</button></div></div>`;
  }
  el.innerHTML = html;

  const inp = document.getElementById('extraIn');
  inp.onchange = () => { DB.settings.extra = parseNum(inp.value) || 0; save(); renderEstrategia(); };
}
