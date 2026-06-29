import { db, schema } from "@azimuth/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, phoneNumber } from "better-auth/plugins";

import { env } from "./env";

export { env } from "./env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    bearer(),
    phoneNumber({
      // TODO: wire a real SMS provider (e.g. Twilio) before production —
      // logging the code is fine for local dev since there's nowhere else to read it.
      sendOTP: async ({ phoneNumber, code }) => {
        console.log(`[dev] OTP for ${phoneNumber}: ${code}`);
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => `${phoneNumber.replace(/[^a-zA-Z0-9]/g, "")}@phone.azimuth-perfumers.local`,
        getTempName: (phoneNumber) => phoneNumber,
      },
    }),
  ],
  trustedOrigins: [env.ADMIN_APP_URL, env.USER_APP_URL],
  user: {
    additionalFields: {
      role: {
        type: ["admin", "user", "system"],
        required: true,
        defaultValue: "user",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
