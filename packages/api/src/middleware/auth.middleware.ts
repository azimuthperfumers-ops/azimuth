import { TRPCError } from "@trpc/server";

import { middleware, publicProcedure } from "../trpc";

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedProcedure = publicProcedure.use(isAuthed);

const isAdmin = middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const adminProcedure = publicProcedure.use(isAdmin);
