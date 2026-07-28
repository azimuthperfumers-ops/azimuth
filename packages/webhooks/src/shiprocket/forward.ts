// Thin HTTP adapter: parse a Shiprocket webhook body and hand it to the shared
// courier state machine in @azimuth/api. All mapping + side effects (status
// transitions, cancellation refunds, delivery notifications) live there, so the
// admin "reconcile" pull path runs the exact same logic. Auth, idempotency and
// the is_return skip are handled by the caller (./index.ts).

import { db } from "@azimuth/db";
import { applyCourierStatus } from "@azimuth/api";

export interface ShiprocketBody {
  awb?: string | number;
  courier_name?: string;
  current_status?: string;
  etd?: string;
  delivered_date?: string;
  pod_status?: string;
  pod?: string;
  is_return?: number;
  // Shiprocket includes this on every tracking event once a pickup is scheduled.
  pickup_scheduled_date?: string;
}

export async function processForwardShipment(body: ShiprocketBody) {
  const result = await applyCourierStatus(
    db,
    {
      awb: String(body.awb ?? "").trim(),
      currentStatus: body.current_status ?? "",
      courierName: body.courier_name,
      etd: body.etd,
      pod: body.pod,
      pickupScheduledDate: body.pickup_scheduled_date,
    },
    "webhook:shiprocket",
  );
  console.log(`[webhook:shiprocket] AWB=${result.awb} → ${result.message}`);
}
