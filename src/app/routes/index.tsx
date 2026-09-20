// @ts-nocheck

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Nawebeus</h1>
      <p>Unified social media management and PR intelligence — built for Nigeria & Africa.</p>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Architecture: TanStack Start (SSR + Server Functions) + Hono at <code>/api/*</code> — single Bun process
        (ADR-002, ADR-007). Web calls <code>services/</code> in-process; mobile & webhooks use Hono.
      </p>
      <nav style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <Link to="/auth/sign-in">Sign in</Link>
        <Link to="/auth/sign-up">Sign up</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <section style={{ marginTop: "2rem", border: "1px solid #ddd", padding: "1rem", borderRadius: "8px" }}>
        <h2>How the web talks to services</h2>
        <pre style={{ background: "#f6f6f6", padding: "1rem", overflowX: "auto" }}>
          {`// src/app/routes/auth/sign-in.tsx — no fetch, no HTTP hop
import { signinServerFn } from "@/app/server-functions/auth";

const result = await signinServerFn({ data: { email, password } });
// → validates with Zod → calls signIn(db, email, password) in-process
// → service → DB → cookies set via Server Function response headers`}
        </pre>
        <p style={{ fontSize: "0.85rem", color: "#555" }}>
          Mobile and webhooks continue to use <code>POST /api/auth/signin</code> via Hono
          (<code>src/server/api/*</code>). Same <code>services/</code>, two thin entry points.
        </p>
      </section>
    </main>
  );
}
