// Delhivery POD (Proof of Delivery) webhook — "Document Push" in Delhivery terms.
// Separate registration required from Scan Push: fill POD Webhook Requirement Document
// and email to lastmile-integration@delhivery.com.
// Auth: same ?token= query param pattern as Scan Push.

import type { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { db, schema } from "@azimuth/db";
import { env } from "../lib/env.js";

// ── Payload shape ─────────────────────────────────────────────────────────────
// Delhivery POD payload — may vary slightly by account config, handle both shapes.

interface DelhiveryPodPayload {
  waybill?: string;
  AWB?: string;
  pod_url?: string;
  POD?: string;            // alternate field name
  pod_image?: string;      // alternate field name
  delivered_at?: string;
  recipient_name?: string;
  status?: string;
}

function extractFields(body: DelhiveryPodPayload): { waybill: string; podUrl: string } | null {
  const waybill = body.waybill ?? body.AWB ?? "";
  const podUrl = body.pod_url ?? body.POD ?? body.pod_image ?? "";
  if (!waybill || !podUrl) return null;
  return { waybill, podUrl };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function delhiveryPodWebhookHandler(req: Request, res: Response) {
  const webhookToken = env.DELHIVERY_WEBHOOK_TOKEN;
  if (webhookToken && req.query.token !== webhookToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const bodies: DelhiveryPodPayload[] = Array.isArray(req.body) ? req.body : [req.body];

    for (const body of bodies) {
      const fields = extractFields(body);
      if (!fields) {
        console.warn("[delhivery-pod] Missing waybill or pod_url in payload:", JSON.stringify(body));
        continue;
      }

      const { waybill, podUrl } = fields;

      const order = await db.query.orders.findFirst({
        where: eq(schema.orders.delhiveryWaybill, waybill),
        columns: { id: true, orderNumber: true },
      });

      if (!order) {
        console.warn(`[delhivery-pod] No order found for waybill ${waybill}`);
        continue;
      }

      await db
        .update(schema.orders)
        .set({ podImageUrl: podUrl })
        .where(eq(schema.orders.id, order.id));

      console.log(`[delhivery-pod] POD saved for ${order.orderNumber} (${waybill}): ${podUrl}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[delhivery-pod] Error:", (err as Error).message);
    res.status(500).json({ error: "Internal error" });
  }
}
