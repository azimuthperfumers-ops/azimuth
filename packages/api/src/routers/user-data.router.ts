import { z } from "zod";

import { protectedProcedure } from "../middleware/auth.middleware";
import {
  addAddressSchema,
  addToWishlistSchema,
  deleteAddressSchema,
  removeFromWishlistSchema,
  setDefaultAddressSchema,
  updateAddressSchema,
} from "../schemas/user-data.schema";
import { createUserDataService } from "../services/user-data.service";
import { router } from "../trpc";

export const userDataRouter = router({
  listAddresses: protectedProcedure.query(({ ctx }) =>
    createUserDataService(ctx.db).listAddresses(ctx.session.user.id),
  ),

  addAddress: protectedProcedure
    .input(addAddressSchema)
    .mutation(({ ctx, input }) =>
      createUserDataService(ctx.db).addAddress(ctx.session.user.id, input),
    ),

  updateAddress: protectedProcedure
    .input(updateAddressSchema)
    .mutation(({ ctx, input }) =>
      createUserDataService(ctx.db).updateAddress(ctx.session.user.id, input),
    ),

  deleteAddress: protectedProcedure
    .input(deleteAddressSchema)
    .mutation(({ ctx, input }) =>
      createUserDataService(ctx.db).deleteAddress(ctx.session.user.id, input.id),
    ),

  setDefaultAddress: protectedProcedure
    .input(setDefaultAddressSchema)
    .mutation(({ ctx, input }) =>
      createUserDataService(ctx.db).setDefaultAddress(ctx.session.user.id, input.id),
    ),

  listWishlist: protectedProcedure.query(({ ctx }) =>
    createUserDataService(ctx.db).listWishlist(ctx.session.user.id),
  ),

  addToWishlist: protectedProcedure
    .input(addToWishlistSchema)
    .mutation(({ ctx, input }) =>
      createUserDataService(ctx.db).addToWishlist(ctx.session.user.id, input),
    ),

  removeFromWishlist: protectedProcedure
    .input(removeFromWishlistSchema)
    .mutation(({ ctx, input }) =>
      createUserDataService(ctx.db).removeFromWishlist(ctx.session.user.id, input.id),
    ),
});
