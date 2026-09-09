import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/lib/auth-functions";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
      });
    }
    // Wrapped as `{ data }` to keep the shape the auth client used to return:
    // nine routes under this layout read `session.data?.user.role`, and three
    // vendored auth components use an unrelated `session.data` of their own,
    // so preserving the contract here is safer than rewriting all of them.
    return { session: { data: session } };
  },
});

function AuthLayout() {
  return <Outlet />;
}
