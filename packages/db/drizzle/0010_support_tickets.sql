-- Support ticket system: tickets, messages, actions

CREATE TYPE "ticket_type" AS ENUM ('general', 'return', 'exchange', 'refund', 'damaged', 'other');
CREATE TYPE "ticket_status" AS ENUM ('open', 'awaiting_admin', 'awaiting_user', 'resolved', 'closed');

CREATE TABLE "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_number" text NOT NULL UNIQUE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "type" "ticket_type" NOT NULL DEFAULT 'general',
  "status" "ticket_status" NOT NULL DEFAULT 'open',
  "subject" text NOT NULL,
  "closed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ticket_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "sender_id" text NOT NULL,
  "sender_role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "ticket_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "admin_id" text NOT NULL,
  "action_type" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "tickets_user_idx" ON "support_tickets"("user_id");
CREATE INDEX "tickets_order_idx" ON "support_tickets"("order_id");
CREATE INDEX "tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages"("ticket_id");
CREATE INDEX "ticket_actions_ticket_idx" ON "ticket_actions"("ticket_id");
