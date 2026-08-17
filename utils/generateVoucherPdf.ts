// ============================================================
// Letterhead PDF for issued Payment Receipts / GST Invoices.
// Matches the same jsPDF conventions already used for Rann Utsav quotes
// (helvetica, slate/muted/accent palette, right-aligned value rows).
//
// TODO once the real logo file is provided: replace the placeholder text
// box below with `doc.addImage(LOGO_DATA_URI, 'PNG', 14, 14, 22, 22)`.
// ============================================================

export interface VoucherDoc {
  id: string;
  doc_type: 'invoice' | 'receipt';
  number: string | null;
  status: 'pending' | 'issued' | 'rejected' | 'cancelled';
  source: 'system' | 'external';
  lead_name: string | null;
  payment_reference_id: string;
  amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  place_of_supply: string | null;
  tax_type: 'none' | 'cgst_sgst' | 'igst';
  tax_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  notes: string | null;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

const BUSINESS = {
  name: 'THE TOURISM EXPERTS',
  gstin: '24ABAFT3344B1ZQ',
  email: 'booking@thetourismexperts.com',
  phone: '+91 92747 30220',
};

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

export async function generateVoucherPdf(d: VoucherDoc, mode: 'view' | 'download' = 'download') {
  // Open the tab synchronously, in the same tick as the click that called us —
  // once we `await` the jsPDF import below, the browser no longer considers a
  // later window.open() as coming from a direct user gesture and silently blocks it.
  const viewWin = mode === 'view' ? window.open('', '_blank') : null;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const slate = [15, 23, 42] as const;
  const muted = [100, 116, 139] as const;
  const accent = [232, 132, 26] as const; // matches the brand orange used elsewhere in the app
  const line = [226, 232, 240] as const;

  const isInvoice = d.doc_type === 'invoice';
  const title = isInvoice ? (d.tax_type === 'none' ? 'INVOICE' : 'TAX INVOICE') : 'PAYMENT RECEIPT';

  // ── Letterhead header ──
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 32, 'F');
  // Placeholder "logo" box — swap for doc.addImage(...) once the logo file is supplied
  doc.setDrawColor(...accent); doc.setLineWidth(0.6); doc.roundedRect(14, 7, 18, 18, 2, 2);
  doc.setTextColor(...accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
  doc.text('LOGO', 23, 17, { align: 'center' });

  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(BUSINESS.name, 37, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(203, 213, 225);
  doc.text(`GSTIN: ${BUSINESS.gstin}`, 37, 21);
  doc.setFontSize(8);
  doc.text(`${BUSINESS.email}   ·   ${BUSINESS.phone}`, W - 14, 15, { align: 'right' });
  doc.text(new Date().getFullYear() >= 2026 ? 'India' : 'India', W - 14, 21, { align: 'right' });

  let y = 44;

  // ── Document title band ──
  doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(title, 14, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...muted);
  doc.text(`No. ${d.number || '(pending)'}`, W - 14, y - 4, { align: 'right' });
  doc.text(`Date: ${fmtDate(d.approved_at || d.created_at)}`, W - 14, y + 2, { align: 'right' });
  y += 6;
  doc.setDrawColor(...line); doc.line(14, y, W - 14, y); y += 8;

  // ── Bill To / Details ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...muted);
  doc.text('BILLED TO', 14, y);
  doc.text('DETAILS', 120, y);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...slate);
  doc.text(d.customer_name || d.lead_name || '—', 14, y);
  doc.text(`Ref: ${d.payment_reference_id}`, 120, y);
  y += 6;
  if (d.customer_phone) { doc.text(d.customer_phone, 14, y); }
  doc.text(`Source: ${d.source === 'external' ? 'Externally registered' : 'The Tourism Experts CRM'}`, 120, y);
  y += 6;
  if (isInvoice && d.customer_gstin) { doc.text(`GSTIN: ${d.customer_gstin}`, 14, y); y += 6; }
  if (isInvoice && d.place_of_supply) { doc.text(`Place of supply: ${d.place_of_supply}`, 14, y); y += 6; }
  y += 4;

  doc.setDrawColor(...line); doc.line(14, y, W - 14, y); y += 8;

  // ── Line items ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...muted);
  doc.text('DESCRIPTION', 14, y);
  doc.text('AMOUNT', W - 14, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(...line); doc.line(14, y, W - 14, y); y += 7;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...slate);
  const desc = isInvoice
    ? `Travel booking services${d.lead_name ? ` — ${d.lead_name}` : ''}`
    : `Payment received towards travel booking${d.lead_name ? ` — ${d.lead_name}` : ''}`;
  doc.text(desc, 14, y);
  doc.text(fmt(d.tax_type === 'none' ? d.amount : d.taxable_value), W - 14, y, { align: 'right' });
  y += 8;

  if (isInvoice && d.tax_type !== 'none') {
    doc.setTextColor(...muted); doc.setFontSize(9.5);
    if (d.tax_type === 'cgst_sgst') {
      doc.text(`CGST (${(d.tax_rate / 2).toFixed(1)}%)`, 14, y); doc.text(fmt(d.cgst_amount), W - 14, y, { align: 'right' }); y += 6.5;
      doc.text(`SGST (${(d.tax_rate / 2).toFixed(1)}%)`, 14, y); doc.text(fmt(d.sgst_amount), W - 14, y, { align: 'right' }); y += 6.5;
    } else {
      doc.text(`IGST (${d.tax_rate}%)`, 14, y); doc.text(fmt(d.igst_amount), W - 14, y, { align: 'right' }); y += 6.5;
    }
    y += 1.5;
  }

  doc.setDrawColor(...line); doc.line(14, y, W - 14, y); y += 3;

  // ── Grand total band ──
  doc.setFillColor(240, 244, 248); doc.rect(14, y, W - 28, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...slate);
  doc.text('TOTAL', 18, y + 8);
  doc.text(fmt(d.amount), W - 18, y + 8, { align: 'right' });
  y += 22;

  if (d.notes) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...muted);
    doc.text(`Note: ${d.notes}`, 14, y, { maxWidth: W - 28 });
    y += 10;
  }

  // ── Cancelled watermark + banner ──
  if (d.status === 'cancelled') {
    doc.saveGraphicsState?.();
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(52);
    (doc as any).text('CANCELLED', W / 2, 160, { align: 'center', angle: 35 });
    doc.restoreGraphicsState?.();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...muted);
    doc.text(`Cancelled ${fmtDate(d.cancelled_at || '')}${d.cancellation_reason ? ` — ${d.cancellation_reason}` : ''}`, 14, y);
    y += 8;
  }

  // ── Signature ──
  const sigY = Math.max(y, 240);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...slate);
  doc.text(`For ${BUSINESS.name}`, W - 14, sigY, { align: 'right' });
  doc.setDrawColor(...muted); doc.line(W - 60, sigY + 14, W - 14, sigY + 14);
  doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text('Authorized Signatory', W - 14, sigY + 18, { align: 'right' });

  // ── Footer ──
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...muted);
  doc.text('This is a system-generated document.', 14, 285);
  doc.text(`${BUSINESS.name} · ${BUSINESS.email} · ${BUSINESS.phone}`, W / 2, 290, { align: 'center' });

  const filename = `${d.doc_type === 'invoice' ? 'Invoice' : 'Receipt'} ${d.number || d.payment_reference_id} — ${d.customer_name || 'Customer'}.pdf`;
  if (mode === 'view') {
    const blobUrl = doc.output('bloburl') as unknown as string;
    if (viewWin) viewWin.location.href = blobUrl;
    else window.open(blobUrl, '_blank'); // popup was blocked even for the blank tab — fall back and let the browser handle it
  } else {
    doc.save(filename);
  }
}
