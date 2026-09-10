/**
 * Name of the header carrying the client IP that this system trusts.
 *
 * better-auth can only resolve a client IP from request headers, so the server
 * stamps the socket peer address onto every request under this name, replacing
 * whatever the client sent. Without it, better-auth resolves no IP and records
 * every session and audit trail without an origin address.
 *
 * `x-forwarded-for` is deliberately NOT used: nothing sits in front of this
 * process, so that header is attacker-controlled and any caller could forge
 * the address attributed to them.
 *
 * This lives in its own module because `./index.ts` imports
 * `@aloysius-admissions/db`'s schema and `createAuth()` needs a `Database`
 * handle passed in by its caller; consumers that only need the header name
 * must not drag any of that in.
 */
export const CLIENT_IP_HEADER = "x-client-ip";
