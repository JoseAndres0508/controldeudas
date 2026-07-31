import { DB, save } from '../state.js';
import { activeDebts, bankPayoffDate, fmtCRC, fmtDateLong, fmtPeriods, lastBalance, monthsBetween, nextPaySlot, otherPaySlot, parseNum, payDateAfter, payDayOf, PERIODS_PER_YEAR, toCRC } from '../utils.js';

/* =========================================================
   CÓMO SE SIMULA
   La línea de tiempo avanza de quincena en quincena (15, 30,
   15, 30…) porque cada deuda vence en un día distinto. Pero
   cada deuda paga UNA sola vez al mes: su cuota completa, el
   día que le toca. No hay medias cuotas.

   El interés sí corre en cada quincena (tasa anual / 24),
   porque se acumula esté o no en fecha de pago.
   ========================================================= */
const MAX_PERIODS = 1200;               // 50 años, corte de seguridad

/* =========================================================
   PESTAÑA: ESTRATEGIA
   "¿Cuál ataco primero?" y la proyección de salida viven acá,
   con su propia entrada en el menú. Antes estaban metidas
   dentro de Inicio, donde se perdían entre el resto de las
   tarjetas siendo de lo más importante del sistema.
   ========================================================= */
export function orderedPlan(strategy) {
  const list = activeDebts()
    .map(d => ({ d, bal: toCRC(lastBalance(d.id), d.currency), rate: d.rate, min: toCRC(d.minPayment || 0, d.currency), day: payDayOf(d) }))
    .filter(x => x.bal > 0);
  if (strategy === 'avalancha') list.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || a.bal - b.bal);
  else list.sort((a, b) => a.bal - b.bal);
  return list;
}

/** Turno (15 o 30) que corresponde a la n-ésima quincena de la simulación. */
const slotAt = (n, first) => (n % 2 === 1 ? first : otherPaySlot(first));

/** Simula el plan completo.
 *
 *  En cada quincena: corre el interés de todas las deudas, y las que
 *  vencen ese día pagan su cuota mensual completa. El dinero extra —más
 *  las cuotas que quedan libres cuando una deuda se salda— se le suma a
 *  la primera de la lista el día que a ella le toca pagar.
 *
 *  `extraMonthly` es el extra mensual, y se aplica una vez al mes.
 *
 *  Devuelve el plazo en quincenas (`periods`) y la fecha real de salida,
 *  que siempre cae en un 15 o un 30. */
export function simulate(strategy, extraMonthly, from = new Date()) {
  const plan = orderedPlan(strategy);
  if (!plan.length || plan.some(p => p.rate === null || p.rate === undefined)) return null;
  if (!plan.some(p => p.min > 0)) return null;

  const debts = plan.map(p => ({
    name: p.d.name, bal: p.bal, min: p.min, day: p.day,
    rate: p.rate / 100 / PERIODS_PER_YEAR
  }));
  const first = nextPaySlot(from);

  let periods = 0, interest = 0, freed = 0;   // freed: cuotas de deudas ya saldadas
  const payoff = {};

  while (debts.some(d => d.bal > 0.5) && periods < MAX_PERIODS) {
    periods++;
    const day = slotAt(periods, first);

    // El interés corre siempre, toque pagar o no.
    debts.forEach(d => { if (d.bal > 0) { const i = d.bal * d.rate; d.bal += i; interest += i; } });

    // Sólo pagan las deudas que vencen hoy, y pagan la cuota completa.
    debts.forEach(d => { if (d.bal > 0 && d.day === day) d.bal -= Math.min(d.min, d.bal); });

    // El extra y lo liberado van al objetivo, el día que a él le toca.
    const target = debts.find(d => d.bal > 0.5);
    if (target && target.day === day) {
      const pool = (extraMonthly || 0) + freed;
      if (pool > 0) target.bal -= Math.min(pool, target.bal);
    }

    debts.forEach(d => {
      if (d.bal <= 0.5 && !payoff[d.name]) { payoff[d.name] = periods; d.bal = 0; freed += d.min; }
    });
  }

  const reached = periods < MAX_PERIODS;
  return { periods, interest, payoff, reached, endDate: reached ? payDateAfter(periods, from) : null };
}

/** Proyección de UNA sola deuda pagando sólo su cuota mensual el día que
 *  le toca, sin extra ni orden de ataque. */
export function singleDebtProjection(balCRC, ratePct, minMonthlyCRC, payDay = 30, from = new Date()) {
  if (ratePct === null || ratePct === undefined || !minMonthlyCRC || balCRC <= 0) return null;
  const rate = ratePct / 100 / PERIODS_PER_YEAR;
  const first = nextPaySlot(from);
  let bal = balCRC, periods = 0, interest = 0;

  while (bal > 0.5 && periods < MAX_PERIODS) {
    periods++;
    const i = bal * rate;
    bal += i; interest += i;
    if (slotAt(periods, first) === payDay) bal -= Math.min(minMonthlyCRC, bal);
  }

  const reached = periods < MAX_PERIODS;
  return { periods, interest, reached, endDate: reached ? payDateAfter(periods, from) : null };
}

/** Contraste entre el plan propio y los plazos que pusieron las entidades.
 *  Toma la deuda que la entidad termina más tarde: ése es el día en que
 *  saldrías si sólo te dejaras llevar por el banco. */
function bankVsPlanHTML(sim) {
  const dates = activeDebts()
    .map(d => ({ d, bank: bankPayoffDate(d) }))
    .filter(x => x.bank && toCRC(lastBalance(x.d.id), x.d.currency) > 0);
  if (!dates.length) {
    return `<p class="dim" style="font-size:.75rem;margin:0">Cargá la <strong>fecha de inicio</strong> y el <strong>plazo del banco</strong> en tus deudas para ver cuánto le ganás al calendario de las entidades.</p>`;
  }
  const last = dates.reduce((a, b) => (a.bank > b.bank ? a : b));
  const diff = monthsBetween(sim.endDate, last.bank);
  const verdict = diff > 0
    ? `Le ganás <strong style="color:var(--down)">${diff} ${diff === 1 ? 'mes' : 'meses'}</strong> al calendario de las entidades.`
    : diff < 0
      ? `Vas <strong style="color:var(--up)">${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'mes' : 'meses'}</strong> por detrás del plazo de las entidades: la cuota mínima no alcanza para cerrar a tiempo.`
      : `Vas justo al ritmo que pusieron las entidades.`;
  return `<div style="border-top:1px solid var(--rule-soft);padding-top:10px">
    <p style="font-size:.8125rem;margin:0"><span class="chip">vs. el banco</span> Según los plazos de las entidades, la última en cerrar sería <strong>${last.d.name}</strong> el ${fmtDateLong(last.bank)}. ${verdict}</p>
  </div>`;
}

/** Fragmento de HTML de la tarjeta "¿Cuál ataco primero?" + proyección. */
export function strategySectionHTML() {
  const st = DB.settings.strategy || 'avalancha';
  const extra = DB.settings.extra || 0;
  const plan = orderedPlan(st);
  const missing = plan.filter(p => p.rate === null || p.rate === undefined);
  const noMin = plan.filter(p => !p.min);

  let html = `<div class="card">
    <div class="card-head">
      <div><h2>¿Cuál ataco primero?</h2><div class="dim" style="font-size:.8125rem">Pagás la cuota mínima de todas y cualquier plata extra va completa a la primera de la lista. Los abonos caen los 15 y los 30.</div></div>
      <div class="seg">
        <button data-strat="avalancha" aria-pressed="${st === 'avalancha'}">Avalancha</button>
        <button data-strat="bola" aria-pressed="${st === 'bola'}">Bola de nieve</button>
      </div>
    </div>
    <p class="muted" style="font-size:.8125rem;margin:0 0 14px">${st === 'avalancha'
      ? 'Avalancha: primero la tasa más alta. Es la que menos intereses te cuesta en total.'
      : 'Bola de nieve: primero el saldo más pequeño. Cuesta un poco más en intereses, pero cerrás deudas rápido y eso sostiene la motivación.'}</p>`;

  if (missing.length) html += `<div class="banner" style="margin-bottom:14px"><span>Faltan tasas en: <strong>${missing.map(m => m.d.name).join(', ')}</strong>. El orden de avalancha las manda al final por defecto.</span><button class="btn" data-goto="deudas">Completar tasas</button></div>`;

  html += `<div style="margin-bottom:16px;max-width:260px">
    <label>Pago extra mensual (₡)</label>
    <input class="num-in" id="extraIn" value="${extra}" inputmode="decimal">
    <p class="dim" style="font-size:.6875rem;margin:5px 0 0">Se le suma completo a la deuda objetivo, el día que ella paga.</p>
  </div>`;

  html += `<table><thead><tr><th></th><th>Orden de ataque</th><th class="ta-r">Tasa</th><th class="hide-sm">Paga el</th><th class="ta-r hide-sm">Cuota mín.</th><th class="ta-r">Saldo (₡)</th></tr></thead><tbody>`;
  plan.forEach((p, i) => {
    html += `<tr>
      <td class="rank ${i === 0 ? 'first' : ''}">${String(i + 1).padStart(2, '0')}</td>
      <td>${i === 0 ? '<strong style="font-weight:500">' : ''}${p.d.name}${i === 0 ? '</strong> <span class="chip warn">objetivo</span>' : ''}</td>
      <td class="ta-r num">${p.rate === null || p.rate === undefined ? '<span class="chip warn">falta</span>' : p.rate.toFixed(2) + '%'}</td>
      <td class="hide-sm num" style="font-size:.8125rem">${p.day}${p.d.dueDay == null ? ' <span class="dim">(asumido)</span>' : ''}</td>
      <td class="ta-r num hide-sm">${p.min ? fmtCRC(p.min) : '<span class="dim">—</span>'}</td>
      <td class="ta-r num">${fmtCRC(p.bal)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;

  const simA = simulate('avalancha', extra), simB = simulate('bola', extra);
  if (simA && simB && simA.reached && simB.reached) {
    const diff = simB.interest - simA.interest;
    const pdiff = Math.abs(simB.periods - simA.periods);
    const chosen = st === 'avalancha' ? simA : simB;
    html += `<div class="card">
      <div class="card-head"><h3>Proyección con estos datos</h3>
        <span class="chip">abonos los 15 y 30</span>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="k">Avalancha · libre en</div><div class="v" style="font-size:.9375rem">${fmtPeriods(simA.periods)}</div></div>
        <div class="stat"><div class="k">Avalancha · intereses</div><div class="v">${fmtCRC(simA.interest)}</div></div>
        <div class="stat"><div class="k">Bola de nieve · libre en</div><div class="v" style="font-size:.9375rem">${fmtPeriods(simB.periods)}</div></div>
        <div class="stat"><div class="k">Bola de nieve · intereses</div><div class="v">${fmtCRC(simB.interest)}</div></div>
      </div>
      <p style="font-size:.875rem;margin:0 0 8px">Con <strong>${st === 'avalancha' ? 'avalancha' : 'bola de nieve'}</strong> quedás libre el <strong>${fmtDateLong(chosen.endDate)}</strong>, en ${chosen.periods} quincenas.</p>
      <p class="muted" style="font-size:.8125rem;margin:0 0 10px">La avalancha te ahorra <strong>${fmtCRC(Math.abs(diff))}</strong> en intereses y ${pdiff} quincena${pdiff === 1 ? '' : 's'} respecto a la bola de nieve. Elegí bola de nieve solo si necesitás ver deudas cerradas para no rendirte.</p>
      ${bankVsPlanHTML(chosen)}</div>`;
  } else {
    html += `<div class="card"><h3 style="margin-bottom:8px">Proyección</h3>
      <p class="muted" style="font-size:.875rem;margin:0">Para simular en cuánto tiempo salís y cuánto pagás en intereses, cada deuda activa necesita <strong>tasa anual</strong> y <strong>cuota mínima</strong>. ${noMin.length ? `Faltan cuotas en: ${noMin.map(m => m.d.name).join(', ')}.` : ''}</p>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-goto="deudas">Ir a completar los datos</button></div></div>`;
  }
  return html;
}

/** Conecta el input de pago extra después de insertar strategySectionHTML() en el DOM. */
export function wireStrategySection(rerender) {
  const inp = document.getElementById('extraIn');
  if (inp) inp.onchange = () => { DB.settings.extra = parseNum(inp.value) || 0; save(); rerender(); };
}

/** Pinta la pestaña completa. */
export function renderEstrategia() {
  const el = document.getElementById('tab-estrategia');
  if (!el) return;
  el.innerHTML = strategySectionHTML();
  wireStrategySection(renderEstrategia);
}
