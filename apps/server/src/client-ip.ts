import { CLIENT_IP_HEADER } from "@aloysius-admissions/auth/client-ip-header";
import type { Server } from "bun";

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/**
 * Stamps the socket peer address onto the request as the one client IP the rest
 * of the process trusts, overwriting anything the caller supplied.
 *
 * This runs at the edge, before Hono, so every downstream consumer -- the auth
 * handler, oRPC's context -- reads the same non-spoofable value. Forwarded
 * headers are ignored on purpose: nothing sits in front of this process, so
 * `x-forwarded-for` is caller-controlled and honouring it would let anyone
 * forge the IP recorded against their session.
 *
 * If a reverse proxy is ever placed in front, this is the single place to
 * resolve the forwarded chain against the proxy's address.
 */
export function applyClientIp(request: Request, server: Server): Request {
  const address = server.requestIP(request)?.address;
  if (address) {
    // Dual-stack sockets report IPv4 peers as IPv4-mapped IPv6 (::ffff:1.2.3.4).
    request.headers.set(CLIENT_IP_HEADER, IPV4_MAPPED.exec(address)?.[1] ?? address);
  } else {
    request.headers.delete(CLIENT_IP_HEADER);
  }
  return request;
}
