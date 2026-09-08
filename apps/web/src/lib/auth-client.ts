import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";
import { getIncomingCookieHeader } from "./incoming-cookie";
import { getServerUrl } from "@/utils/server-url";

export const authClient = createAuthClient({
  // better-auth derives its route-matching base from this URL's path, so the
  // public auth path must equal the server-side mount (/api/auth everywhere)
  baseURL: new URL("/api/auth", getServerUrl()).toString(),
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
