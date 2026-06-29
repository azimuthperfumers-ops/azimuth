import { eq } from "drizzle-orm";
import { db, schema } from "@azimuth/db";

export async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.webhookEvents.id })
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.eventId, eventId))
    .limit(1);
  return !!existing;
}

export async function recordEvent(
  gateway: string,
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await db.insert(schema.webhookEvents).values({ gateway, eventId, eventType, payload });
}
