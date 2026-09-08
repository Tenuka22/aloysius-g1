import { CLIENT_IP_HEADER } from "@aloysius-admissions/auth/client-ip-header";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const store = new Map<string, RateLimitEntry>();

const configs = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
  submission: { windowMs: 60 * 1000, maxRequests: 5 },
  default: { windowMs: 60 * 1000, maxRequests: 100 },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * Only the socket peer address stamped on by `applyClientIp` is trusted.
 * Reading `x-forwarded-for` here would be a bypass: it is caller-controlled
 * while nothing proxies this process, so rotating it would hand every request
 * a fresh bucket and make the auth limit unenforceable.
 */
function getClientIp(request: Request): string {
  return request.headers.get(CLIENT_IP_HEADER)?.trim() || "unknown";
}

function getRateLimitKey(ip: string, route: string): string {
  return `${ip}:${route}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

setInterval(cleanup, 60 * 1000);

export function checkRateLimit(
  request: Request,
  route: "auth" | "submission" | "default" = "default",
): { allowed: boolean; remaining: number; resetAt: number } {
  const ip = getClientIp(request);
  const config = configs[route] ?? configs.default;
  const key = getRateLimitKey(ip, route);
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + config.windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}
