/**
 * `/api/approvals` — the HTTP surface and the hourly job (NWB-P1-003).
 *
 * The no-DB describe pins what must answer before any query: 401 without a session on every verb
 * and the mount itself. The DB describe drives the roadmap's acceptance ("approval queue works
 * end to end") through the real app — sign-in cookies, `requireAbility` on the seeded role
 * matrix, the row-level gates in the service — and finishes with the worker closing a stale row.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { approvalsExpireStaleJob } from "../../jobs/approvals-expire-stale";
import type { Db } from "../../lib/db";
import { type JobAttempt, runJobGuarded } from "../../lib/worker";
import { writeAuditLog } from "../../services/audit";
import { createTestApp } from "../helpers/test-client";
import { ensureMigrationApplied, withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const MIGRATION = "0004_approval_ids_expired_action_pending_unique.sql";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};
const savedEnv: Record<string, string | undefined> = {};

type App = ReturnType<typeof createTestApp>;

async function cookieFor(app: App, email: string): Promise<string> {
  const res = await app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_USER_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`signin failed: ${res.status} ${await res.text()}`);
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

function post(app: App, path: string, cookie: string, body: unknown = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

interface Envelope<T> {
  data: T;
  meta?: { pagination?: { cursor: string | null; hasMore: boolean } };
  error?: { code: string; message: string; details?: unknown };
}

interface ApprovalJson {
  id: string;
  status: string;
  currentStep: number;
  currentApproverId: string | null;
  version: number;
  entityId: string;
  history: { action: string; actorId: string; comment: string | null }[];
}

async function json<T>(res: Response): Promise<Envelope<T>> {
  return (await res.json()) as Envelope<T>;
}

interface Cast {
  orgId: string;
  creator: { id: string; cookie: string };
  manager: { id: string; cookie: string };
  admin: { id: string; cookie: string };
  viewer: { id: string; cookie: string };
}

async function cast(db: Db, app: App): Promise<Cast> {
  await ensureMigrationApplied(db, MIGRATION);
  const owner = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: owner.id });
  await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
  const member = async (roleCode: string) => {
    const user = await createTestUser(db);
    await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode });
    return { id: user.id, cookie: await cookieFor(app, user.email) };
  };
  return {
    orgId: org.id,
    creator: await member("creator"),
    manager: await member("manager"),
    admin: await member("admin"),
    viewer: await member("viewer"),
  };
}

let seq = 0;
function submission(managerId: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    entityType: "post",
    entityId: `post-${Date.now()}-${seq}`,
    entityVersion: 1,
    contentSnapshot: { title: "Launch", body: "Copy" },
    chain: [{ order: 1, userId: managerId, role: "manager" }],
    ...extra,
  };
}

describe("approval routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) {
      savedEnv[k] = process.env[k];
      process.env[k] ??= v;
    }
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  test("every verb is 401 without a session, before any query", async () => {
    const app = createTestApp();
    const id = "apr_000000000000000000000";
    const attempts: [string, string][] = [
      ["GET", "/api/approvals"],
      ["POST", "/api/approvals"],
      ["GET", `/api/approvals/${id}`],
      ["POST", `/api/approvals/${id}/approve`],
      ["POST", `/api/approvals/${id}/reject`],
      ["POST", `/api/approvals/${id}/request-changes`],
      ["POST", `/api/approvals/${id}/recall`],
    ];
    for (const [method, path] of attempts) {
      const res = await app.request(path, { method });
      expect([method, path, res.status]).toEqual([method, path, 401]);
    }
  });

  test("the collection is mounted in the shared app builder", async () => {
    const res = await createTestApp().request("/api/approvals?view=nope");
    expect(res.status).not.toBe(404);
  });
});

describe.skipIf(!hasDb())("approval routes — with DB", () => {
  test("submit → inbox → approve, end to end, with the role matrix enforced at every step", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const c = await cast(db, app);

      // A viewer holds approvals.read but not approvals.create.
      expect(
        (await post(app, "/api/approvals", c.viewer.cookie, submission(c.manager.id))).status,
      ).toBe(403);

      // Validation runs before the service: a missing chain is a 422 with the field named.
      const invalid = await post(app, "/api/approvals", c.creator.cookie, {
        ...submission(c.manager.id),
        chain: [],
      });
      expect(invalid.status).toBe(422);
      expect((await json(invalid)).error?.code).toBe("VALIDATION_ERROR");

      const created = await post(app, "/api/approvals", c.creator.cookie, submission(c.manager.id));
      expect(created.status).toBe(201);
      const { approval } = (await json<{ approval: ApprovalJson }>(created)).data;
      expect(approval.status).toBe("pending");
      expect(approval.currentApproverId).toBe(c.manager.id);

      // The chain refuses the requester: 422 from the service, still not a 500.
      const selfie = await post(app, "/api/approvals", c.creator.cookie, {
        ...submission(c.creator.id),
      });
      expect(selfie.status).toBe(422);

      // Inbox: the manager sees it, the admin (not in the chain) does not, the creator's default
      // view (`mine`) has it.
      const inbox = await app.request("/api/approvals?view=inbox", {
        headers: { cookie: c.manager.cookie },
      });
      expect(inbox.status).toBe(200);
      const inboxBody = await json<{ approvals: ApprovalJson[] }>(inbox);
      expect(inboxBody.data.approvals.map((a) => a.id)).toEqual([approval.id]);
      expect(inboxBody.meta?.pagination).toEqual({ cursor: null, hasMore: false });

      const adminInbox = await json<{ approvals: ApprovalJson[] }>(
        await app.request("/api/approvals?view=inbox", { headers: { cookie: c.admin.cookie } }),
      );
      expect(adminInbox.data.approvals).toEqual([]);

      const mine = await json<{ approvals: ApprovalJson[] }>(
        await app.request("/api/approvals", { headers: { cookie: c.creator.cookie } }),
      );
      expect(mine.data.approvals.map((a) => a.id)).toEqual([approval.id]);

      // `all` is the deciders' view: the creator is refused, the admin gets the queue.
      expect(
        (await app.request("/api/approvals?view=all", { headers: { cookie: c.creator.cookie } }))
          .status,
      ).toBe(422);
      const all = await json<{ approvals: ApprovalJson[] }>(
        await app.request("/api/approvals?view=all", { headers: { cookie: c.admin.cookie } }),
      );
      expect(all.data.approvals.map((a) => a.id)).toEqual([approval.id]);

      // Detail: requester and approver see it; the viewer (not in the chain, cannot decide) reads
      // 404, as does anyone asking about a malformed or unknown id.
      for (const cookie of [c.creator.cookie, c.manager.cookie, c.admin.cookie]) {
        const res = await app.request(`/api/approvals/${approval.id}`, { headers: { cookie } });
        expect(res.status).toBe(200);
      }
      expect(
        (
          await app.request(`/api/approvals/${approval.id}`, {
            headers: { cookie: c.viewer.cookie },
          })
        ).status,
      ).toBe(404);
      expect(
        (await app.request("/api/approvals/not-an-id", { headers: { cookie: c.admin.cookie } }))
          .status,
      ).toBe(404);
      expect(
        (
          await app.request("/api/approvals/apr_000000000000000000000", {
            headers: { cookie: c.admin.cookie },
          })
        ).status,
      ).toBe(404);

      // Deciding: the creator lacks approvals.decide (403 at the gate); the admin holds it but is
      // not the current approver (403 from the row); a reject without a comment is 422; the
      // manager's approval closes the request.
      expect(
        (await post(app, `/api/approvals/${approval.id}/approve`, c.creator.cookie)).status,
      ).toBe(403);
      expect(
        (await post(app, `/api/approvals/${approval.id}/approve`, c.admin.cookie)).status,
      ).toBe(403);
      const noComment = await post(app, `/api/approvals/${approval.id}/reject`, c.manager.cookie);
      expect(noComment.status).toBe(422);

      const approved = await post(app, `/api/approvals/${approval.id}/approve`, c.manager.cookie, {
        comment: "Ship it",
        expectedVersion: approval.version,
      });
      expect(approved.status).toBe(200);
      const done = (await json<{ approval: ApprovalJson }>(approved)).data.approval;
      expect(done.status).toBe("approved");
      expect(done.version).toBe(approval.version + 1);
      expect(done.history.map((h) => h.action)).toEqual(["submitted", "approved"]);

      // A second decision is a 409 whose code the client can branch on.
      const again = await post(app, `/api/approvals/${approval.id}/approve`, c.manager.cookie);
      expect(again.status).toBe(409);
      expect((await json(again)).error?.code).toBe("APPROVAL_ALREADY_REVIEWED");

      // And so is a recall once an approval has landed.
      const late = await post(app, `/api/approvals/${approval.id}/recall`, c.creator.cookie);
      expect(late.status).toBe(409);
    });
  });

  test("reject, request-changes and recall over HTTP; a stale version is a 409", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const c = await cast(db, app);
      const make = async () =>
        (
          await json<{ approval: ApprovalJson }>(
            await post(app, "/api/approvals", c.creator.cookie, submission(c.manager.id)),
          )
        ).data.approval;

      const a = await make();
      const rejected = await post(app, `/api/approvals/${a.id}/reject`, c.manager.cookie, {
        comment: "Not this week",
      });
      expect(rejected.status).toBe(200);
      expect((await json<{ approval: ApprovalJson }>(rejected)).data.approval.status).toBe(
        "rejected",
      );

      const b = await make();
      const stale = await post(app, `/api/approvals/${b.id}/request-changes`, c.manager.cookie, {
        comment: "Trim it",
        expectedVersion: 99,
      });
      expect(stale.status).toBe(409);
      expect((await json(stale)).error?.code).toBe("APPROVAL_VERSION_CONFLICT");
      const changes = await post(app, `/api/approvals/${b.id}/request-changes`, c.manager.cookie, {
        comment: "Trim it",
      });
      expect((await json<{ approval: ApprovalJson }>(changes)).data.approval.status).toBe(
        "changes_requested",
      );

      const d = await make();
      // Recall sits behind approvals.create *and* the requester check: the manager holds create
      // but is not the requester.
      expect((await post(app, `/api/approvals/${d.id}/recall`, c.manager.cookie)).status).toBe(403);
      const recalled = await post(app, `/api/approvals/${d.id}/recall`, c.creator.cookie, {
        comment: "Typo",
      });
      expect(recalled.status).toBe(200);
      const body = (await json<{ approval: ApprovalJson }>(recalled)).data.approval;
      expect(body.status).toBe("recalled");
      expect(body.history.at(-1)).toMatchObject({ action: "recalled", comment: "Typo" });

      // The creator's list filters by status and pages on the widened cursor shape.
      const page = await json<{ approvals: ApprovalJson[] }>(
        await app.request("/api/approvals?view=mine&limit=2", {
          headers: { cookie: c.creator.cookie },
        }),
      );
      expect(page.data.approvals.map((x) => x.id)).toEqual([d.id, b.id]);
      expect(page.meta?.pagination?.hasMore).toBe(true);
      const next = await json<{ approvals: ApprovalJson[] }>(
        await app.request(
          `/api/approvals?view=mine&limit=2&cursor=${encodeURIComponent(page.meta?.pagination?.cursor ?? "")}`,
          { headers: { cookie: c.creator.cookie } },
        ),
      );
      expect(next.data.approvals.map((x) => x.id)).toEqual([a.id]);
      expect(next.meta?.pagination).toEqual({ cursor: null, hasMore: false });
      const onlyRejected = await json<{ approvals: ApprovalJson[] }>(
        await app.request("/api/approvals?view=mine&status=rejected", {
          headers: { cookie: c.creator.cookie },
        }),
      );
      expect(onlyRejected.data.approvals.map((x) => x.id)).toEqual([a.id]);
    });
  });

  test("the hourly job closes stale requests and audits the run as approvals.expired", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const c = await cast(db, app);
      const created = (
        await json<{ approval: ApprovalJson }>(
          await post(app, "/api/approvals", c.creator.cookie, submission(c.manager.id)),
        )
      ).data.approval;
      await db.execute(sql`
        UPDATE approval_requests
        SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
        WHERE id = ${created.id}
      `);

      const attempt: JobAttempt = {
        id: `apr-expire-${crypto.randomUUID().slice(0, 8)}`,
        attempt: 1,
      };
      const outcome = await runJobGuarded(
        approvalsExpireStaleJob,
        { db, audit: (params) => writeAuditLog(params) },
        attempt,
        null,
      );
      expect(outcome).toEqual({ expired: 1, failed: 0, errors: [], ids: [created.id] });

      const detail = await json<{ approval: ApprovalJson }>(
        await app.request(`/api/approvals/${created.id}`, {
          headers: { cookie: c.creator.cookie },
        }),
      );
      expect(detail.data.approval.status).toBe("expired");
      expect(detail.data.approval.history.at(-1)).toMatchObject({
        action: "expired",
        actorId: "system",
      });

      const row = (
        await db.execute<{
          action: string;
          severity: string;
          after_state: { expired: number };
        }>(sql`
          SELECT action, severity, after_state FROM unified_audit_log
          WHERE metadata->>'jobId' = ${attempt.id} LIMIT 1
        `)
      ).rows[0];
      expect(row).toMatchObject({ action: "approvals.expired", severity: "info" });
      expect(row?.after_state.expired).toBe(1);

      // The entity is free again: the same post can be resubmitted at its next version.
      const resubmit = await post(app, "/api/approvals", c.creator.cookie, {
        ...submission(c.manager.id),
        entityId: created.entityId,
        entityVersion: 2,
      });
      expect(resubmit.status).toBe(201);
    });
  });
});
