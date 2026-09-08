/**
 * Name of the header carrying the client IP that this system trusts.
 *
 * better-auth can only resolve a client IP from request headers, so the server
 * stamps the socket peer address onto every request under this name, replacing
 * whatever the client sent. Without it, better-auth resolves no IP in
 * production and rate-limits every caller through one shared per-path bucket.
 *
 * `x-forwarded-for` is deliberately NOT used: nothing sits in front of this
 * process, so that header is attacker-controlled and rotating it would defeat
 * the auth rate limit entirely.
 *
 * This lives in its own module because `./index.ts` opens a database
 * connection at import time (`export const auth = createAuth()`); consumers
 * that only need the header name must not drag that in.
 */
export const CLIENT_IP_HEADER = "x-client-ip";
