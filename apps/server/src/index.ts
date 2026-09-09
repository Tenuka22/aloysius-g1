import { createContext } from "@aloysius-admissions/api/context";
import { appRouter } from "@aloysius-admissions/api/routers/index";
import { createAuth, ensureSiteAdmin, ensureSubAdmins } from "@aloysius-admissions/auth";
import { db } from "@aloysius-admissions/db";
import { backup } from "@aloysius-admissions/db/scripts/backup";
import { getCorsOrigins } from "@aloysius-admissions/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { applyClientIp } from "./client-ip";
import { logUnexpectedError } from "./error-logging";

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [onError(logUnexpectedError)],
});
const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [onError(logUnexpectedError)],
});

const auth = createAuth();
await ensureSiteAdmin(auth);
await ensureSubAdmins(auth);

const app = new Hono();

const corsOrigins = getCorsOrigins();

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (corsOrigins.includes(origin ?? "")) {
        return origin;
      }
      return corsOrigins[0] ?? "";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.all("/api/auth/*", async (c) => {
  if (["POST", "GET"].includes(c.req.method)) {
    return auth.handler(c.req.raw);
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
    return new Response(rpcResult.response.body, {
      status: rpcResult.response.status,
      headers: rpcResult.response.headers,
    });
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  });
  if (apiResult.matched) {
    return new Response(apiResult.response.body, {
      status: apiResult.response.status,
      headers: apiResult.response.headers,
    });
  }

  await next();
});

app.get("/", (c) => c.text("OK"));

app.get("/health", async (c) => {
  let dbStatus = "healthy";
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    db.$client.query("SELECT 1").get();
    dbLatency = Date.now() - dbStart;
  } catch {
    dbStatus = "unhealthy";
  }

  const status = dbStatus === "healthy" ? 200 : 503;

  return c.json(
    {
      status: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown",
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
      },
    },
    status,
  );
});

Bun.serve({
  fetch: (request, server) => app.fetch(applyClientIp(request, server), server),
  port: 3000,
});

const SIX_HOURS = 6 * 60 * 60 * 1000;
const backupInterval = setInterval(() => {
  try {
    const created = backup();
    console.log(
      created
        ? "[backup] periodic backup completed"
        : "[backup] periodic backup skipped (database unchanged)",
    );
  } catch (err) {
    console.error("[backup] periodic backup failed:", err);
  }
}, SIX_HOURS);
console.log("[backup] scheduled periodic backup every 6 hours");

function gracefulShutdown(signal: string): void {
  console.log(`[shutdown] received ${signal}, starting graceful shutdown...`);
  clearInterval(backupInterval);
  console.log("[shutdown] cleared backup interval");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
