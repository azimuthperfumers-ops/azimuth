-- Backfill: one wallet per existing account.
--
-- Wallets used to be created lazily, on the first movement of money, so the
-- admin's Wallets screen only ever listed customers who had already spent or
-- been credited — everyone else simply wasn't there. New accounts now get a
-- wallet at signup (databaseHooks.user.create in packages/auth); this gives the
-- accounts that predate that the same ₹0 row.
--
-- Balances are untouched: only missing rows are inserted and they default to 0,
-- so re-running is a no-op.
INSERT INTO "wallets" ("user_id")
SELECT "id" FROM "user"
ON CONFLICT ("user_id") DO NOTHING;
