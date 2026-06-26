import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  ADMIN_APP_URL: z.string().url().default("http://localhost:3001"),
  USER_APP_URL: z.string().url().default("http://localhost:3000"),
  // Left blank until real Google OAuth credentials are provisioned — the
  // provider is wired up regardless so flipping it on later is a config-only change.
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  // Secret shared with whoever needs to register a new admin account.
  // Change this before deploying; rotating it does not invalidate existing admins.
  ADMIN_INVITE_CODE: z.string().min(1).default("change-me-before-deploy"),
});

export const env = envSchema.parse(process.env);
