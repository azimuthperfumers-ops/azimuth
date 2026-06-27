import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { user } from "./auth";
import { orders } from "./orders";

export const ticketTypeEnum = pgEnum("ticket_type", [
  "general",
  "return",
  "exchange",
  "refund",
  "damaged",
  "other",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "awaiting_admin",
  "awaiting_user",
  "resolved",
  "closed",
]);

export const tickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: text("ticket_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    type: ticketTypeEnum("type").notNull().default("general"),
    status: ticketStatusEnum("status").notNull().default("open"),
    subject: text("subject").notNull(),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
  },
  (t) => [
    index("tickets_user_idx").on(t.userId),
    index("tickets_order_idx").on(t.orderId),
    index("tickets_status_idx").on(t.status),
  ],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull(),
    senderRole: text("sender_role").$type<"user" | "admin">().notNull(),
    content: text("content").notNull(),
    attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId)],
);

export const ticketActions = pgTable(
  "ticket_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    adminId: text("admin_id").notNull(),
    actionType: text("action_type")
      .$type<
        | "refund_initiated"
        | "return_scheduled"
        | "exchange_scheduled"
        | "closed"
        | "reopened"
      >()
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ticket_actions_ticket_idx").on(t.ticketId)],
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const ticketRelations = relations(tickets, ({ one, many }) => ({
  user: one(user, { fields: [tickets.userId], references: [user.id] }),
  order: one(orders, { fields: [tickets.orderId], references: [orders.id] }),
  messages: many(ticketMessages),
  actions: many(ticketActions),
}));

export const ticketMessageRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketMessages.ticketId],
    references: [tickets.id],
  }),
}));

export const ticketActionRelations = relations(ticketActions, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketActions.ticketId],
    references: [tickets.id],
  }),
}));
