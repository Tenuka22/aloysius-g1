import type { RouterClient } from "@orpc/server";

import { publicProcedure, protectedProcedure } from "../index";
import { hasAdminRole, hasSubAdminRole } from "../auth-policy";
import { g1Router } from "./g1";

export const appRouter = {
 ...g1Router,
 healthCheck: publicProcedure.handler(() => {
 return "OK";
 }),
 // Public (never throws for an anonymous visitor, unlike protectedProcedure) - 
 // the home page needs to know whether to show the admin-panel shortcut for
 // any visitor, logged in or not. Reuses the same per-request session the
 // oRPC context already resolves (packages/api/src/context.ts), so callers
 // don't need a separate better-auth client call to get this.
 session: {
 isAdmin: publicProcedure.handler(({ context }) => {
 return { isAdmin: hasAdminRole(context.session?.user) };
 }),
 // Separate from isAdmin: sub-admins get their own panel shortcut (with a
 // narrower set of pages) distinct from the full admin panel. Admins also
 // pass this check - same hierarchy as subAdminProcedure server-side.
 isSubAdmin: publicProcedure.handler(({ context }) => {
 return { isSubAdmin: hasSubAdminRole(context.session?.user) };
 }),
 },
 privateData: protectedProcedure.handler(({ context }) => {
 return {
 message: "This is private",
 user: context.session?.user,
 };
 }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
