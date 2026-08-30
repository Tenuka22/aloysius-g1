import { os } from "@orpc/server";
import { ORPCError } from "@orpc/client";

import type { Context } from "./context";
import { hasAdminRole, hasSubAdminRole } from "./auth-policy";

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

export const subAdminProcedure = protectedProcedure.use(async ({ context, next }) => {
  if (!hasSubAdminRole(context.session.user)) throw new ORPCError("FORBIDDEN");
  return next({ context });
});
