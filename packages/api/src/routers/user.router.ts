import { protectedProcedure } from "../middleware/auth.middleware";
import { updateProfileSchema } from "../schemas/user.schema";
import { createUserService } from "../services/user.service";
import { router } from "../trpc";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.session.user),

  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(({ ctx, input }) => {
    const userService = createUserService(ctx.db);
    return userService.updateProfile(ctx.session.user.id, input);
  }),
});
