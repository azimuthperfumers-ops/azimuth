import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { staffRoleEnum, user } from "./auth";

export const staffAuditActionEnum = pgEnum("staff_audit_action", [
  "staff_created",
  "role_changed",
  "staff_removed",
  "password_reset",
  // Signed out of every device without touching their password — for a lost
  // laptop or a shared machine, where forcing a new password is overkill.
  "sessions_revoked",
]);

// Append-only history of every staff-account change (who did what, to whom).
// Mirrors the inventory_ledger pattern: immutable rows, actor + target captured,
// email snapshotted so the record survives even if the user row is later removed.
// Surfaced in the admin /staff page. Never updated or deleted.
export const staffAudit = pgTable(
  "staff_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: staffAuditActionEnum("action").notNull(),
    // The owner who performed the action.
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    // The staff member affected.
    targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
    targetEmail: text("target_email").notNull(),
    fromRole: staffRoleEnum("from_role"),
    toRole: staffRoleEnum("to_role"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("staff_audit_created_idx").on(table.createdAt)],
);

export const staffAuditRelations = relations(staffAudit, ({ one }) => ({
  actor: one(user, { fields: [staffAudit.actorId], references: [user.id], relationName: "staffAuditActor" }),
  target: one(user, { fields: [staffAudit.targetUserId], references: [user.id], relationName: "staffAuditTarget" }),
}));
