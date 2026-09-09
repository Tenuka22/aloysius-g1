import { checkDatabaseHealth } from "@aloysius-admissions/api/server";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Liveness/readiness probe used by the container healthcheck.
 *
 * Reports 503 when the database cannot be reached so an orchestrator does not
 * route traffic to an instance that can serve HTML but not data.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        const database = checkDatabaseHealth();
        return Response.json(
          {
            status: database.status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks: { database },
          },
          { status: database.status === "healthy" ? 200 : 503 },
        );
      },
    },
  },
});
