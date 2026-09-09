import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { logUnexpectedError } from "./error-logging";
import { appRouter } from "./routers/index";

/**
 * Configured oRPC handlers, built here rather than in the app that mounts them.
 *
 * Keeping them in this package means the web app depends only on
 * `@aloysius-admissions/api` and never on the auth, db or OpenAPI packages
 * directly — its server routes just forward a `Request` and get a `Response`.
 */

/** Typed RPC transport used by the app's own client. */
export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logUnexpectedError)],
});

/** REST-shaped view of the same router, plus its interactive reference. */
export const openApiHandler = new OpenAPIHandler(appRouter, {
  plugins: [new OpenAPIReferencePlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })],
  interceptors: [onError(logUnexpectedError)],
});
