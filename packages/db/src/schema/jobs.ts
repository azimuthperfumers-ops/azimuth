import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { orders } from "./orders";
import { tickets } from "./support";

export const jobTypeEnum = pgEnum("job_type", [
  "book_shipment",
  "cancel_shipment",
  "initiate_refund",
  "return_shipment",
  "exchange_shipment",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    bullmqJobId: text("bullmq_job_id"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("background_jobs_type_idx").on(t.type),
    index("background_jobs_status_idx").on(t.status),
    index("background_jobs_order_idx").on(t.orderId),
    index("background_jobs_ticket_idx").on(t.ticketId),
    index("background_jobs_created_at_idx").on(t.createdAt),
  ],
);

export const backgroundJobRelations = relations(backgroundJobs, ({ one }) => ({
  order: one(orders, { fields: [backgroundJobs.orderId], references: [orders.id] }),
  ticket: one(tickets, { fields: [backgroundJobs.ticketId], references: [tickets.id] }),
}));
