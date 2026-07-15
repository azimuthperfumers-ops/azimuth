import { expo } from "@better-auth/expo";
import { sendEmailOtp, sendVerificationLink } from "@azimuth/comms";
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
    // Unverified accounts cannot sign in — better-auth returns 403 and re-sends
    // the verification LINK email.
    requireEmailVerification: true,
  },
  emailVerification: {
    // Link-based verification: signup emails a clickable link; clicking it hits
    // /api/auth/verify-email, verifies, then auto-signs-in (same browser) and
    // redirects to callbackURL. OTP is used only for password reset now.
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      // better-auth's `url` points straight at the API server
      // (`${baseURL}/api/auth/verify-email?...`). We never expose that in the
      // email — instead link to the user app's /verify-email page, which calls
      // the server itself and shows a branded result. Keep only the token.
      const token = new URL(url).searchParams.get("token") ?? "";
      const base = env.USER_APP_URL.replace(/\/$/, "");
      const frontendUrl = `${base}/verify-email?token=${encodeURIComponent(token)}`;
      await sendVerificationLink(user.email, user.name ?? "there", frontendUrl);
    },
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
      // OTP now powers ONLY password reset (type "forget-password"). Email
      // verification on signup uses the link flow above.
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
