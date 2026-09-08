import { env } from "@aloysius-admissions/env/web";
import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";
import { getIncomingCookieHeader } from "./incoming-cookie";

export const authClient = createAuthClient({
  // better-auth derives its route-matching base from this URL's path, so the
  // public auth path must equal the server-side mount (/api/auth everywhere)
  baseURL: new URL("/api/auth", env.VITE_SERVER_URL).toString(),
  plugins: [multiSessionClient()],
  fetchOptions: {
    // Server-side `fetch` has no browser cookie jar, so beforeLoad's
    // getSession() during SSR would always look logged-out without this \u2014
    // forward the incoming request's session cookie explicitly.
    customFetchImpl: (input, init) => {
      const cookie = getIncomingCookieHeader();
      if (!cookie) return fetch(input, init);
      return fetch(input, { ...init, headers: { ...init?.headers, cookie } });
    },
  },
});
