import { fmtCRC, fmtDate, series } from '../utils.js';

/* =========================================================
   PESTAÑA: HISTORIAL (gráficos con Chart.js, cargado global
   vía <script> UMD en index.html)
   ========================================================= */
let chart1, chart2;

export function renderHistorial() {
  const el = document.getElementById('tab-historial');
  const s = series();
  el.innerHTML = `
    <div class="card"><h3 style="margin-bottom:12px">Deuda total en colones</h3>
      <div class="chart-box"><canvas id="c1" role="img" aria-label="Línea de la deuda total en colones por fecha de corte">Deuda total por corte.</canvas></div></div>
    <div class="card"><h3 style="margin-bottom:4px">Movimiento por corte</h3>
      <p class="dim" style="font-size:13px;margin:0 0 12px">Barra hacia arriba = la deuda bajó. Hacia abajo = creció.</p>
      <div class="chart-box"><canvas id="c2" role="img" aria-label="Barras del cambio de deuda por corte">Cambio de deuda por corte.</canvas></div></div>`;

  if (!window.Chart || !s.length) return;
  const labels = s.map(x => fmtDate(x.date));
  const axis = { grid: { color: '#DEE2DB' }, ticks: { color: '#8A918A', font: { size: 10, family: 'IBM Plex Mono' } } };
  chart1?.destroy(); chart2?.destroy();
  chart1 = new Chart(document.getElementById('c1'), {
    type: 'line',
    data: { labels, datasets: [{ data: s.map(x => x.total), borderColor: '#101418', backgroundColor: 'rgba(16,20,24,.06)', fill: true, tension: .15, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#101418' }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtCRC(c.raw) } } },
      scales: { x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 45, autoSkip: false } }, y: { ...axis, ticks: { ...axis.ticks, callback: v => '₡' + (v / 1e6).toFixed(0) + 'M' } } } }
  });
  chart2 = new Chart(document.getElementById('c2'), {
    type: 'bar',
    data: { labels, datasets: [{ data: s.map(x => x.delta), backgroundColor: s.map(x => x.delta === null ? 'transparent' : x.delta >= 0 ? '#0F6E56' : '#A32D2D'), borderRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw === null ? 'sin dato' : (c.raw > 0 ? 'Bajó ' : 'Subió ') + fmtCRC(Math.abs(c.raw)) } } },
      scales: { x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, maxRotation: 45, autoSkip: false } }, y: { ...axis, ticks: { ...axis.ticks, callback: v => (v < 0 ? '-' : '') + '₡' + Math.abs(v / 1e6).toFixed(1) + 'M' } } } }
  });
}
