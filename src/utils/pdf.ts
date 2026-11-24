import { jsPDF } from 'jspdf';
import type { BusinessProfile, Invoice, SupportedCurrency } from '../types';
import { formatCurrency, formatDate } from './format';

export function generateInvoicePdf(invoice: Invoice, business: BusinessProfile, mode: 'download' | 'print' = 'download') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  let y = 48;

  // Header band
  doc.setFillColor(7, 20, 38);
  doc.rect(0, 0, pageWidth, 110, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(business.name || 'SellSmart Business', margin, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(167, 180, 199);
  const contactParts = [business.address, business.phone, business.email].filter(Boolean);
  doc.text(contactParts.join('  ·  ') || business.country, margin, 68, { maxWidth: 320 });

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('INVOICE', pageWidth - margin, 44, { align: 'right' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(invoice.invoiceNumber, pageWidth - margin, 64, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(167, 180, 199);
  doc.text(`Status: ${invoice.paymentStatus.toUpperCase()}`, pageWidth - margin, 82, { align: 'right' });

  y = 140;

  // Bill To & Invoice Metadata
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILL TO', margin, y);
  doc.text('INVOICE DETAILS', pageWidth - margin - 160, y);

  y += 16;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(invoice.customerName || 'Walk-in Customer', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  if (invoice.customerPhone) {
    y += 15;
    doc.text(invoice.customerPhone, margin, y);
  }
  if (invoice.customerEmail) {
    y += 14;
    doc.text(invoice.customerEmail, margin, y);
  }
  if (invoice.customerAddress) {
    y += 14;
    doc.text(invoice.customerAddress, margin, y, { maxWidth: 240 });
  }

  let metaY = 156;
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Issue Date: ${formatDate(invoice.invoiceDate, business.timezone)}`, pageWidth - margin - 160, metaY);
  metaY += 15;
  doc.text(`Due Date: ${formatDate(invoice.dueDate, business.timezone)}`, pageWidth - margin - 160, metaY);
  metaY += 15;
  doc.text(`Currency: ${business.currency}`, pageWidth - margin - 160, metaY);

  y = Math.max(y, metaY) + 32;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 26, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESCRIPTION', margin + 10, y + 17);
  doc.text('QTY', pageWidth - margin - 185, y + 17, { align: 'right' });
  doc.text('UNIT PRICE', pageWidth - margin - 100, y + 17, { align: 'right' });
  doc.text('LINE TOTAL', pageWidth - margin - 10, y + 17, { align: 'right' });

  y += 34;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const currency = business.currency as SupportedCurrency;

  for (const item of invoice.items) {
    if (y > 700) {
      doc.addPage();
      y = 48;
    }
    doc.setTextColor(15, 23, 42);
    doc.text(item.description, margin + 10, y, { maxWidth: 260 });
    doc.text(String(item.quantity), pageWidth - margin - 185, y, { align: 'right' });
    doc.text(formatCurrency(item.unitPrice, currency), pageWidth - margin - 100, y, { align: 'right' });
    doc.text(formatCurrency(item.lineTotal, currency), pageWidth - margin - 10, y, { align: 'right' });

    y += 12;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  }

  y += 10;
  const totalsX = pageWidth - margin - 200;

  const drawTotalRow = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11.5 : 9.5);
    doc.setTextColor(bold ? 15 : 71, bold ? 23 : 85, bold ? 42 : 105);
    doc.text(label, totalsX, y);
    doc.text(val, pageWidth - margin - 10, y, { align: 'right' });
    y += 18;
  };

  drawTotalRow('Subtotal', formatCurrency(invoice.subtotal, currency));
  if (invoice.discount > 0) {
    drawTotalRow('Discount', `-${formatCurrency(invoice.discount, currency)}`);
  }
  if (invoice.taxAmount > 0) {
    drawTotalRow(`Tax (${invoice.taxRate}%)`, formatCurrency(invoice.taxAmount, currency));
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(totalsX, y - 8, pageWidth - margin, y - 8);
  y += 4;
  drawTotalRow('Total Amount', formatCurrency(invoice.totalAmount, currency), true);
  drawTotalRow('Amount Paid', formatCurrency(invoice.amountPaid, currency));
  const balanceDue = Math.max(0, invoice.totalAmount - invoice.amountPaid);
  drawTotalRow('Balance Due', formatCurrency(balanceDue, currency), true);

  if (invoice.notes) {
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTES & PAYMENT TERMS', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(invoice.notes, margin, y, { maxWidth: pageWidth - margin * 2 });
  }

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated with SellSmart AI', pageWidth / 2, 810, { align: 'center' });

  if (mode === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = String(blobUrl);
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 300);
  } else {
    doc.save(`${invoice.invoiceNumber}.pdf`);
  }
}

export function generateAnalyticsReportPdf(
  business: BusinessProfile,
  periodLabel: string,
  summary: {
    grossRevenue: number;
    cogs: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalOrders: number;
    inventoryValue: number;
  },
  topProducts: { name: string; unitsSold: number; revenue: number }[]
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const currency = business.currency as SupportedCurrency;

  doc.setFillColor(7, 20, 38);
  doc.rect(0, 0, pageWidth, 95, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${business.name} — Business Performance Report`, margin, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(167, 180, 199);
  doc.text(`Period: ${periodLabel}  ·  Currency: ${currency}  ·  Generated ${new Date().toISOString().slice(0, 10)}`, margin, 66);

  let y = 130;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Financial Summary', margin, y);
  y += 20;

  const rows: [string, string][] = [
    ['Gross Revenue', formatCurrency(summary.grossRevenue, currency)],
    ['Cost of Goods Sold (COGS)', formatCurrency(summary.cogs, currency)],
    ['Gross Profit', formatCurrency(summary.grossProfit, currency)],
    ['Business Expenses', formatCurrency(summary.totalExpenses, currency)],
    ['Net Profit', formatCurrency(summary.netProfit, currency)],
    ['Total Orders', String(summary.totalOrders)],
    ['Current Inventory Cost Value', formatCurrency(summary.inventoryValue, currency)],
  ];

  doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(k, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(v, pageWidth - margin, y, { align: 'right' });
    y += 18;
  }

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Top Performing Products', margin, y);
  y += 20;

  if (topProducts.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No product sales recorded in this period.', margin, y);
  } else {
    for (const p of topProducts.slice(0, 10)) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`${p.name} (${p.unitsSold} units)`, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(p.revenue, currency), pageWidth - margin, y, { align: 'right' });
      y += 18;
    }
  }

  doc.save(`${(business.name || 'sellsmart').toLowerCase().replace(/\s+/g, '-')}-analytics-report.pdf`);
}
