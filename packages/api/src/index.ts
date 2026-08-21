import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import { hasAdminRole } from "./auth-policy";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
  if (!hasAdminRole(context.session.user)) throw new ORPCError("FORBIDDEN");
  return next({ context });
});
