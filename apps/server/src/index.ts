import { createContext } from "@aloysius-g1/api/context";
import { appRouter } from "@aloysius-g1/api/routers/index";
import { createAuth, ensureSiteAdmin } from "@aloysius-g1/auth";
import { env } from "@aloysius-g1/env/server";
import { backup } from "@aloysius-g1/db/scripts/backup";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});
const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

const auth = createAuth();
await ensureSiteAdmin(auth);

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.all("/api/auth/*", async (c) => {
  if (["POST", "GET"].includes(c.req.method)) {
    const response = await auth.handler(c.req.raw);
    return c.newResponse(response.body, response);
  }
  return c.text("Method Not Allowed", 405);
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  });
  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  });
  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => c.text("OK"));

export default {
  fetch: app.fetch,
};

Bun.serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server is running on http://localhost:3000");

// Periodic backup every 6 hours
const SIX_HOURS = 6 * 60 * 60 * 1000;
setInterval(() => {
  try {
    backup();
    console.log("[backup] periodic backup completed");
  } catch (err) {
    console.error("[backup] periodic backup failed:", err);
  }
}, SIX_HOURS);
console.log("[backup] scheduled periodic backup every 6 hours");
