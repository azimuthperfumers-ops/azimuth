import { expo } from "@better-auth/expo";
import { sendEmailOtp } from "@azimuth/comms";
import { db, schema } from "@azimuth/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP } from "better-auth/plugins";

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
    // Unverified accounts cannot sign in — better-auth auto-sends the OTP
    // (via emailOTP's overrideDefaultEmailVerification) and returns 403.
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    bearer(),
    expo(),
    emailOTP({
      // Route email verification through MSG91 email OTP instead of links.
      // Also powers the OTP-based password reset (type "forget-password").
      overrideDefaultEmailVerification: true,
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }) {
        await sendEmailOtp(email, otp);
      },
    }),
  ],
  trustedOrigins: [env.ADMIN_APP_URL, env.USER_APP_URL, "azimuth://"],
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
