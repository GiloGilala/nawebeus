// @ts-nocheck

import { createFileRoute, redirect } from "@tanstack/react-router";
import { listOrgsServerFn } from "@/app/server-functions/orgs";
import { getMeServerFn } from "@/app/server-functions/users";
import { AuthError } from "@/lib/errors";

export const Route = createFileRoute("/dashboard/")({
  // SSR loader: fetches directly via Server Functions — no HTTP hop.
  // Hono's `/api/me` and `/api/orgs` exist for mobile; web goes direct.
  loader: async () => {
    try {
      const [me, orgs] = await Promise.all([getMeServerFn(), listOrgsServerFn()]);
      return { me, orgs };
    } catch (error) {
      // Auth failures send the browser to sign-in. Every other error propagates
      // (tanstack-start.md §19) so a 500/403 is not silently turned into a login loop.
      if (error instanceof AuthError) throw redirect({ to: "/auth/sign-in" });
      throw error;
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const data = Route.useLoaderData() as {
    me: { user: { displayName: string | null; email: string } };
    orgs: { orgs: Array<{ name: string; slug: string }> };
  };
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <p>
        Welcome, {data.me.user.displayName ?? data.me.user.email}. Loaded via{" "}
        <code>getMeServerFn</code> + <code>listOrgsServerFn</code> — both SSR, both in-process.
      </p>
      <h2>Your organizations</h2>
      <ul>
        {data.orgs.orgs.map((o) => (
          <li key={o.slug}>
            {o.name} — {o.slug}
          </li>
        ))}
      </ul>
    </main>
  );
}
