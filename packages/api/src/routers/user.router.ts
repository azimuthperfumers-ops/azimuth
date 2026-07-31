import { protectedProcedure } from "../middleware/auth.middleware";
import { deleteAccountSchema, updateProfileSchema } from "../schemas/user.schema";
import { createAccountDeletionService } from "../services/account-deletion.service";
import { createUserService } from "../services/user.service";
import { router } from "../trpc";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),

  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(({ ctx, input }) => {
    const userService = createUserService(ctx.db);
    return userService.updateProfile(ctx.session.user.id, input);
  }),

  // ── Account deletion (storefront /delete-account) ───────────────────────────

  // What would happen if they went through with it — blockers, wallet credit at
  // risk, orders we keep. Drives the confirmation screen.
  deletionPreview: protectedProcedure.query(({ ctx }) =>
    createAccountDeletionService(ctx.db).preview(ctx.session.user.id),
  ),

  deleteAccount: protectedProcedure.input(deleteAccountSchema).mutation(({ ctx, input }) =>
    createAccountDeletionService(ctx.db).deleteAccount(ctx.session.user.id, input, {
      ipAddress: ctx.ip,
    }),
  ),
});
