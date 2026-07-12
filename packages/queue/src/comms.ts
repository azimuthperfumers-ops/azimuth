import type { CustomerContact, OrderInfo } from "@azimuth/comms";
import { db, schema } from "@azimuth/db";
import { eq } from "drizzle-orm";

type OrderRow = typeof schema.orders.$inferSelect;

interface ShippingAddr {
  fullName?: string;
  phone?: string;
}

export async function getCustomerContact(order: OrderRow): Promise<CustomerContact> {
  const addr = order.shippingAddress as ShippingAddr;
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, order.userId),
    columns: { email: true, name: true, phone: true, phoneNumber: true },
  });

  return {
    name: addr.fullName ?? user?.name ?? "Customer",
    email: user?.email ?? undefined,
    phone: addr.phone ?? user?.phone ?? user?.phoneNumber ?? undefined,
  };
}

export function orderInfo(order: OrderRow): OrderInfo {
  const totalInr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(order.total));

  return {
    orderNumber: order.orderNumber,
    totalInr,
    waybill: order.waybill ?? undefined,
    trackingUrl: order.trackingUrl ?? undefined,
  };
}
