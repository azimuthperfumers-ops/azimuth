import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";

import { computeGst } from "./gst.js";
import { nextInvoiceNumber } from "./number.js";
import { renderInvoicePdf, type InvoiceItem } from "./pdf.js";
import { uploadInvoicePdf } from "./r2.js";
import { rupeesInWords } from "./words.js";

export { SELLER } from "./seller.js";

type Order = typeof schema.orders.$inferSelect;

interface ShippingAddress {
  fullName: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

// Atomically claim the next FY invoice number for this order. The conditional
// update (gst_invoice_number IS NULL) + unique index make it safe against two
// payment-success paths racing for the same order or the same sequence number.
async function reserveInvoiceNumber(
  db: Database,
  orderId: string,
  taxTotal: number,
): Promise<{ number: string; date: Date }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const date = new Date();
    const candidate = await nextInvoiceNumber(db, date);
    try {
      const rows = await db
        .update(schema.orders)
        .set({ gstInvoiceNumber: candidate, gstInvoiceDate: date, taxAmount: String(taxTotal) })
        .where(and(eq(schema.orders.id, orderId), isNull(schema.orders.gstInvoiceNumber)))
        .returning({ n: schema.orders.gstInvoiceNumber });
      if (rows.length > 0) return { number: candidate, date };

      // Already numbered by a concurrent run — reuse that number.
      const existing = await db.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
        columns: { gstInvoiceNumber: true, gstInvoiceDate: true },
      });
      if (existing?.gstInvoiceNumber) {
        return { number: existing.gstInvoiceNumber, date: existing.gstInvoiceDate ?? date };
      }
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Sequence clash — recount and retry.
    }
  }
  throw new Error(`Could not allocate an invoice number for order ${orderId}`);
}

// Generates the GST tax invoice for a paid order: assigns the FY invoice number,
// renders the PDF, stores it in R2, and records the number/date/URL on the order.
// Idempotent — safe to call from every payment-success path.
export async function generateOrderInvoice(
  db: Database,
  order: Order,
): Promise<{ number: string; url: string }> {
  if (order.gstInvoiceNumber && order.invoiceUrl) {
    return { number: order.gstInvoiceNumber, url: order.invoiceUrl };
  }

  const addr = order.shippingAddress as ShippingAddress;
  const gst = computeGst(Number(order.total), addr.state);

  // Reuse an already-reserved number (e.g. a prior run rendered the PDF but the
  // upload failed), otherwise claim a fresh one.
  const reserved = order.gstInvoiceNumber
    ? { number: order.gstInvoiceNumber, date: order.gstInvoiceDate ?? new Date() }
    : await reserveInvoiceNumber(db, order.id, gst.taxTotal);

  const items = await db.query.orderItems.findMany({
    where: eq(schema.orderItems.orderId, order.id),
  });

  const invoiceItems: InvoiceItem[] = items.map((it) => ({
    name: it.productName,
    sizeMl: it.sizeMl,
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
    amount: Number(it.lineTotal),
  }));

  const buyerAddressLines = [
    addr.line1,
    addr.line2 ?? "",
    `${addr.city}, ${addr.state} - ${addr.pincode}`,
  ];

  const pdf = await renderInvoicePdf({
    number: reserved.number,
    date: reserved.date,
    orderNumber: order.orderNumber,
    buyer: {
      name: addr.fullName,
      phone: addr.phone ?? undefined,
      addressLines: buyerAddressLines,
      stateName: addr.state,
    },
    items: invoiceItems,
    subtotalInclusive: Number(order.subtotal),
    discountAmount: Number(order.discountAmount),
    shippingCharge: Number(order.shippingCharge),
    gst,
    amountInWords: rupeesInWords(gst.grandTotal),
  });

  const url = await uploadInvoicePdf(pdf, order.orderNumber);
  await db.update(schema.orders).set({ invoiceUrl: url }).where(eq(schema.orders.id, order.id));

  return { number: reserved.number, url };
}
