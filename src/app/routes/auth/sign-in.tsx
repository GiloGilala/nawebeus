// @ts-nocheck

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { signinServerFn } from "@/app/server-functions/auth";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      // ✅ Direct Server Function call — validates with Zod and invokes `signIn(db, ...)`
      // in-process. No `fetch("/api/auth/signin")`, no HTTP hop (ADR-002, Principle 3).
      const result = await signinServerFn({ data: { email, password } });
      if ((result as { requiresMfa?: boolean }).requiresMfa) {
        setMessage("MFA required — check your authenticator app and call verifyMfaLoginServerFn.");
      } else {
        setMessage(`Signed in: ${(result as { user: { id: string } }).user.id}`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Sign in</h1>
      <p style={{ color: "#666" }}>Server Function: `signinServerFn` → `services/auth/auth.service`.</p>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Continue</button>
      </form>
      {message && <p style={{ marginTop: "1rem", background: "#f6f6f6", padding: "0.75rem" }}>{message}</p>}
      <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "1rem" }}>
        Mobile calls <code>POST /api/auth/signin</code> (Hono, <code>src/server/api/auth</code>) with the same service.
        Web goes direct.
      </p>
    </main>
  );
}
