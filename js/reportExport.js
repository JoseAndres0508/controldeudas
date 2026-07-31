import { DB } from './state.js';
import { activeDebts, creditorName, debtById, fmtCRC, fmtDateLong, fmtMoney, lastBalance, periodTotalCRC, sortedPeriods, toCRC } from './utils.js';
import { debtStatus, totalPaidCRC } from './payments.js';

/* =========================================================
   EXPORTAR A EXCEL / PDF
   Usa SheetJS y jsPDF cargados por CDN en index.html; si no
   cargaron (sin internet, bloqueados), avisa en vez de fallar.
   ========================================================= */
export function exportExcel() {
  if (!window.XLSX) { alert('La librería de Excel no cargó (revisá tu conexión) — probá de nuevo o usá "Exportar respaldo" en Ajustes.'); return; }
  const wb = XLSX.utils.book_new();

  const debtRows = DB.debts.map(d => ({
    Deuda: d.name,
    Acreedor: creditorName(d) || 'Sin acreedor',
    Tipo: d.kind,
    Moneda: d.currency,
    'Tasa anual %': d.rate ?? '',
    'Cuota mínima': d.minPayment ?? '',
    'Saldo actual': lastBalance(d.id),
    Estado: debtStatus(d, toCRC(lastBalance(d.id), d.currency)),
    Archivada: d.archived ? 'Sí' : 'No'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(debtRows), 'Deudas');

  const cutRows = sortedPeriods().map(p => ({ Fecha: p.date, 'Deuda total (CRC)': Math.round(periodTotalCRC(p)), Nota: p.note || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cutRows), 'Cortes');

  const payRows = DB.payments.map(p => {
    const d = debtById(p.debtId);
    return { Fecha: p.date, Deuda: d ? d.name : '(borrada)', Monto: p.amount, Moneda: d ? d.currency : '', Nota: p.note || '' };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payRows), 'Pagos');

  const credRows = DB.creditors.map(c => ({ Nombre: c.name, Teléfono: c.phone || '', Correo: c.email || '', Dirección: c.address || '' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(credRows), 'Acreedores');

  XLSX.writeFile(wb, `libro-deudas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportPDF() {
  if (!window.jspdf) { alert('La librería de PDF no cargó (revisá tu conexión) — probá de nuevo o usá "Exportar respaldo" en Ajustes.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const totalDebt = activeDebts().reduce((s, d) => s + toCRC(lastBalance(d.id), d.currency), 0);
  const totalPaid = totalPaidCRC();

  doc.setFontSize(16);
  doc.text('Libro de deudas — Reporte', 14, 18);
  doc.setFontSize(10);
  doc.text(`Generado el ${fmtDateLong(new Date().toISOString().slice(0, 10))}`, 14, 24);
  doc.setFontSize(12);
  doc.text(`Total adeudado: ${fmtCRC(totalDebt)}`, 14, 34);
  doc.text(`Total pagado (histórico): ${fmtCRC(totalPaid)}`, 14, 41);

  doc.autoTable({
    startY: 50,
    head: [['Deuda', 'Acreedor', 'Estado', 'Saldo']],
    body: activeDebts().map(d => [d.name, creditorName(d) || '—', debtStatus(d, toCRC(lastBalance(d.id), d.currency)), fmtMoney(lastBalance(d.id), d.currency)])
  });

  doc.save(`libro-deudas-${new Date().toISOString().slice(0, 10)}.pdf`);
}
