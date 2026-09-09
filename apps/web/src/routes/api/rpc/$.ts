import { createContext } from "@aloysius-admissions/api/context";
import { rpcHandler } from "@aloysius-admissions/api/handlers";
import { CLIENT_IP_HEADER } from "@aloysius-admissions/api/server";
import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import { ensureServerBootstrap } from "@/lib/server/bootstrap";

/**
 * oRPC's typed RPC endpoint.
 *
 * The client talks to this on the same origin, so no forwarded cookies or CORS
 * preflights are involved. The socket peer address is stamped onto the request
 * here because Better Auth can only read a client IP from a header, and a
 * caller-supplied `x-forwarded-for` must never be trusted.
 */
export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: async ({ request }: { request: Request }) => {
        await ensureServerBootstrap();

        const ip = getRequestIP({ xForwardedFor: false });
        const headers = new Headers(request.headers);
        if (ip) headers.set(CLIENT_IP_HEADER, ip);
        else headers.delete(CLIENT_IP_HEADER);

        // The request is passed through untouched: rebuilding it with
        // `new Request(request, ...)` throws under Node's undici when the
        // source Request came from the server runtime's own realm. Only the
        // session lookup needs the stamped IP, and that reads these headers.
        const { response } = await rpcHandler.handle(request, {
          prefix: "/api/rpc",
          context: await createContext({ headers }),
        });

        return response ?? new Response("Not found", { status: 404 });
      },
    },
  },
});
