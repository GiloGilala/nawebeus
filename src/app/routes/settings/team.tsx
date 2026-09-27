// @ts-nocheck

/**
 * Settings → Team (P14.2): the members list, the outstanding invitations, and the invite forms.
 *
 * The screen behind `members.*` — everything here already existed as a Server Function except the
 * two reads NWB-P14.2 added, and neither existed anywhere as a *screen*: inviting a teammate meant
 * calling `POST /api/orgs/:orgId/members/invite` by hand, and there was no way at all to see who had
 * not accepted yet (`listMembers` returns invited rows but projects a member shape, so expiry and
 * "resend" were not derivable from it).
 *
 * Three decisions worth knowing before reading the code:
 *
 * - **The management half degrades to a permission-denied panel instead of an error.** Invitations
 *   and the role catalog are `manager+`; the members list asserts no ability at all (it mirrors a
 *   Hono route that asserts none — finding F-P14.2-1, deliberately not "fixed" from a web ticket).
 *   So a Viewer loads this page, sees the team, and sees *why* the rest is missing. Turning that
 *   into a page-level 403 would hide the one thing they are allowed to look at.
 * - **Resend is not a new operation.** `inviteMember` on an address that already has a pending row
 *   takes its update path: fresh token, fresh expiry, email re-sent. So the resend button calls the
 *   same Server Function as the invite form, and the old link stops working — which is the property
 *   you want from a resend, and the reason no `resendInvitation` service exists.
 * - **The invitation token is never rendered.** `inviteMemberServerFn` returns one (so does the
 *   Hono route — finding F-P14.2-2); the email already carries it, and a token in the DOM is a token
 *   in browser history, devtools and any error report. The link is the email's job.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { messageForAppError } from "@/app/lib/client-errors";
import {
  assignRoleServerFn,
  bulkInviteServerFn,
  getMeServerFn,
  inviteMemberServerFn,
  listAssignableRolesServerFn,
  listMembersServerFn,
  listPendingInvitationsServerFn,
  removeMemberServerFn,
} from "@/app/server-functions";
import { AuthError, ForbiddenError } from "@/lib/errors";

/** FR-AUTH-006 AC3's default: seven days. Stated here so the form's hint is not a guess. */
const DEFAULT_INVITE_TTL_HOURS = 7 * 24;

export const Route = createFileRoute("/settings/team")({
  loader: async () => {
    try {
      const [{ members }, me] = await Promise.all([listMembersServerFn(), getMeServerFn()]);
      // Both of these are manager+. A refusal is this panel's permission-denied state, not a broken
      // page; anything else (a 500, a dead database) still propagates.
      const tolerate = (promise) =>
        promise.catch((error) => {
          if (error instanceof ForbiddenError) return { denied: true };
          throw error;
        });
      const [invitations, catalog] = await Promise.all([
        tolerate(listPendingInvitationsServerFn()),
        tolerate(listAssignableRolesServerFn()),
      ]);
      return { members, me, invitations, catalog };
    } catch (error) {
      if (error instanceof AuthError) throw redirect({ to: "/auth/sign-in" });
      throw error;
    }
  },

  component: TeamPage,
});

/**
 * The bulk form takes pasted lines, because `bulkInviteSchema` wants an array of row objects and
 * there is no CSV parser in the repo to reuse. Deliberately dumb and deliberately *previewed*: one
 * address per line, then an optional display name and department, comma-separated, no quoting. The
 * operator sees exactly the rows that will be sent before anything is sent, so a mis-split is visible
 * rather than arriving as twenty bad invitations.
 */
function parseBulkLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [email, displayName, department] = line.split(",").map((part) => (part ?? "").trim());
      return {
        email: email ?? "",
        ...(displayName ? { displayName } : {}),
        ...(department ? { department } : {}),
      };
    });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function TeamPage() {
  const loaded = Route.useLoaderData();

  const [members, setMembers] = React.useState(loaded.members);
  const [invitations, setInvitations] = React.useState(loaded.invitations);
  const [catalog, setCatalog] = React.useState(loaded.catalog);
  const [message, setMessage] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [busy, setBusy] = React.useState(null);

  const [invite, setInvite] = React.useState({
    email: "",
    roleId: "",
    displayName: "",
    jobTitle: "",
    department: "",
    invitationNote: "",
    expiresInHours: String(DEFAULT_INVITE_TTL_HOURS),
  });
  const [bulkText, setBulkText] = React.useState("");
  const [showBulk, setShowBulk] = React.useState(false);

  const meId = loaded.me?.user?.id;
  const denied = invitations?.denied === true || catalog?.denied === true;
  const roles = catalog?.roles ?? [];
  const pending = invitations?.invitations ?? [];

  async function reload() {
    setMessage(null);
    try {
      const { members: nextMembers } = await listMembersServerFn();
      setMembers(nextMembers);
      if (!denied) {
        const [nextInvitations, nextCatalog] = await Promise.all([
          listPendingInvitationsServerFn(),
          listAssignableRolesServerFn(),
        ]);
        setInvitations(nextInvitations);
        setCatalog(nextCatalog);
      }
    } catch (err) {
      setMessage(messageForAppError(err));
    }
  }

  /** One mutation shape for the whole screen: mark busy, call, reload, report. */
  async function run(key, fn, data, doneMessage) {
    setMessage(null);
    setNotice(null);
    setBusy(key);
    try {
      const result = await fn({ data });
      await reload();
      if (doneMessage) {
        setNotice(typeof doneMessage === "function" ? doneMessage(result) : doneMessage);
      }
      return result;
    } catch (err) {
      setMessage(messageForAppError(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitInvite(e) {
    e.preventDefault();
    const hours = Number.parseInt(invite.expiresInHours, 10);
    await run(
      `invite:${invite.email}`,
      inviteMemberServerFn,
      {
        email: invite.email.trim(),
        ...(invite.roleId ? { roleId: invite.roleId } : {}),
        ...(invite.displayName.trim() ? { displayName: invite.displayName.trim() } : {}),
        ...(invite.jobTitle.trim() ? { jobTitle: invite.jobTitle.trim() } : {}),
        ...(invite.department.trim() ? { department: invite.department.trim() } : {}),
        ...(invite.invitationNote.trim() ? { invitationNote: invite.invitationNote.trim() } : {}),
        ...(Number.isFinite(hours) && hours > 0 ? { expiresInHours: hours } : {}),
      },
      (result) =>
        `Invitation sent to ${result.email}. It expires ${formatDate(result.expiresAt)} — the link is in the email, and it is single-use.`,
    );
    setInvite({
      ...invite,
      email: "",
      displayName: "",
      jobTitle: "",
      department: "",
      invitationNote: "",
    });
  }

  /** Re-inviting the same address mints a new token and re-sends; the old link stops working. */
  function resend(row) {
    return run(
      `resend:${row.memberId}`,
      inviteMemberServerFn,
      {
        email: row.email,
        ...(row.roleId ? { roleId: row.roleId } : {}),
        ...(row.displayName ? { displayName: row.displayName } : {}),
        ...(row.jobTitle ? { jobTitle: row.jobTitle } : {}),
        ...(row.department ? { department: row.department } : {}),
      },
      `New invitation sent to ${row.email}; the previous link no longer works.`,
    );
  }

  function revoke(row) {
    const ok = window.confirm(
      `Revoke the invitation for ${row.email}? The link stops working immediately.`,
    );
    if (!ok) return undefined;
    return run(
      `revoke:${row.memberId}`,
      removeMemberServerFn,
      { memberId: row.memberId },
      `Invitation for ${row.email} revoked.`,
    );
  }

  function changeRole(member, roleId) {
    if (!roleId || roleId === member.roleId) return undefined;
    return run(
      `role:${member.id}`,
      assignRoleServerFn,
      { userId: member.userId, roleId },
      `${member.email} now has the ${roles.find((r) => r.id === roleId)?.name ?? "selected"} role.`,
    );
  }

  function removeMember(member) {
    const ok = window.confirm(
      `Remove ${member.email} from the organization? Their access stops immediately.`,
    );
    if (!ok) return undefined;
    return run(
      `remove:${member.id}`,
      removeMemberServerFn,
      { memberId: member.id },
      `${member.email} was removed.`,
    );
  }

  function submitBulk(e) {
    e.preventDefault();
    const rows = parseBulkLines(bulkText);
    if (rows.length === 0) {
      setMessage("Nothing to send — add at least one email address.");
      return undefined;
    }
    return run(
      "bulk",
      bulkInviteServerFn,
      { csv: rows },
      (result) =>
        `${result.successes} invitation${result.successes === 1 ? "" : "s"} sent` +
        (result.failures.length > 0
          ? `; ${result.failures.length} failed (${result.failures
              .map((f) => `${f.email ?? "row"}: ${f.error ?? f.reason ?? "refused"}`)
              .join("; ")})`
          : "."),
    );
  }

  const bulkRows = parseBulkLines(bulkText);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <h1>Team</h1>
      <p style={{ color: "#666" }}>
        Members belong to the organization. Inviting, changing roles and removing people follow the
        role ladder: you can only act on seats below your own, and nobody can grant Owner —
        ownership is transferred, not assigned.
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

      {denied && (
        <section
          style={{
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            color: "#4b5563",
          }}
        >
          <strong>Invitations and role changes need Manager or above.</strong> You can see the team;
          you cannot change it. Ask an administrator if someone needs adding.
        </section>
      )}

      {!denied && (
        <>
          <section style={{ marginBottom: "2rem" }}>
            <h2>Invite someone</h2>
            <form
              onSubmit={submitInvite}
              style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: 560 }}
            >
              <label htmlFor="invite-email">Email address</label>
              <input
                id="invite-email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                required
              />

              <label htmlFor="invite-role">Role</label>
              <select
                id="invite-role"
                value={invite.roleId}
                onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}
              >
                {/* An empty value is the service's default (Viewer), not a gap in the list. */}
                <option value="">Viewer (default)</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                    {role.isCustom ? " — custom" : ""}
                  </option>
                ))}
              </select>
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                {catalog?.actor?.code
                  ? `You can assign roles below ${catalog.actor.code}. Owner is never in this list — ownership is transferred.`
                  : "Roles you may grant, highest first."}
              </p>

              <label htmlFor="invite-name">Display name (optional)</label>
              <input
                id="invite-name"
                value={invite.displayName}
                onChange={(e) => setInvite({ ...invite, displayName: e.target.value })}
              />

              <label htmlFor="invite-title">Job title (optional)</label>
              <input
                id="invite-title"
                value={invite.jobTitle}
                onChange={(e) => setInvite({ ...invite, jobTitle: e.target.value })}
              />

              <label htmlFor="invite-department">Department (optional)</label>
              <input
                id="invite-department"
                value={invite.department}
                onChange={(e) => setInvite({ ...invite, department: e.target.value })}
              />

              <label htmlFor="invite-note">Note in the invitation email (optional)</label>
              <textarea
                id="invite-note"
                rows={2}
                value={invite.invitationNote}
                onChange={(e) => setInvite({ ...invite, invitationNote: e.target.value })}
              />

              <label htmlFor="invite-ttl">Expires in (hours)</label>
              <input
                id="invite-ttl"
                type="number"
                min="1"
                value={invite.expiresInHours}
                onChange={(e) => setInvite({ ...invite, expiresInHours: e.target.value })}
              />

              <button type="submit" disabled={busy !== null || invite.email.trim().length === 0}>
                {busy?.startsWith("invite:") ? "Sending…" : "Send invitation"}
              </button>
            </form>

            <p style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={() => setShowBulk(!showBulk)}>
                {showBulk ? "Hide bulk invite" : "Invite several people"}
              </button>
            </p>

            {showBulk && (
              <form
                onSubmit={submitBulk}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "1rem",
                }}
              >
                <label htmlFor="bulk-text">One address per line</label>
                <textarea
                  id="bulk-text"
                  rows={5}
                  value={bulkText}
                  placeholder={
                    "ada@newsroom.ng, Ada Obi, Metro Desk\n# lines starting with # are ignored\ntunde@newsroom.ng"
                  }
                  onChange={(e) => setBulkText(e.target.value)}
                  style={{ fontFamily: "monospace" }}
                />
                <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                  Format: <code>email, display name, department</code> — the last two optional.
                  Quoted commas are not supported; everyone in a bulk invite gets the default role,
                  so invite managers individually.
                </p>
                {bulkRows.length > 0 && (
                  <table style={{ borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "0.25rem 0.5rem" }}>#</th>
                        <th style={{ padding: "0.25rem 0.5rem" }}>Email</th>
                        <th style={{ padding: "0.25rem 0.5rem" }}>Display name</th>
                        <th style={{ padding: "0.25rem 0.5rem" }}>Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, index) => (
                        // The preview is keyed by position: it is a rendering of the textarea, not a
                        // collection with identity of its own.
                        // biome-ignore lint/suspicious/noArrayIndexKey: preview of pasted lines
                        <tr key={index}>
                          <td style={{ padding: "0.25rem 0.5rem", color: "#9ca3af" }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: "0.25rem 0.5rem" }}>{row.email}</td>
                          <td style={{ padding: "0.25rem 0.5rem" }}>{row.displayName ?? "—"}</td>
                          <td style={{ padding: "0.25rem 0.5rem" }}>{row.department ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <button type="submit" disabled={busy !== null || bulkRows.length === 0}>
                  {busy === "bulk"
                    ? "Sending…"
                    : `Send ${bulkRows.length || ""} invitation${bulkRows.length === 1 ? "" : "s"}`}
                </button>
              </form>
            )}
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Awaiting acceptance ({pending.length})</h2>
            {pending.length === 0 ? (
              <p style={{ color: "#666" }}>No outstanding invitations.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "0.5rem" }}>Invited</th>
                    <th style={{ padding: "0.5rem" }}>Role</th>
                    <th style={{ padding: "0.5rem" }}>Sent</th>
                    <th style={{ padding: "0.5rem" }}>Expires</th>
                    <th style={{ padding: "0.5rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((row) => (
                    <tr key={row.memberId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.5rem" }}>
                        <div>{row.email}</div>
                        {row.displayName && (
                          <div style={{ color: "#888", fontSize: "0.85rem" }}>
                            {row.displayName}
                          </div>
                        )}
                        {row.hasAccount && (
                          <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                            already has an account — accepting links it
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>{row.roleName ?? "—"}</td>
                      <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                        {formatDate(row.sentAt ?? row.invitedAt)}
                      </td>
                      <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                        {row.expired ? (
                          <span style={{ color: "#991b1b" }}>expired — resend</span>
                        ) : (
                          formatDate(row.expiresAt)
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => resend(row)}
                          >
                            {busy === `resend:${row.memberId}` ? "Sending…" : "Resend"}
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => revoke(row)}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <section>
        <h2>Members ({members.length})</h2>
        {members.length === 0 ? (
          <p style={{ color: "#666" }}>Nobody here yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.5rem" }}>Person</th>
                <th style={{ padding: "0.5rem" }}>Role</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Joined</th>
                {!denied && <th style={{ padding: "0.5rem" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isMe = member.userId === meId;
                const invited = member.status === "invited";
                return (
                  <tr key={member.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <div>
                        {member.displayName ?? member.email}
                        {isMe && <span style={{ color: "#6b7280" }}> (you)</span>}
                      </div>
                      <div style={{ color: "#888", fontSize: "0.85rem" }}>{member.email}</div>
                      {member.jobTitle && (
                        <div style={{ color: "#888", fontSize: "0.85rem" }}>
                          {member.jobTitle}
                          {member.department ? ` · ${member.department}` : ""}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {denied || invited || isMe || !member.userId ? (
                        // An invited row has no user to reassign yet, and the service refuses a
                        // self-change — so both render the role as text rather than a control that
                        // would only produce a 403.
                        <span>{member.roleSlug ?? "—"}</span>
                      ) : (
                        <select
                          value={member.roleId ?? ""}
                          disabled={busy !== null}
                          onChange={(e) => changeRole(member, e.target.value)}
                        >
                          <option value={member.roleId ?? ""}>
                            {member.roleSlug ?? "current"}
                          </option>
                          {roles
                            .filter((role) => role.id !== member.roleId)
                            .map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                      {member.status}
                      {member.isActive === false ? " · inactive" : ""}
                    </td>
                    <td style={{ padding: "0.5rem", fontSize: "0.85rem" }}>
                      {invited ? "—" : formatDate(member.joinedAt)}
                    </td>
                    {!denied && (
                      <td style={{ padding: "0.5rem" }}>
                        {!isMe && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => removeMember(member)}
                          >
                            {busy === `remove:${member.id}` ? "Removing…" : "Remove"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          Removing the last active Owner or Admin is refused — an organization always keeps one
          (BR-AUTH-030). Invited rows appear here too; the panel above is where they are managed.
        </p>
      </section>
    </main>
  );
}
