/**
 * -----------------------------------------------------------
 * generateInvoice -- Professional PDF Invoice Generator
 * Anika Logistics Group
 * -----------------------------------------------------------
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Types -----------------------------------------------
export interface InvoiceLoad {
  id: string;
  reference_number: string | null;
  client_name: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  pickup_company: string | null;
  delivery_company: string | null;
  revenue: number;
  packages: number;
  weight_kg: number | null;
  weight_lbs: number | null;
  package_type: string | null;
  service_type: string;
  actual_pickup: string | null;
  actual_delivery: string | null;
  load_date: string;
  miles: number;
  hub: string;
}

// --- Helpers ---------------------------------------------

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

function fmtDateOnly(ts: string | null | undefined): string {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "--";
  }
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Truncate a string to maxLen characters, appending "..." if truncated. */
function truncate(str: string | null | undefined, maxLen: number): string {
  if (!str) return "--";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function breakdownRevenue(revenue: number, miles: number): {
  base: number;
  additionalMiles: number;
  fuel: number;
  total: number;
} {
  // If we have an actual revenue figure, reverse-engineer it
  // Base rate = $105, fuel surcharge = 25% of base
  // Additional miles beyond 20 mi = $2/mi
  const BASE = 105;
  const additionalMiles = Math.max(0, miles - 20) * 2;
  const fuel = (BASE + additionalMiles) * 0.25;
  const computed = BASE + additionalMiles + fuel;

  // If revenue matches roughly, use computed breakdown
  // Otherwise, scale proportionally to match actual revenue
  if (Math.abs(computed - revenue) < 1) {
    return { base: BASE, additionalMiles, fuel, total: computed };
  }

  // Revenue was manually entered -- distribute proportionally
  const ratio = revenue / (computed || 1);
  const base = Math.round(BASE * ratio * 100) / 100;
  const addMi = Math.round(additionalMiles * ratio * 100) / 100;
  const fuelAmt = Math.round(fuel * ratio * 100) / 100;
  const adjustedTotal = base + addMi + fuelAmt;
  // Adjust for rounding diff
  const diff = Math.round((revenue - adjustedTotal) * 100) / 100;
  return { base, additionalMiles: addMi, fuel: fuelAmt + diff, total: revenue };
}

// --- Color palette ----------------------------------------
const COLORS = {
  primary: [15, 23, 42] as [number, number, number],       // slate-900
  accent: [37, 99, 235] as [number, number, number],        // blue-600
  accentLight: [219, 234, 254] as [number, number, number], // blue-100
  white: [255, 255, 255] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray400: [156, 163, 175] as [number, number, number],
  gray600: [75, 85, 99] as [number, number, number],
  green: [21, 128, 61] as [number, number, number],
  greenLight: [220, 252, 231] as [number, number, number],
};

// -----------------------------------------------------------
// MAIN EXPORT
// -----------------------------------------------------------

export function generateInvoice(load: InvoiceLoad, driverName: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const W = doc.internal.pageSize.getWidth();  // 215.9 mm
  const pageH = doc.internal.pageSize.getHeight();
  const FOOTER_ZONE = 24; // reserved space at bottom for footer strip + margin

  /** Add a new page and return the reset Y position for content. */
  const addPage = (): number => {
    doc.addPage();
    doc.setFillColor(...COLORS.white);
    doc.rect(0, 0, W, pageH, "F");
    return 16;
  };

  /** Check if we need a new page; if so, add one and return new Y. */
  const ensureSpace = (currentY: number, needed: number): number => {
    if (currentY + needed > pageH - FOOTER_ZONE) {
      return addPage();
    }
    return currentY;
  };

  const today = new Date();
  const dueDate = addDays(30);
  const refNum = load.reference_number || load.id.slice(0, 8).toUpperCase();
  const invoiceNum = `INV-${refNum}`;

  // Determine address based on hub
  const companyAddress =
    load.hub?.toLowerCase().includes("phx")
      ? "4722 E Mcdowell Rd, Phoenix, AZ 85008"
      : "11431 NW 107th St, Ste 24, Medley, FL 33178";

  // -- Breakdown ------------------------------------------
  const breakdown = breakdownRevenue(
    load.revenue != null && Number(load.revenue) > 0 ? Number(load.revenue) : 131.25,
    Number(load.miles) || 0,
  );

  // -- Background: full-page white -----------------------
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, W, 279.4, "F");

  // -- Header Banner -------------------------------------
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, W, 48, "F");

  // Accent strip
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 48, W, 3, "F");

  // Logo / Company Name
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("ANIKA LOGISTICS GROUP", 16, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 196, 220);
  doc.text(companyAddress, 16, 28);
  doc.text("Phone: +1-877-701-1919  |  www.anikalogistics.com", 16, 34);
  doc.text("Federal Tax ID: 85-XXXXXXX", 16, 40);

  // "INVOICE" label on top-right
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", W - 16, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 196, 220);
  doc.text(invoiceNum, W - 16, 30, { align: "right" });

  // -- Invoice Meta Block --------------------------------
  let y = 60;

  // Two-column: Bill To (left) | Invoice Details (right)
  const leftX = 16;
  const rightX = W / 2 + 10;

  // BILL TO label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.accent);
  doc.text("BILL TO", leftX, y);

  // Invoice Details label
  doc.text("INVOICE DETAILS", rightX, y);

  y += 5;

  // Client name -- truncate to prevent overflow past the midpoint
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.text(truncate(load.client_name || "Client", 40), leftX, y);

  // Invoice # value
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray600);

  const detailRows: [string, string][] = [
    ["Invoice #:", invoiceNum],
    ["Invoice Date:", fmtDateOnly(today.toISOString())],
    ["Due Date:", fmtDateOnly(dueDate.toISOString())],
    ["Payment Terms:", "Net 30"],
  ];

  let detailY = y;
  detailRows.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray600);
    doc.text(label, rightX, detailY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.primary);
    doc.text(truncate(val, 30), rightX + 35, detailY);
    detailY += 5.5;
  });

  y += 5;
  if (load.delivery_company) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray600);
    doc.text(truncate(load.delivery_company, 50), leftX, y);
    y += 5;
  }
  if (load.delivery_address) {
    const addrLines = doc.splitTextToSize(load.delivery_address, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray600);
    doc.text(addrLines, leftX, y);
    y += addrLines.length * 4.5;
  }

  y = Math.max(y, detailY) + 8;

  // -- Divider -------------------------------------------
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.4);
  doc.line(leftX, y, W - 16, y);
  y += 8;

  // -- SERVICE DETAILS Table -----------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.text("SERVICE DETAILS", leftX, y);
  y += 4;

  const weightDisplay = load.weight_kg
    ? `${load.weight_kg} KG`
    : load.weight_lbs
    ? `${(load.weight_lbs / 2.205).toFixed(1)} KG`
    : "--";

  const pkgDisplay = `${load.packages || 1} ${load.package_type || "PKG"}`;
  const svcDisplay = `${load.service_type || "AOG"} -- AOG Cartage`;

  const serviceRows = [
    ["Reference #", truncate(refNum, 40)],
    ["Service Type", truncate(svcDisplay, 60)],
    ["Pickup Location", truncate(load.pickup_address, 80)],
    ["Pickup Company", truncate(load.pickup_company, 60)],
    ["Delivery Location", truncate(load.delivery_address, 80)],
    ["Delivery Company", truncate(load.delivery_company, 60)],
    ["Driver", truncate(driverName, 40)],
    ["Pickup Date/Time", load.actual_pickup ? fmtDate(load.actual_pickup) : fmtDateOnly(load.load_date)],
    ["Delivery Date/Time", load.actual_delivery ? fmtDate(load.actual_delivery) : "--"],
    ["Weight", weightDisplay],
    ["Packages", pkgDisplay],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Description", "Details"]],
    body: serviceRows,
    margin: { left: leftX, right: 16 },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: COLORS.primary,
      lineColor: COLORS.gray200,
      lineWidth: 0.3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COLORS.accentLight,
      textColor: COLORS.accent,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: COLORS.gray100,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: COLORS.gray600 as [number, number, number] },
      1: { cellWidth: "auto" },
    },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  y = ensureSpace(y, 50);

  // -- CHARGES Table -------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.text("CHARGES", leftX, y);
  y += 4;

  const fmt$ = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const chargeRows: [string, string][] = [
    ["Base Transportation Rate", fmt$(breakdown.base)],
    ["Additional Miles", fmt$(breakdown.additionalMiles)],
    ["Fuel Surcharge (25%)", fmt$(breakdown.fuel)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Service", "Amount"]],
    body: chargeRows,
    foot: [["TOTAL DUE", fmt$(breakdown.total)]],
    margin: { left: leftX, right: 16 },
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: COLORS.primary,
      lineColor: COLORS.gray200,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: COLORS.accentLight,
      textColor: COLORS.accent,
      fontStyle: "bold",
      fontSize: 8,
    },
    footStyles: {
      fillColor: COLORS.green,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
    },
    theme: "grid",
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  y = ensureSpace(y, 50);

  // -- Payment Terms & Thank You -------------------------
  doc.setFillColor(...COLORS.gray100);
  doc.roundedRect(leftX, y, W - 32, 22, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.text("PAYMENT INFORMATION", leftX + 6, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray600);
  doc.text(
    "Payment due within 30 days. Please reference invoice number when submitting payment.",
    leftX + 6,
    y + 13,
  );
  doc.text(
    "Checks payable to: Anika Logistics Group  |  Bank Transfer: Contact billing@anikalogistics.com",
    leftX + 6,
    y + 18.5,
  );

  y += 30;

  // Thank you
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.accent);
  doc.text("Thank you for your business!", W / 2, y, { align: "center" });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray400);
  doc.text(
    "Questions? Contact us at billing@anikalogistics.com or +1-877-701-1919",
    W / 2,
    y,
    { align: "center" },
  );

  // -- Footer strip -- draw on every page ------------------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, pageH - 12, W, 12, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 196, 220);
    doc.text(
      `${invoiceNum}  |  Anika Logistics Group  |  +1-877-701-1919  |  Page ${p} of ${totalPages}`,
      W / 2,
      pageH - 4.5,
      { align: "center" },
    );
  }

  // -- Save / Download ------------------------------------
  const dateStr = today.toISOString().slice(0, 10);
  const filename = `ANIKA-INV-${refNum}-${dateStr}.pdf`;
  doc.save(filename);
}
