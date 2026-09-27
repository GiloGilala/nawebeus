// @ts-nocheck

/**
 * Settings → Integrations (P14.3, the plan's "social account connect (OAuth)" cluster).
 *
 * The screen the OAuth callback has been redirecting to since NWB-P2-001
 * (`/settings/integrations?connected=<platform>`), and the consumer of the whole social
 * management surface: NWB-P2-006's reads and disconnect, NWB-P2-007's pause/resume, on-demand
 * probe, attention filter and impact preview.
 *
 * Everything goes through Server Functions (`@/app/server-functions/social`) — no `fetch("/api/…")`,
 * no HTTP hop (ADR-002 Principle 3). Authorization is the server functions' `assertServerAbility`,
 * so this component renders every action and lets a 403 arrive as a message: the web has no
 * permissions payload to hide buttons with, and a button that lies about being clickable is worse
 * than one that explains itself when clicked.
 *
 * Two flows carry the module's ceremony:
 * - **Connect** — `initiateSocialConnectServerFn` mints the single-use state and returns the
 *   provider's authorize URL; the browser navigates there, the provider comes back to the public
 *   Hono callback, and the callback 302s here with `?connected=<platform>`.
 * - **Disconnect** — impact preview first (FR-SOC-011), then the typed-username confirmation
 *   (FR-SOC-012), then the call that wipes the tokens and stamps the 90-day read-only retention
 *   window (FR-SOC-014). The provider revocation outcome comes back in the receipt line: it is
 *   best-effort by contract, so "the provider refused" is information, not a failure.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { messageForAppError } from "@/app/lib/client-errors";
import {
  checkSocialAccountHealthServerFn,
  disconnectSocialAccountServerFn,
  getSocialDisconnectImpactServerFn,
  initiateSocialConnectServerFn,
  listSocialAccountsServerFn,
  pauseSocialAccountServerFn,
  resumeSocialAccountServerFn,
} from "@/app/server-functions/social";
import { AuthError } from "@/lib/errors";
import { SOCIAL_PLATFORMS } from "@/lib/validation";

/** The platform labels, so the screen says "X (Twitter)" where the enum says `twitter_x`. */
const PLATFORM_LABELS = {
  youtube: "YouTube",
  twitter_x: "X (Twitter)",
  instagram: "Instagram",
  facebook: "Facebook",
  reddit: "Reddit",
};

/** Status → the copy and colour an operator reads at a glance (Module 3 §3.2's lifecycle). */
const STATUS_BADGES = {
  active: { label: "Connected", color: "#0a7d33", bg: "#e7f6ec" },
  error: { label: "Error", color: "#9a3412", bg: "#ffedd5" },
  paused: { label: "Paused", color: "#4b5563", bg: "#f3f4f6" },
  needs_reauth: { label: "Needs re-authentication", color: "#92400e", bg: "#fef3c7" },
  disconnected: { label: "Disconnected", color: "#6b7280", bg: "#f9fafb" },
  pending_verification: { label: "Pending verification", color: "#1d4ed8", bg: "#dbeafe" },
};

const QUOTA_LABELS = {
  healthy: "Quota healthy",
  warning: "Quota 80%+",
  critical: "Quota 95%+",
  exhausted: "Quota exhausted",
};

export const Route = createFileRoute("/settings/integrations")({
  // The callback's `?connected=<platform>` is how this screen knows a connection just landed.
  validateSearch: (search) => ({
    connected: typeof search.connected === "string" ? search.connected : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),

  loader: async () => {
    try {
      // One call: `attentionCount` rides along on every list response and is org-wide and
      // filter-independent (NWB-P2-007), so the badge needs no second round trip.
      const page = await listSocialAccountsServerFn({ data: { limit: 50 } });
      return { page };
    } catch (error) {
      // Auth failures go to sign-in; everything else propagates so a 500 is not a login loop.
      if (error instanceof AuthError) throw redirect({ to: "/auth/sign-in" });
      throw error;
    }
  },

  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { connected, error: errorParam } = Route.useSearch();
  const loaderData = Route.useLoaderData();

  const [accounts, setAccounts] = React.useState(loaderData.page.accounts);
  const [attentionCount, setAttentionCount] = React.useState(loaderData.page.attentionCount);
  const [attentionOnly, setAttentionOnly] = React.useState(false);
  const [cursor, setCursor] = React.useState(loaderData.page.pageInfo.cursor);
  const [hasMore, setHasMore] = React.useState(loaderData.page.pageInfo.hasMore);
  const [notice, setNotice] = React.useState(connected ? `${label(connected)} connected.` : null);
  const [message, setMessage] = React.useState(errorParam ?? null);
  const [busyId, setBusyId] = React.useState(null);
  const [disconnect, setDisconnect] = React.useState(null);

  function label(platform) {
    return PLATFORM_LABELS[platform] ?? platform;
  }

  async function reload(opts = {}) {
    setMessage(null);
    try {
      const page = await listSocialAccountsServerFn({
        data: {
          limit: 50,
          ...(opts.attention ? { attention: true } : {}),
          ...(opts.append ? { cursor } : {}),
        },
      });
      setAccounts(opts.append ? [...accounts, ...page.accounts] : page.accounts);
      setAttentionCount(page.attentionCount);
      setCursor(page.pageInfo.cursor);
      setHasMore(page.pageInfo.hasMore);
    } catch (err) {
      setMessage(messageForAppError(err));
    }
  }

  /**
   * FR-SOC-044's one-click action. The filter is server-side (`?attention=true`), so flipping the
   * flag has to re-fetch — setting state alone would leave the table showing exactly what it showed
   * before while the button claimed otherwise. `attentionCount` is org-wide and filter-independent,
   * so the badge survives the switch either way.
   */
  async function toggleAttention() {
    const next = !attentionOnly;
    setAttentionOnly(next);
    await reload({ attention: next });
  }

  async function connect(platform) {
    setMessage(null);
    setNotice(null);
    try {
      // No returnUrl: the Server Function defaults it to
      // `/settings/integrations?connected=<platform>`, which is what makes the banner below fire.
      // Naming the path here without the query would have suppressed it — the callback only adds
      // `?connected=` when the state carried no returnUrl at all.
      const { authorizeUrl } = await initiateSocialConnectServerFn({ data: { platform } });
      // The provider's consent screen is the next step; the callback brings the browser back here.
      window.location.href = authorizeUrl;
    } catch (err) {
      setMessage(messageForAppError(err));
    }
  }

  async function run(accountId, fn, data, doneMessage) {
    setMessage(null);
    setBusyId(accountId);
    try {
      const result = await fn({ data: { accountId, ...data } });
      await reload({ attention: attentionOnly });
      if (doneMessage)
        setNotice(typeof doneMessage === "function" ? doneMessage(result) : doneMessage);
      return result;
    } catch (err) {
      setMessage(messageForAppError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function openDisconnect(account) {
    setMessage(null);
    setDisconnect({ account, impact: null, confirm: "", running: false });
    try {
      // FR-SOC-011: show what will break *before* asking anyone to type the username.
      const impact = await getSocialDisconnectImpactServerFn({ data: { accountId: account.id } });
      setDisconnect((current) => (current ? { ...current, impact } : current));
    } catch (err) {
      setDisconnect(null);
      setMessage(messageForAppError(err));
    }
  }

  async function confirmDisconnect() {
    if (!disconnect?.impact) return;
    setDisconnect({ ...disconnect, running: true });
    setMessage(null);
    try {
      const result = await disconnectSocialAccountServerFn({
        data: {
          accountId: disconnect.account.id,
          confirmUsername: disconnect.confirm,
        },
      });
      setDisconnect(null);
      await reload({ attention: attentionOnly });
      setNotice(
        `${label(result.platform)} @${result.platformUsername} disconnected. Data stays readable until ${new Date(
          result.dataRetentionUntil,
        ).toLocaleDateString()} — provider revocation: ${result.revocation}.`,
      );
    } catch (err) {
      setDisconnect((current) => (current ? { ...current, running: false } : current));
      setMessage(messageForAppError(err));
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <h1>Integrations</h1>
      <p style={{ color: "#666" }}>
        Connect the platforms Nawebeus collects from. Connections belong to the organization, not to
        whoever clicked <em>Connect</em> (FR-SOC-005).
      </p>

      {notice && (
        <p style={{ background: "#e7f6ec", color: "#0a7d33", padding: "0.75rem", borderRadius: 6 }}>
          {notice}
        </p>
      )}
      {message && (
        <p style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: 6 }}>
          {message}
        </p>
      )}

      {attentionCount > 0 && (
        <section
          style={{
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* FR-SOC-044: the widget, with its one-click action. */}
          <strong>
            {attentionCount} account{attentionCount === 1 ? "" : "s"} need
            {attentionCount === 1 ? "s" : ""} attention
          </strong>
          <button type="button" onClick={toggleAttention}>
            {attentionOnly ? "Show all" : "Show them"}
          </button>
        </section>
      )}

      <section style={{ marginBottom: "2rem" }}>
        <h2>Connect a platform</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {SOCIAL_PLATFORMS.map((platform) => (
            <button key={platform} type="button" onClick={() => connect(platform)}>
              Connect {label(platform)}
            </button>
          ))}
        </div>
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          Requires <code>socialaccounts.connect</code> (Manager and above). A platform whose OAuth
          app is not configured yet answers with a validation error rather than half-starting.
        </p>
      </section>

      <section>
        <h2>Connected accounts</h2>
        {accounts.length === 0 ? (
          <p style={{ color: "#666" }}>
            {attentionOnly
              ? "Nothing needs attention right now."
              : "No connections yet — connect a platform above."}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Account</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Quota</th>
                <th style={{ padding: "0.5rem" }}>Token expires</th>
                <th style={{ padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const badge = STATUS_BADGES[account.status] ?? STATUS_BADGES.active;
                const busy = busyId === account.id;
                return (
                  <tr key={account.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <div>
                        <strong>{label(account.platform)}</strong>{" "}
                        <span style={{ color: "#666" }}>@{account.platformUsername}</span>
                      </div>
                      {account.displayName && (
                        <div style={{ color: "#888", fontSize: "0.85rem" }}>
                          {account.displayName}
                        </div>
                      )}
                      {account.circuitBreakerOpen && (
                        <div style={{ color: "#991b1b", fontSize: "0.85rem" }}>
                          Circuit breaker open — dispatch stopped
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: "0.15rem 0.5rem",
                          borderRadius: 999,
                          fontSize: "0.8rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                      {QUOTA_LABELS[account.quotaStatus] ?? account.quotaStatus}
                    </td>
                    <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                      {account.tokenExpiresAt
                        ? new Date(account.tokenExpiresAt).toLocaleString()
                        : "—"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        {account.status === "paused" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                account.id,
                                resumeSocialAccountServerFn,
                                {},
                                "Collection resumed.",
                              )
                            }
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                account.id,
                                pauseSocialAccountServerFn,
                                {},
                                "Collection paused — tokens kept, nothing is re-authenticated on resume.",
                              )
                            }
                          >
                            Pause
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(
                              account.id,
                              checkSocialAccountHealthServerFn,
                              {},
                              (result) =>
                                `Probe: ${result.probe}. Status ${result.status}${
                                  result.circuitBreakerOpen
                                    ? " — breaker still open."
                                    : " — breaker closed."
                                }`,
                            )
                          }
                        >
                          Check health
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openDisconnect(account)}
                        >
                          Disconnect
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {hasMore && (
          <button type="button" onClick={() => reload({ attention: attentionOnly, append: true })}>
            Load more
          </button>
        )}
      </section>

      {disconnect && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              maxWidth: 520,
              width: "100%",
              padding: "1.5rem",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Disconnect {label(disconnect.account.platform)} @{disconnect.account.platformUsername}
              ?
            </h2>

            {!disconnect.impact ? (
              <p style={{ color: "#666" }}>Loading what this affects…</p>
            ) : (
              <>
                <p style={{ color: "#374151" }}>
                  Tokens are revoked at the provider where the platform allows it and wiped here
                  either way. Historical data stays readable for{" "}
                  <strong>{disconnect.impact.retentionDays} days</strong>, then the retention worker
                  reclaims it (FR-SOC-014).
                </p>
                <h3 style={{ marginBottom: "0.35rem" }}>What this affects</h3>
                <ul style={{ marginTop: 0, color: "#374151" }}>
                  {disconnect.impact.domains.map((domain) => (
                    <li key={domain.domain}>
                      {domain.label}:{" "}
                      {domain.count === null ? (
                        <span style={{ color: "#6b7280" }}>
                          not countable yet — {domain.landsWith}
                        </span>
                      ) : (
                        <strong>{domain.count}</strong>
                      )}
                    </li>
                  ))}
                </ul>
                <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                  An unknown count is not a zero: those modules are not adopted yet, so nothing can
                  count their rows. Treat "not countable yet" as "check before you cut".
                </p>

                <label
                  htmlFor="confirm-username"
                  style={{ display: "block", marginBottom: "0.35rem" }}
                >
                  Type <strong>{disconnect.impact.confirmationUsername}</strong> to confirm
                </label>
                <input
                  id="confirm-username"
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
                  value={disconnect.confirm}
                  autoComplete="off"
                  onChange={(e) => setDisconnect({ ...disconnect, confirm: e.target.value })}
                />
              </>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
                marginTop: "1rem",
              }}
            >
              <button
                type="button"
                onClick={() => setDisconnect(null)}
                disabled={disconnect.running}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisconnect}
                disabled={
                  disconnect.running ||
                  !disconnect.impact ||
                  disconnect.confirm !== disconnect.impact.confirmationUsername
                }
                style={{
                  background: "#b91c1c",
                  color: "white",
                  border: "none",
                  padding: "0.5rem 1rem",
                }}
              >
                {disconnect.running ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
            <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.75rem" }}>
              Requires <code>socialaccounts.disconnect</code> (Admin and above). Reconnecting later
              revives this row — with a clean breaker and no retention clock.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
