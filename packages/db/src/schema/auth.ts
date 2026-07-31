import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, pgEnum } from "drizzle-orm/pg-core";

// Kept in sync manually with the `role` additionalField in packages/auth/src/index.ts —
// `better-auth generate` renders array-typed fields as `text(..., {enum})`, which is only a
// TS-level hint. We upgrade it to a real Postgres enum for a DB-level constraint.
export const userRoleEnum = pgEnum("user_role", ["admin", "user", "system"]);

// Staff sub-role. Only meaningful when `role = 'admin'` — it decides which admin
// panel sections the person can view/edit (see packages/api/src/permissions.ts).
// Null for customers/system. `owner` is the superuser and the only role that can
// create or manage other staff. Kept in sync manually with the `staffRole`
// additionalField in packages/auth/src/index.ts.
export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "orders_manager",
  "cataloging",
  "accounts",
  "support",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified"),
  phone: text("phone"),
  role: userRoleEnum("role").default("user").notNull(),
  // Nullable — set only for staff (role='admin'). See staffRoleEnum above.
  staffRole: staffRoleEnum("staff_role"),
  // Set when the customer deletes their own account. The row is NOT removed —
  // orders reference it with onDelete:'restrict' and the GST invoices behind
  // them are legally retained — so instead every personal field above is
  // overwritten with a placeholder and this stamp marks the row as a tombstone.
  // See packages/api/src/services/account-deletion.service.ts.
  deletedAt: timestamp("deleted_at"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
