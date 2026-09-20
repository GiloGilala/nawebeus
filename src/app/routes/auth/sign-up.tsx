// @ts-nocheck

import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { signupServerFn } from "@/app/server-functions/auth";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const [form, setForm] = React.useState({
    email: "",
    password: "ValidPass123!",
    fullName: "",
    organizationName: "",
  });
  const [message, setMessage] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const result = await signupServerFn({
        data: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          organizationName: form.organizationName,
          termsAccepted: true,
          privacyAccepted: true,
        },
      });
      setMessage(`Created org ${result.organization.slug} — user ${result.user.email}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Create your organization</h1>
      <p style={{ color: "#666" }}>
        Calls <code>signupServerFn</code> → <code>signup(db, input)</code> directly (no HTTP).
      </p>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <input
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          placeholder="Organization name"
          value={form.organizationName}
          onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
          required
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button type="submit">Create account</button>
      </form>
      {message && (
        <p style={{ marginTop: "1rem", background: "#f6f6f6", padding: "0.75rem" }}>{message}</p>
      )}
    </main>
  );
}
