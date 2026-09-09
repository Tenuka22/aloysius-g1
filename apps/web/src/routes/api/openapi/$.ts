import { createContext } from "@aloysius-admissions/api/context";
import { openApiHandler } from "@aloysius-admissions/api/handlers";
import { createFileRoute } from "@tanstack/react-router";
import { ensureServerBootstrap } from "@/lib/server/bootstrap";

/**
 * REST-shaped view of the same router, plus its interactive reference.
 *
 * Mounted under `/api/openapi` rather than `/api` so it cannot shadow the auth
 * and RPC routes that share the `/api` prefix.
 */
export const Route = createFileRoute("/api/openapi/$")({
  server: {
    handlers: {
      ANY: async ({ request }: { request: Request }) => {
        await ensureServerBootstrap();
        const { response } = await openApiHandler.handle(request, {
          prefix: "/api/openapi",
          context: await createContext({ headers: request.headers }),
        });
        return response ?? new Response("Not found", { status: 404 });
      },
    },
  },
});
