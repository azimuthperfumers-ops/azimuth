import { z } from "zod";

export const emailSignInSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const emailSignUpSchema = emailSignInSchema.extend({
  name: z.string().min(1, "Name is required").max(100),
});

export const phoneNumberSchema = z.object({
  phoneNumber: z
    .string()
    .min(8, "Enter a valid phone number")
    .regex(/^\+?[0-9\s-]+$/, "Enter a valid phone number"),
});

export const otpCodeSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});
