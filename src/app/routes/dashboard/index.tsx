// @ts-nocheck

import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMeServerFn } from "@/app/server-functions/users";
import { listOrgsServerFn } from "@/app/server-functions/orgs";

export const Route = createFileRoute("/dashboard/")({
  // SSR loader: fetches directly via Server Functions — no HTTP hop.
  // Hono's `/api/me` and `/api/orgs` exist for mobile; web goes direct.
  loader: async () => {
    try {
      const [me, orgs] = await Promise.all([getMeServerFn(), listOrgsServerFn()]);
      return { me, orgs };
    } catch {
      throw redirect({ to: "/auth/sign-in" });
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
          <li key={o.slug}>{o.name} — {o.slug}</li>
        ))}
      </ul>
    </main>
  );
}
