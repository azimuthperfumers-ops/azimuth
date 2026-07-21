import PDFDocument from "pdfkit";

import { GST_RATE, PERFUME_HSN, SELLER } from "./seller.js";
import type { GstBreakup } from "./gst.js";

export interface InvoiceItem {
  name: string;
  sizeMl: number;
  quantity: number;
  unitPrice: number; // GST-inclusive
  amount: number; // GST-inclusive line total
}

export interface InvoiceData {
  number: string;
  date: Date;
  orderNumber: string;
  buyer: { name: string; phone?: string; addressLines: string[]; stateName: string };
  items: InvoiceItem[];
  subtotalInclusive: number;
  discountAmount: number;
  shippingCharge: number;
  gst: GstBreakup;
  amountInWords: string;
}

// Note: PDF standard fonts have no ₹ glyph, so amounts use "Rs.".
function inr(n: number): string {
  const [int, dec] = n.toFixed(2).split(".");
  const last3 = int!.slice(-3);
  const rest = int!.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `Rs. ${grouped}.${dec}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const L = 40; // left margin
    const R = 555; // right edge
    const ink = "#111111";
    const muted = "#666666";

    // ── Header ────────────────────────────────────────────────────────────────
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text(SELLER.tradeName, L, 44);
    doc.font("Helvetica").fontSize(9).fillColor(muted);
    doc.text(`Proprietor: ${SELLER.legalName}`, L, 68);
    SELLER.addressLines.forEach((line, i) => doc.text(line, L, 80 + i * 12));
    doc.text(`GSTIN: ${SELLER.gstin}`, L, 80 + SELLER.addressLines.length * 12);
    doc.text(`${SELLER.email}  ·  ${SELLER.phone}`, L, 92 + SELLER.addressLines.length * 12);

    doc.font("Helvetica-Bold").fontSize(15).fillColor(ink).text("TAX INVOICE", L, 44, { align: "right", width: R - L });
    doc.font("Helvetica").fontSize(9).fillColor(muted);
    doc.text(`Invoice No: ${data.number}`, L, 70, { align: "right", width: R - L });
    doc.text(`Invoice Date: ${fmtDate(data.date)}`, L, 82, { align: "right", width: R - L });
    doc.text(`Order No: ${data.orderNumber}`, L, 94, { align: "right", width: R - L });

    let y = 150;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor("#dddddd").stroke();
    y += 14;

    // ── Bill To + Place of supply ──────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).fillColor(muted).text("BILL TO / SHIP TO", L, y);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text(data.buyer.name, L, y + 14);
    doc.fontSize(9).fillColor(muted);
    let by = y + 28;
    data.buyer.addressLines.filter(Boolean).forEach((line) => {
      doc.text(line, L, by, { width: 300 });
      by += 12;
    });
    if (data.buyer.phone) { doc.text(`Phone: ${data.buyer.phone}`, L, by); by += 12; }

    doc.font("Helvetica").fontSize(9).fillColor(muted);
    doc.text(`Place of Supply: ${data.gst.placeOfSupplyName}${data.gst.placeOfSupplyCode ? ` (${data.gst.placeOfSupplyCode})` : ""}`, 320, y + 14, { align: "right", width: R - 320 });
    doc.text(`Supply Type: ${data.gst.intraState ? "Intra-State" : "Inter-State"}`, 320, y + 26, { align: "right", width: R - 320 });

    y = Math.max(by, y + 44) + 10;

    // ── Items table ────────────────────────────────────────────────────────────
    const cols = { sr: L, desc: L + 26, hsn: 320, qty: 372, rate: 420, amt: 490 };
    doc.rect(L, y, R - L, 20).fill("#f3f1ee");
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.5);
    doc.text("#", cols.sr + 2, y + 6);
    doc.text("DESCRIPTION", cols.desc, y + 6);
    doc.text("HSN", cols.hsn, y + 6);
    doc.text("QTY", cols.qty, y + 6);
    doc.text("RATE", cols.rate, y + 6, { width: 60, align: "right" });
    doc.text("AMOUNT", cols.amt - 5, y + 6, { width: 70, align: "right" });
    y += 20;

    doc.font("Helvetica").fontSize(9).fillColor(ink);
    data.items.forEach((it, i) => {
      const label = `${it.name} — ${it.sizeMl}ml`;
      doc.text(String(i + 1), cols.sr + 2, y + 5, { width: 22 });
      doc.text(label, cols.desc, y + 5, { width: cols.hsn - cols.desc - 6 });
      doc.text(PERFUME_HSN, cols.hsn, y + 5);
      doc.text(String(it.quantity), cols.qty, y + 5);
      doc.text(inr(it.unitPrice), cols.rate, y + 5, { width: 60, align: "right" });
      doc.text(inr(it.amount), cols.amt - 5, y + 5, { width: 70, align: "right" });
      const h = doc.heightOfString(label, { width: cols.hsn - cols.desc - 6 });
      y += Math.max(18, h + 8);
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor("#eeeeee").stroke();
    });

    // ── Totals ─────────────────────────────────────────────────────────────────
    y += 12;
    const tx = 360;
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(bold ? ink : muted);
      doc.text(label, tx, y, { width: 110 });
      doc.fillColor(ink).text(value, tx + 110, y, { width: R - tx - 110, align: "right" });
      y += 15;
    };

    row("Subtotal (incl. GST)", inr(data.subtotalInclusive));
    if (data.discountAmount > 0) row("Discount", `- ${inr(data.discountAmount)}`);
    row("Shipping", data.shippingCharge > 0 ? inr(data.shippingCharge) : "Free");
    doc.moveTo(tx, y).lineTo(R, y).lineWidth(0.5).strokeColor("#dddddd").stroke();
    y += 6;
    row("Grand Total", inr(data.gst.grandTotal), true);
    y += 6;

    // ── GST summary (of grand total) ───────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).fillColor(muted).text("GST SUMMARY", L, y - 74);
    doc.font("Helvetica").fontSize(9).fillColor(ink);
    let gy = y - 60;
    const gline = (label: string, value: string) => {
      doc.fillColor(muted).text(label, L, gy, { width: 160 });
      doc.fillColor(ink).text(value, L + 120, gy, { width: 90, align: "right" });
      gy += 14;
    };
    gline(`Taxable Value`, inr(data.gst.taxableValue));
    if (data.gst.intraState) {
      gline(`CGST @ ${GST_RATE / 2}%`, inr(data.gst.cgst));
      gline(`SGST @ ${GST_RATE / 2}%`, inr(data.gst.sgst));
    } else {
      gline(`IGST @ ${GST_RATE}%`, inr(data.gst.igst));
    }
    gline(`Total GST`, inr(data.gst.taxTotal));

    // ── Amount in words + footer ───────────────────────────────────────────────
    y = Math.max(y, gy) + 16;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(muted).text("Amount in words:", L, y);
    doc.font("Helvetica").fontSize(9).fillColor(ink).text(data.amountInWords, L + 88, y, { width: R - L - 88 });
    y += 34;

    doc.font("Helvetica").fontSize(8).fillColor(muted);
    doc.text(
      "This is a computer-generated invoice and does not require a signature. Prices are inclusive of GST. Goods once sold are subject to our Refund & Cancellation Policy.",
      L,
      y,
      { width: R - L },
    );
    doc.text(`For ${SELLER.tradeName}`, L, y + 34, { align: "right", width: R - L });

    doc.end();
  });
}
