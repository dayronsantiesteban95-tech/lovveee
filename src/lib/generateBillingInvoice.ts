/**
 * ═══════════════════════════════════════════════════════════
 * generateBillingInvoice — Billing Module PDF Generator
 * Anika Logistics Group
 * ═══════════════════════════════════════════════════════════
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ───────────────────────────────────────────────
export interface BillingLineItem {
  description: string;
  reference_number?: string | null;
  service_date?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface BillingInvoiceData {
  invoice_number: string;
  client_name: string;
  billing_email?: string | null;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes?: string | null;
  line_items: BillingLineItem[];
}

// ─── Color Palette ────────────────────────────────────────
const C = {
  primary:    [15, 23, 42] as [number, number, number],
  accent:     [37, 99, 235] as [number, number, number],
  accentLight:[219, 234, 254] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  gray100:    [243, 244, 246] as [number, number, number],
  gray200:    [229, 231, 235] as [number, number, number],
  gray400:    [156, 163, 175] as [number, number, number],
  gray600:    [75, 85, 99] as [number, number, number],
  green:      [21, 128, 61] as [number, number, number],
  greenLight: [220, 252, 231] as [number, number, number],
  red:        [185, 28, 28] as [number, number, number],
};

// ─── Helpers ─────────────────────────────────────────────
function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export function generateBillingInvoice(invoice: BillingInvoiceData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();

  // ── Full-page white background ────────────────────────
  doc.setFillColor(...C.white);
  doc.rect(0, 0, W, 279.4, "F");

  // ── Header Banner ─────────────────────────────────────
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, W, 48, "F");

  // Accent strip
  doc.setFillColor(...C.accent);
  doc.rect(0, 48, W, 3, "F");

  // Company name
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("ANIKA LOGISTICS GROUP", 16, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 196, 220);
  doc.text("4722 E Mcdowell Rd, Phoenix, AZ 85008", 16, 28);
  doc.text("Phone: +1-877-701-1919  |  billing@anikalogistics.com", 16, 34);
  doc.text("www.anikalogistics.com", 16, 40);

  // "INVOICE" on right
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", W - 16, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 196, 220);
  doc.text(invoice.invoice_number, W - 16, 30, { align: "right" });

  // ── Meta Block ────────────────────────────────────────
  let y = 62;
  const leftX = 16;
  const rightX = W / 2 + 10;

  // BILL TO label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.accent);
  doc.text("BILL TO", leftX, y);
  doc.text("INVOICE DETAILS", rightX, y);

  y += 5;

  // Client name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.primary);
  doc.text(invoice.client_name, leftX, y);

  if (invoice.billing_email) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.gray600);
    doc.text(invoice.billing_email, leftX, y + 5);
  }

  // Detail rows on right
  const detailRows: [string, string][] = [
    ["Invoice #:", invoice.invoice_number],
    ["Issue Date:", fmtDate(invoice.issue_date)],
    ["Due Date:", fmtDate(invoice.due_date)],
    ["Payment Terms:", "Net 30"],
    ["Status:", invoice.status.toUpperCase()],
  ];

  let detailY = y;
  detailRows.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray600);
    doc.text(label, rightX, detailY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.primary);
    doc.text(val, rightX + 38, detailY);
    detailY += 5.5;
  });

  y = Math.max(y + 15, detailY) + 6;

  // ── Divider ───────────────────────────────────────────
  doc.setDrawColor(...C.gray200);
  doc.setLineWidth(0.4);
  doc.line(leftX, y, W - 16, y);
  y += 8;

  // ── Line Items Table ──────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text("LINE ITEMS", leftX, y);
  y += 4;

  const tableRows = invoice.line_items.map((item) => [
    item.service_date ? new Date(item.service_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
    item.reference_number || "—",
    item.description,
    item.quantity.toString(),
    fmt$(item.unit_price),
    fmt$(item.subtotal),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Ref #", "Description", "Qty", "Unit Price", "Amount"]],
    body: tableRows,
    margin: { left: leftX, right: 16 },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: C.primary,
      lineColor: C.gray200,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: C.accentLight,
      textColor: C.accent,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: C.gray100,
    },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 22 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Totals ─────────────────────────────────────────────
  const totalsX = W - 16 - 65;
  const valX = W - 16;

  const drawTotalRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(...(color ?? C.gray600));
    doc.text(label, totalsX, y);
    doc.setTextColor(...(color ?? C.primary));
    doc.text(value, valX, y, { align: "right" });
    y += 6;
  };

  drawTotalRow("Subtotal:", fmt$(invoice.subtotal));
  if (invoice.tax_amount > 0) {
    drawTotalRow("Tax:", fmt$(invoice.tax_amount));
  }

  // Total line
  doc.setDrawColor(...C.gray200);
  doc.setLineWidth(0.4);
  doc.line(totalsX, y - 1, valX, y - 1);
  y += 2;
  drawTotalRow("TOTAL:", fmt$(invoice.total_amount), true, C.accent);

  if (invoice.amount_paid > 0) {
    drawTotalRow("Amount Paid:", fmt$(invoice.amount_paid), false, C.green);
    const balance = invoice.total_amount - invoice.amount_paid;
    drawTotalRow("Balance Due:", fmt$(balance), true, balance > 0 ? C.red : C.green);
  }

  y += 6;

  // ── Notes ─────────────────────────────────────────────
  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text("NOTES", leftX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gray600);
    const noteLines = doc.splitTextToSize(invoice.notes, W - 32);
    doc.text(noteLines, leftX, y);
    y += noteLines.length * 4.5 + 6;
  }

  // ── Payment Footer ────────────────────────────────────
  doc.setFillColor(...C.gray100);
  doc.roundedRect(leftX, y, W - 32, 22, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text("PAYMENT INFORMATION", leftX + 6, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gray600);
  doc.text("Payment due within 30 days. Thank you for your business.", leftX + 6, y + 13);
  doc.text("Checks payable to: Anika Logistics Group  |  Questions: billing@anikalogistics.com", leftX + 6, y + 18.5);

  y += 30;

  // Thank you
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.accent);
  doc.text("Thank you for your business!", W / 2, y, { align: "center" });

  // ── PAID Watermark ────────────────────────────────────
  if (invoice.status === "paid") {
    const pageH = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.15 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(80);
    doc.setTextColor(...C.green);
    doc.text("PAID", W / 2, pageH / 2, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
  }

  // ── Footer Strip ──────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.primary);
  doc.rect(0, pageH - 12, W, 12, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 196, 220);
  doc.text(
    `${invoice.invoice_number}  |  Anika Logistics Group  |  +1-877-701-1919  |  Page 1 of 1`,
    W / 2,
    pageH - 4.5,
    { align: "center" },
  );

  // ── Save ──────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`ANIKA-${invoice.invoice_number}-${dateStr}.pdf`);
}
