import { z } from "zod";

export const emailSignInSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const emailSignUpSchema = emailSignInSchema.extend({
  name: z.string().min(1, "Name is required").max(100),
});
