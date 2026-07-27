import type { Database } from "@azimuth/db";
import { schema } from "@azimuth/db";
import { eq } from "drizzle-orm";
import type { CustomerContact, OrderInfo } from "@azimuth/comms";

type OrderRow = typeof schema.orders.$inferSelect;
interface ShippingAddr {
  fullName?: string;
  phone?: string;
}

// Who to notify for an order and how to reach them — the shipping address wins
// (it's what the customer entered for this order), falling back to the account.
export async function getOrderContact(db: Database, order: OrderRow): Promise<CustomerContact> {
  const addr = order.shippingAddress as ShippingAddr;
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, order.userId),
    columns: { email: true, name: true, phone: true },
  });
  return {
    name: addr.fullName ?? user?.name ?? "Customer",
    email: user?.email ?? undefined,
    phone: addr.phone ?? user?.phone ?? undefined,
  };
}

// The order fields the notification templates need, formatted for display.
export function toOrderInfo(order: OrderRow): OrderInfo {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalInr: new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(order.total)),
    waybill: order.waybill ?? undefined,
    trackingUrl: order.trackingUrl ?? undefined,
  };
}
