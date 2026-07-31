import { activeDebts, debtProgress, fmtCRC, fmtDate, overallProgress, series, toCRC } from '../utils.js';

/* =========================================================
   GRÁFICOS (Chart.js, cargado global vía <script> UMD en index.html)
   Ya no es una pestaña propia: su fragmento de HTML y su dibujo
   se insertan dentro de la pestaña "Inicio" (js/tabs/inicio.js).
   ========================================================= */
let chart1, chart2, chart3;

export function chartsSectionHTML() {
  const hasProgress = !!overallProgress();
  return `
    <div class="card"><h3 style="margin-bottom:4px">Deuda total en colones</h3>
      <p class="dim" style="font-size:13px;margin:0 0 12px">La línea punteada es el total con el que arrancaste.</p>
      <div class="chart-box"><canvas id="c1" role="img" aria-label="Línea de la deuda total en colones por fecha de corte">Deuda total por corte.</canvas></div></div>
    <div class="card"><h3 style="margin-bottom:4px">Movimiento por corte</h3>
      <p class="dim" style="font-size:13px;margin:0 0 12px">Barra hacia arriba = la deuda bajó. Hacia abajo = creció.</p>
      <div class="chart-box"><canvas id="c2" role="img" aria-label="Barras del cambio de deuda por corte">Cambio de deuda por corte.</canvas></div></div>
    ${hasProgress ? `<div class="card"><h3 style="margin-bottom:4px">Saldo inicial vs. actual por deuda</h3>
      <p class="dim" style="font-size:13px;margin:0 0 12px">Cuánto queda de cada deuda respecto a con cuánto empezó.</p>
      <div class="chart-box"><canvas id="c3" role="img" aria-label="Barras comparando saldo inicial y actual de cada deuda">Saldo inicial contra saldo actual por deuda.</canvas></div></div>` : ''}`;
}

/** Dibuja los gráficos; llamar después de insertar chartsSectionHTML() en el DOM. */
export function drawCharts() {
  const s = series();
  if (!window.Chart || !s.length) return;
  const labels = s.map(x => fmtDate(x.date));
  const axis = { grid: { color: '#DEE2DB' }, ticks: { color: '#8A918A', font: { size: 10, family: 'IBM Plex Mono' } } };
  chart1?.destroy(); chart2?.destroy(); chart3?.destroy();

  const overall = overallProgress();
  const datasets1 = [{ label: 'Deuda total', data: s.map(x => x.total), borderColor: '#101418', backgroundColor: 'rgba(16,20,24,.06)', fill: true, tension: .15, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#101418' }];
  if (overall) {
    datasets1.push({ label: 'Saldo inicial', data: labels.map(() => overall.initial), borderColor: '#8A918A', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false });
  }
  chart1 = new Chart(document.getElementById('c1'), {
    type: 'line',
    data: { labels, datasets: datasets1 },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtCRC(c.raw)}` } } },
      scales: { x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 45, autoSkip: false } }, y: { ...axis, ticks: { ...axis.ticks, callback: v => '₡' + (v / 1e6).toFixed(0) + 'M' } } } }
  });
  chart2 = new Chart(document.getElementById('c2'), {
    type: 'bar',
    data: { labels, datasets: [{ data: s.map(x => x.delta), backgroundColor: s.map(x => x.delta === null ? 'transparent' : x.delta >= 0 ? '#0F6E56' : '#A32D2D'), borderRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw === null ? 'sin dato' : (c.raw > 0 ? 'Bajó ' : 'Subió ') + fmtCRC(Math.abs(c.raw)) } } },
      scales: { x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 45, autoSkip: false } }, y: { ...axis, ticks: { ...axis.ticks, callback: v => (v < 0 ? '-' : '') + '₡' + Math.abs(v / 1e6).toFixed(1) + 'M' } } } }
  });

  // Inicial vs. actual por deuda: sólo las que tienen saldo inicial cargado.
  const canvas3 = document.getElementById('c3');
  if (!canvas3) return;
  const rows = activeDebts()
    .map(d => ({ d, p: debtProgress(d) }))
    .filter(x => x.p)
    .map(({ d, p }) => ({ name: d.name, initial: toCRC(p.initial, d.currency), current: toCRC(p.current, d.currency) }))
    .sort((a, b) => b.initial - a.initial);
  if (!rows.length) return;
  chart3 = new Chart(canvas3, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [
        { label: 'Saldo inicial', data: rows.map(r => r.initial), backgroundColor: '#C9CEC6', borderRadius: 3 },
        { label: 'Saldo actual', data: rows.map(r => r.current), backgroundColor: '#101418', borderRadius: 3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: true, labels: { color: '#4E5650', font: { size: 11, family: 'Archivo' }, boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtCRC(c.raw)}` } } },
      scales: { x: { ...axis, ticks: { ...axis.ticks, callback: v => '₡' + (v / 1e6).toFixed(0) + 'M' } }, y: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, font: { size: 10, family: 'Archivo' } } } } }
  });
}
