// @ts-nocheck

/**
 * The invitation landing page (P14.2) — where every invitation email has pointed since NWB-P0-021.
 *
 * `invitation.service.ts` builds `${APP_BASE_URL_RESOLVED}/invite?token=…` and
 * `src/tests/email-links.test.ts` pins that *string*; until this file existed nothing checked that a
 * route answered it, so the link every invitee clicked was a 404 while `POST
 * /api/auth/invitations/:token/accept` sat there working and uncalled. This is the second dangling
 * redirect of the same class the social callback left behind (`/settings/integrations`, closed by
 * NWB-P14.3), and `src/tests/route-links.test.ts` now exists so a third one fails a gate.
 *
 * Public: the bearer of the token is mid-onboarding and has no session, so the 64-hex emailed token
 * is the credential. That has three consequences this route is written around.
 *
 * 1. **A broken link is page content, not a redirect.** Unknown, revoked and expired tokens all
 *    answer `NotFoundError` from the service (deliberately indistinguishable, so a prober learns
 *    nothing), and the *reason* is the only useful thing on the page — "ask your admin to send a new
 *    invitation". Sending that person to sign-in would lose it, so the loader catches NotFound and
 *    RateLimit and renders; only a real 500 propagates.
 * 2. **The form changes shape on `requiresAccountSetup`.** A new address registers into the org
 *    (full name, password, terms, privacy — required by the *service*, not by zod, because an
 *    existing account must not be asked for them); an existing account just confirms. Accepting is
 *    itself the email verification, so nobody gets a second link to a workspace they are already in.
 * 3. **No auto sign-in.** `acceptInvitation` creates no session and neither does the HTTP route, and
 *    an existing-account invitee never typed a password here — there is nothing to authenticate
 *    with. The success panel says so and links to sign-in instead of pretending otherwise.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { messageForAppError } from "@/app/lib/client-errors";
import {
  acceptInvitationServerFn,
  getInvitationPreviewServerFn,
} from "@/app/server-functions/auth";
import { NotFoundError, RateLimitError } from "@/lib/errors";

/** Mirrors `src/lib/password.ts` — the form's hint has to match what the service enforces. */
const PASSWORD_HINT =
  "At least 12 characters, with an uppercase letter, a lowercase letter, a number and a special character. No spaces, and it cannot contain your email address.";

export const Route = createFileRoute("/invite")({
  // The token rides in the query string because that is what the emailed link contains.
  validateSearch: (search) => ({
    token: typeof search.token === "string" && search.token.length > 0 ? search.token : undefined,
  }),

  // `loaderDeps` is the documented way to get search params into a loader; reading `useSearch()`
  // inside the loader is not a thing the router offers.
  loaderDeps: ({ search }) => ({ token: search.token }),

  loader: async ({ deps }) => {
    if (!deps.token) return { state: "missing-token" };
    try {
      const { invitation } = await getInvitationPreviewServerFn({ data: { token: deps.token } });
      return { state: "ready", invitation };
    } catch (error) {
      // Both of these are the page's answer, not a failure to load it.
      if (error instanceof NotFoundError) return { state: "invalid", message: error.message };
      if (error instanceof RateLimitError) return { state: "rate-limited", message: error.message };
      throw error;
    }
  },

  component: InvitePage,
});

const card = {
  maxWidth: 520,
  margin: "3rem auto",
  padding: "1.75rem",
  fontFamily: "sans-serif",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};

function DeadEnd({ title, body, showSignIn }) {
  return (
    <main style={card}>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p style={{ color: "#4b5563" }}>{body}</p>
      {showSignIn && (
        <p>
          <Link to="/auth/sign-in">Go to sign in</Link>
        </p>
      )}
    </main>
  );
}

function InvitePage() {
  const { token } = Route.useSearch();
  const loaded = Route.useLoaderData();

  const [form, setForm] = React.useState({
    fullName: "",
    password: "",
    termsAccepted: false,
    privacyAccepted: false,
    marketingOptIn: false,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState(null);
  const [accepted, setAccepted] = React.useState(null);

  if (loaded.state === "missing-token") {
    return (
      <DeadEnd
        title="This invitation link is incomplete"
        body="The link is missing its token. Open the invitation email and click the button again, or ask your administrator to send a new invitation."
        showSignIn
      />
    );
  }

  if (loaded.state === "invalid") {
    return (
      <DeadEnd
        title="This invitation is no longer valid"
        // The service's own words: unknown, revoked and expired are deliberately one answer, so
        // the page cannot and must not say which.
        body={`${loaded.message} If you already have an account you can sign in; otherwise ask your administrator to send a new invitation.`}
        showSignIn
      />
    );
  }

  if (loaded.state === "rate-limited") {
    return (
      <DeadEnd
        title="Too many attempts"
        body={`${loaded.message} The limit exists because the link is the credential — wait a little while and open the email again.`}
        showSignIn={false}
      />
    );
  }

  const invitation = loaded.invitation;
  const needsAccount = invitation.requiresAccountSetup;

  const canSubmit = needsAccount
    ? form.fullName.trim().length > 0 &&
      form.password.length > 0 &&
      form.termsAccepted &&
      form.privacyAccepted
    : true;

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await acceptInvitationServerFn({
        data: {
          token,
          ...(needsAccount
            ? {
                fullName: form.fullName.trim(),
                password: form.password,
                termsAccepted: form.termsAccepted,
                privacyAccepted: form.privacyAccepted,
                marketingOptIn: form.marketingOptIn,
              }
            : {}),
        },
      });
      setAccepted(result.membership);
    } catch (err) {
      setMessage(messageForAppError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (accepted) {
    return (
      <main style={card}>
        <h1 style={{ marginTop: 0 }}>You're in</h1>
        <p style={{ color: "#374151" }}>
          Your membership of <strong>{accepted.organizationName}</strong> is active as{" "}
          <strong>{accepted.email}</strong>.
          {accepted.newUser
            ? " Your account was created and this invitation verified your address — there is no second confirmation email to wait for."
            : " Your existing account was linked to this organization."}
        </p>
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          Accepting does not sign you in — the invitation link proves you read the email, not who
          you are. Sign in with your password to continue.
        </p>
        <p>
          <Link to="/auth/sign-in">Sign in to Nawebeus</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={card}>
      <h1 style={{ marginTop: 0 }}>Join {invitation.organizationName} on Nawebeus</h1>
      <p style={{ color: "#4b5563" }}>
        You were invited as <strong>{invitation.invitedEmail}</strong>.
        {invitation.expiresAt
          ? ` This invitation expires ${new Date(invitation.expiresAt).toLocaleString()}.`
          : ""}
      </p>

      {message && (
        <p style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: 6 }}>
          {message}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        {needsAccount ? (
          <>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: 0 }}>
              You do not have a Nawebeus account yet, so this form creates one with the invited
              address.
            </p>
            <label htmlFor="invite-full-name">Full name</label>
            <input
              id="invite-full-name"
              value={form.fullName}
              autoComplete="name"
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />

            <label htmlFor="invite-password">Password</label>
            <input
              id="invite-password"
              type="password"
              value={form.password}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>{PASSWORD_HINT}</p>

            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
              />
              <span>I accept the Terms of Service</span>
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.privacyAccepted}
                onChange={(e) => setForm({ ...form, privacyAccepted: e.target.checked })}
              />
              <span>I accept the Privacy Policy</span>
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={form.marketingOptIn}
                onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })}
              />
              <span style={{ color: "#4b5563" }}>
                Email me product updates (optional — this is the only marketing consent asked for)
              </span>
            </label>
          </>
        ) : (
          <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: 0 }}>
            You already have an account, so accepting links it to this organization. You will sign
            in with your existing password afterwards.
          </p>
        )}

        <button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Accepting…" : "Accept invitation"}
        </button>
      </form>

      <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: "1rem" }}>
        This link is single-use. If it has already been accepted, ask your administrator to send a
        new invitation.
      </p>
    </main>
  );
}
