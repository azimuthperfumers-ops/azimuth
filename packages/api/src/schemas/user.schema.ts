import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Account deletion is irreversible, so the request carries its own proof of
// intent: the account's own email typed back, and — only when there is credit to
// lose — an explicit acknowledgement that it goes with the account.
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().min(1, "Type your email to confirm."),
  acknowledgeWalletForfeit: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
