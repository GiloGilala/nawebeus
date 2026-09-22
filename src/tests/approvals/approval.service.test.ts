/**
 * The approval workflow's state machine (NWB-P1-003), driven through the service.
 *
 * What is pinned here is the contract the routes and P3's publish path build on: chain
 * resolution (named users and role tiers, no self-approval), the one-pending-per-entity rule,
 * sequential/parallel progression, the closing decisions, the recall window (AC7), optimistic
 * versioning, tenant isolation, visibility, and the expiry sweep the hourly job runs.
 *
 * Every test runs inside `withTestDb`'s rolled-back transaction, with migration 0004 replayed
 * first so a push-built database (CI) has the `expired` history action, the widened id columns
 * and the pending-per-entity partial index this ticket introduced.
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { ApprovalStateError, ForbiddenError, ValidationError } from "../../lib/errors";
import { decodeCursor } from "../../lib/pagination";
import {
  APPROVAL_DEFAULT_EXPIRY_DAYS,
  APPROVAL_ID_PATTERN,
  APPROVAL_SYSTEM_ACTOR,
  type ApprovalRequestDetail,
  approveRequest,
  expireStaleApprovals,
  getApprovalRequest,
  listApprovalRequests,
  recallRequest,
  rejectRequest,
  requestApproval,
  requestChanges,
} from "../../services/approvals";
import { ensureMigrationApplied, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const MIGRATION = "0004_approval_ids_expired_action_pending_unique.sql";

interface Workspace {
  orgId: string;
  owner: string;
  admin: string;
  manager: string;
  manager2: string;
  creator: string;
  viewer: string;
}

/** One organization with the whole role ladder, so tier expansion has something to expand to. */
async function workspace(db: Db): Promise<Workspace> {
  await ensureMigrationApplied(db, MIGRATION);
  const owner = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: owner.id });
  const ids = { orgId: org.id, owner: owner.id } as Workspace;
  await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
  for (const [key, roleCode] of [
    ["admin", "admin"],
    ["manager", "manager"],
    ["manager2", "manager"],
    ["creator", "creator"],
    ["viewer", "viewer"],
  ] as const) {
    const user = await createTestUser(db);
    await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode });
    ids[key] = user.id;
  }
  return ids;
}

let entitySeq = 0;
function entity(prefix = "post"): { entityType: "post"; entityId: string } {
  entitySeq += 1;
  return { entityType: "post", entityId: `${prefix}-${Date.now()}-${entitySeq}` };
}

function submit(
  db: Db,
  ws: Workspace,
  chain: { order: number; userId?: string | null; role: "manager" | "admin" | "owner" }[],
  overrides: Partial<Parameters<typeof requestApproval>[1]> = {},
): Promise<ApprovalRequestDetail> {
  return requestApproval(db, {
    organizationId: ws.orgId,
    requesterId: ws.creator,
    ...entity(),
    entityVersion: 1,
    contentSnapshot: { title: "Hello", body: "World" },
    chain,
    ...overrides,
  });
}

async function auditActions(db: Db, resourceId: string): Promise<string[]> {
  const result = await db.execute<{ action: string }>(sql`
    SELECT action FROM unified_audit_log WHERE resource_id = ${resourceId} ORDER BY created_at, id
  `);
  return ((result as { rows?: { action: string }[] }).rows ?? []).map((row) => row.action);
}

/** The `field`s of a 422's details, in order — `details` is optional on the class, never here. */
function fields(error: ValidationError): string[] {
  return (error.details ?? []).map((d) => d.field);
}

async function expectState<T extends Error>(
  promise: Promise<unknown>,
  cls: new (...args: never[]) => T,
  match?: Partial<Record<keyof T, unknown>>,
): Promise<T> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(cls);
    if (match) expect(error).toMatchObject(match);
    return error as T;
  }
  throw new Error(`expected ${cls.name} to be thrown`);
}

describe.skipIf(!hasDb())("approval service — request", () => {
  test("a named manager step is stored user-resolved, with history, audit row and default expiry", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const before = Date.now();
      const created = await submit(db, ws, [{ order: 1, userId: ws.manager, role: "manager" }]);

      expect(created.id).toMatch(APPROVAL_ID_PATTERN);
      expect(created.status).toBe("pending");
      expect(created.currentStep).toBe(1);
      expect(created.currentApproverId).toBe(ws.manager);
      expect(created.version).toBe(1);
      expect(created.chain).toEqual([
        {
          order: 1,
          userId: ws.manager,
          role: "manager",
          isParallel: false,
          resolvedFromRole: false,
        },
      ]);
      expect(created.contentSnapshot).toEqual({ title: "Hello", body: "World" });
      expect(created.history.map((h) => h.action)).toEqual(["submitted"]);
      expect(created.history[0]?.actorId).toBe(ws.creator);

      // Default window: 7 days from now, give or take the test's own runtime.
      const expiresAt = new Date(created.expiresAt as string).getTime();
      const expected = before + APPROVAL_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiresAt - expected)).toBeLessThan(60_000);

      expect(await auditActions(db, created.id)).toEqual(["approvals.requested"]);
    });
  });

  test("a role step expands to every eligible member at or above the tier, minus the requester, as a parallel group", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      // Order numbers are normalised: 5 and 20 become steps 1 and 2.
      const created = await submit(db, ws, [
        { order: 20, userId: ws.owner, role: "owner" },
        { order: 5, role: "manager" },
      ]);

      const step1 = created.chain.filter((s) => s.order === 1);
      const step2 = created.chain.filter((s) => s.order === 2);
      expect(new Set(step1.map((s) => s.userId))).toEqual(
        new Set([ws.owner, ws.admin, ws.manager, ws.manager2]),
      );
      expect(step1.every((s) => s.isParallel && s.resolvedFromRole)).toBe(true);
      expect(step1.map((s) => s.userId)).not.toContain(ws.creator);
      expect(step2).toEqual([
        { order: 2, userId: ws.owner, role: "owner", isParallel: false, resolvedFromRole: false },
      ]);
      // The column names the group's first member; the inbox predicate consults the whole group.
      expect(step1.map((s) => s.userId)).toContain(created.currentApproverId as string);

      // Walk it: any tier member clears step 1, the named owner closes step 2.
      const midway = await approveRequest(db, {
        id: created.id,
        organizationId: ws.orgId,
        actorId: ws.admin,
      });
      expect([midway.status, midway.currentStep, midway.currentApproverId]).toEqual([
        "pending",
        2,
        ws.owner,
      ]);
      const done = await approveRequest(db, {
        id: created.id,
        organizationId: ws.orgId,
        actorId: ws.owner,
      });
      expect(done.status).toBe("approved");
      expect(done.history.map((h) => h.action)).toEqual(["submitted", "approved", "approved"]);
    });
  });

  test("a creator submitting as the only manager-tier candidate gets a 422 naming the step", async () => {
    await withTestDb(async ({ db }) => {
      await ensureMigrationApplied(db, MIGRATION);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const lonely = await requestApproval(db, {
        organizationId: org.id,
        requesterId: owner.id,
        ...entity(),
        entityVersion: 1,
        contentSnapshot: { a: 1 },
        chain: [{ order: 1, role: "manager" }],
      }).catch((error: unknown) => error);
      expect(lonely).toBeInstanceOf(ValidationError);
      expect((lonely as ValidationError).details).toEqual([
        { field: "chain[0].role", message: expect.stringContaining("no active member") },
      ]);
    });
  });

  test("self-approval, non-members, under-tier members and inactive members are all 422s", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const outsider = await createTestUser(db);
      const suspended = await createTestUser(db, { status: "suspended" });
      await addMemberWithRole(db, {
        organizationId: ws.orgId,
        userId: suspended.id,
        roleCode: "admin",
      });

      const error = await expectState(
        submit(db, ws, [
          { order: 1, userId: ws.creator, role: "manager" },
          { order: 1, userId: outsider.id, role: "manager" },
          { order: 1, userId: ws.manager, role: "admin" },
          { order: 1, userId: suspended.id, role: "admin" },
        ]),
        ValidationError,
      );
      expect(fields(error)).toEqual([
        "chain[0].userId",
        "chain[1].userId",
        "chain[2].userId",
        "chain[3].userId",
      ]);
      expect(error.details?.[0]?.message).toContain("cannot approve their own");
      expect(error.details?.[2]?.message).toContain("'admin'");
    });
  });

  test("the snapshot, entity fields and expiry window are validated before anything is written", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const chain = [{ order: 1, userId: ws.manager, role: "manager" as const }];

      const empty = await expectState(
        submit(db, ws, chain, { contentSnapshot: {} }),
        ValidationError,
      );
      expect(fields(empty)).toEqual(["contentSnapshot"]);

      const bad = await expectState(
        submit(db, ws, chain, {
          entityType: "video" as never,
          entityId: "has spaces",
          entityVersion: 0,
        }),
        ValidationError,
      );
      expect(fields(bad)).toEqual(["entityType", "entityId", "entityVersion"]);

      const tooSoon = await expectState(
        submit(db, ws, chain, { expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }),
        ValidationError,
      );
      expect(fields(tooSoon)).toEqual(["expiresAt"]);
      const tooLate = await expectState(
        submit(db, ws, chain, {
          expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60_000).toISOString(),
        }),
        ValidationError,
      );
      expect(fields(tooLate)).toEqual(["expiresAt"]);
      const garbage = await expectState(
        submit(db, ws, chain, { expiresAt: "not-a-date" }),
        ValidationError,
      );
      expect(fields(garbage)).toEqual(["expiresAt"]);

      // Explicit null means "never".
      const forever = await submit(db, ws, chain, { expiresAt: null });
      expect(forever.expiresAt).toBeNull();
    });
  });

  test("one pending request per entity: a second is 409 until the first closes", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const target = entity();
      const chain = [{ order: 1, userId: ws.manager, role: "manager" as const }];
      const first = await submit(db, ws, chain, target);

      await expectState(submit(db, ws, chain, target), ApprovalStateError, {
        code: "APPROVAL_ALREADY_PENDING",
        statusCode: 409,
      });

      await rejectRequest(db, {
        id: first.id,
        organizationId: ws.orgId,
        actorId: ws.manager,
        comment: "Needs a rewrite",
      });
      const second = await submit(db, ws, chain, { ...target, entityVersion: 2 });
      expect(second.id).not.toBe(first.id);
      expect(second.status).toBe("pending");
    });
  });
});

describe.skipIf(!hasDb())("approval service — decisions", () => {
  test("a sequential chain advances one step per approval and closes as approved at the end", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const created = await submit(db, ws, [
        { order: 1, userId: ws.manager, role: "manager" },
        { order: 2, userId: ws.admin, role: "admin" },
      ]);

      // The admin is in the chain but it is not their turn yet.
      await expectState(
        approveRequest(db, { id: created.id, organizationId: ws.orgId, actorId: ws.admin }),
        ForbiddenError,
      );

      const midway = await approveRequest(db, {
        id: created.id,
        organizationId: ws.orgId,
        actorId: ws.manager,
        comment: "LGTM",
        expectedVersion: 1,
      });
      expect(midway.status).toBe("pending");
      expect(midway.currentStep).toBe(2);
      expect(midway.currentApproverId).toBe(ws.admin);
      expect(midway.version).toBe(2);
      expect(midway.completedAt).toBeNull();

      const done = await approveRequest(db, {
        id: created.id,
        organizationId: ws.orgId,
        actorId: ws.admin,
      });
      expect(done.status).toBe("approved");
      expect(done.currentApproverId).toBeNull();
      expect(done.completedAt).not.toBeNull();
      expect(done.version).toBe(3);
      expect(done.history.map((h) => [h.action, h.actorId])).toEqual([
        ["submitted", ws.creator],
        ["approved", ws.manager],
        ["approved", ws.admin],
      ]);
      expect(done.history[1]?.comment).toBe("LGTM");
      expect(await auditActions(db, created.id)).toEqual([
        "approvals.requested",
        "approvals.approved",
        "approvals.approved",
      ]);

      // Nothing is left to decide.
      await expectState(
        approveRequest(db, { id: created.id, organizationId: ws.orgId, actorId: ws.admin }),
        ApprovalStateError,
        { code: "APPROVAL_ALREADY_REVIEWED" },
      );
    });
  });

  test("in a parallel group any one member's approval moves the request on", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const created = await submit(db, ws, [
        { order: 1, userId: ws.manager, role: "manager" },
        { order: 1, userId: ws.manager2, role: "manager" },
      ]);
      expect(created.chain.every((s) => s.isParallel)).toBe(true);

      const done = await approveRequest(db, {
        id: created.id,
        organizationId: ws.orgId,
        actorId: ws.manager2,
      });
      expect(done.status).toBe("approved");
      // The other member finds nothing to do — 409, not a second approval.
      await expectState(
        approveRequest(db, { id: created.id, organizationId: ws.orgId, actorId: ws.manager }),
        ApprovalStateError,
        { code: "APPROVAL_ALREADY_REVIEWED" },
      );
    });
  });

  test("a stale expectedVersion is a 409 with both versions, and nothing changes", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const created = await submit(db, ws, [{ order: 1, userId: ws.manager, role: "manager" }]);
      const conflict = await expectState(
        approveRequest(db, {
          id: created.id,
          organizationId: ws.orgId,
          actorId: ws.manager,
          expectedVersion: 7,
        }),
        ApprovalStateError,
        { code: "APPROVAL_VERSION_CONFLICT" },
      );
      expect(conflict.details).toEqual({ version: 1, expectedVersion: 7 });
      const after = await getApprovalRequest(db, ws.orgId, created.id);
      expect(after?.status).toBe("pending");
      expect(after?.version).toBe(1);
    });
  });

  test("reject and request-changes close the request and require a comment", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const chain = [{ order: 1, userId: ws.manager, role: "manager" as const }];

      const a = await submit(db, ws, chain);
      const missing = await expectState(
        rejectRequest(db, { id: a.id, organizationId: ws.orgId, actorId: ws.manager }),
        ValidationError,
      );
      expect(fields(missing)).toEqual(["comment"]);
      const rejected = await rejectRequest(db, {
        id: a.id,
        organizationId: ws.orgId,
        actorId: ws.manager,
        comment: "Off-brand",
      });
      expect(rejected.status).toBe("rejected");
      expect(rejected.currentApproverId).toBeNull();
      expect(rejected.completedAt).not.toBeNull();
      expect(rejected.history.at(-1)).toMatchObject({ action: "rejected", comment: "Off-brand" });

      const b = await submit(db, ws, chain);
      await expectState(
        requestChanges(db, {
          id: b.id,
          organizationId: ws.orgId,
          actorId: ws.manager,
          comment: "  ",
        }),
        ValidationError,
      );
      const changes = await requestChanges(db, {
        id: b.id,
        organizationId: ws.orgId,
        actorId: ws.manager,
        comment: "Shorten the headline",
      });
      expect(changes.status).toBe("changes_requested");
      expect(changes.currentApproverId).toBeNull();
      expect(changes.completedAt).not.toBeNull();
      expect(await auditActions(db, b.id)).toEqual([
        "approvals.requested",
        "approvals.changes_requested",
      ]);

      // The requester cannot reopen it; they submit again.
      await expectState(
        approveRequest(db, { id: b.id, organizationId: ws.orgId, actorId: ws.manager }),
        ApprovalStateError,
        { code: "APPROVAL_ALREADY_REVIEWED" },
      );
    });
  });

  test("the requester can recall until the first approval lands (AC7); nobody else can", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const chain = [
        { order: 1, userId: ws.manager, role: "manager" as const },
        { order: 2, userId: ws.admin, role: "admin" as const },
      ];

      const a = await submit(db, ws, chain);
      await expectState(
        recallRequest(db, { id: a.id, organizationId: ws.orgId, actorId: ws.manager }),
        ForbiddenError,
      );
      const recalled = await recallRequest(db, {
        id: a.id,
        organizationId: ws.orgId,
        actorId: ws.creator,
        comment: "Found a typo",
      });
      expect(recalled.status).toBe("recalled");
      expect(recalled.history.at(-1)).toMatchObject({
        action: "recalled",
        actorId: ws.creator,
        comment: "Found a typo",
      });
      expect(await auditActions(db, a.id)).toEqual(["approvals.requested", "approvals.recalled"]);

      const b = await submit(db, ws, chain);
      await approveRequest(db, { id: b.id, organizationId: ws.orgId, actorId: ws.manager });
      await expectState(
        recallRequest(db, { id: b.id, organizationId: ws.orgId, actorId: ws.creator }),
        ApprovalStateError,
        { code: "APPROVAL_RECALL_WINDOW_CLOSED" },
      );
    });
  });

  test("another tenant's request is a 404 for every verb, even with the right id", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const other = await workspace(db);
      const created = await submit(db, ws, [{ order: 1, userId: ws.manager, role: "manager" }]);

      const foreign = { id: created.id, organizationId: other.orgId, actorId: other.manager };
      for (const verb of [approveRequest, recallRequest]) {
        const error = await verb(db, foreign).catch((e: unknown) => e);
        expect((error as { statusCode?: number }).statusCode).toBe(404);
      }
      for (const verb of [rejectRequest, requestChanges]) {
        const error = await verb(db, { ...foreign, comment: "x" }).catch((e: unknown) => e);
        expect((error as { statusCode?: number }).statusCode).toBe(404);
      }
      expect(await getApprovalRequest(db, other.orgId, created.id)).toBeUndefined();
    });
  });
});

describe.skipIf(!hasDb())("approval service — reads", () => {
  test("detail visibility: requester, chain members and deciders see it; anyone else reads 404", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const created = await submit(db, ws, [{ order: 1, userId: ws.manager, role: "manager" }]);
      const see = (userId: string, canDecide = false) =>
        getApprovalRequest(db, ws.orgId, created.id, { userId, canDecide });

      expect((await see(ws.creator))?.id).toBe(created.id);
      expect((await see(ws.manager))?.id).toBe(created.id);
      expect(await see(ws.viewer)).toBeUndefined();
      expect((await see(ws.admin, true))?.id).toBe(created.id);
    });
  });

  test("inbox is 'pending and my turn', mine is what I submitted, all is the organization's queue", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const sequential = await submit(db, ws, [
        { order: 1, userId: ws.manager, role: "manager" },
        { order: 2, userId: ws.admin, role: "admin" },
      ]);
      const parallel = await submit(db, ws, [{ order: 1, role: "manager" }]);
      const closed = await submit(db, ws, [{ order: 1, userId: ws.manager2, role: "manager" }]);
      await rejectRequest(db, {
        id: closed.id,
        organizationId: ws.orgId,
        actorId: ws.manager2,
        comment: "no",
      });
      // Another requester in the same org, so `mine` has something to exclude.
      const other = await requestApproval(db, {
        organizationId: ws.orgId,
        requesterId: ws.admin,
        ...entity(),
        entityVersion: 1,
        contentSnapshot: { a: 1 },
        chain: [{ order: 1, userId: ws.owner, role: "owner" }],
      });

      const list = (userId: string, view: "inbox" | "mine" | "all", extra = {}) =>
        listApprovalRequests(db, { organizationId: ws.orgId, userId }, { view, ...extra });
      const ids = (page: Awaited<ReturnType<typeof list>>) => new Set(page.items.map((i) => i.id));

      // The manager is named at step 1 of `sequential` and in the tier group of `parallel`.
      expect(ids(await list(ws.manager, "inbox"))).toEqual(new Set([sequential.id, parallel.id]));
      // The admin is on step 2 of `sequential` (not yet their turn) and in `parallel`'s group.
      expect(ids(await list(ws.admin, "inbox"))).toEqual(new Set([parallel.id]));
      // manager2's only named request is closed; the tier group still routes to them.
      expect(ids(await list(ws.manager2, "inbox"))).toEqual(new Set([parallel.id]));
      expect(ids(await list(ws.viewer, "inbox"))).toEqual(new Set());

      expect(ids(await list(ws.creator, "mine"))).toEqual(
        new Set([sequential.id, parallel.id, closed.id]),
      );
      expect(ids(await list(ws.creator, "mine", { status: "rejected" }))).toEqual(
        new Set([closed.id]),
      );
      expect(ids(await list(ws.admin, "mine"))).toEqual(new Set([other.id]));

      const all = await list(ws.viewer, "all");
      expect(ids(all)).toEqual(new Set([sequential.id, parallel.id, closed.id, other.id]));
      // Newest first.
      expect(all.items.map((i) => i.id)).toEqual([other.id, closed.id, parallel.id, sequential.id]);
      expect(
        ids(await list(ws.viewer, "all", { entityType: "post", entityId: closed.entityId })),
      ).toEqual(new Set([closed.id]));

      // Keyset paging on (created_at, id): a page of one, then the rest through the cursor.
      expect((await list(ws.creator, "mine")).items).toHaveLength(3);
      const p1 = await listApprovalRequests(
        db,
        { organizationId: ws.orgId, userId: ws.creator },
        { view: "mine" },
        { limit: 1, cursor: null },
      );
      expect(p1.items.map((i) => i.id)).toEqual([closed.id]);
      expect(p1.pageInfo.hasMore).toBe(true);
      const cursor = decodeCursor(p1.pageInfo.cursor as string, { idPattern: APPROVAL_ID_PATTERN });
      expect(cursor).not.toBeNull();
      const p2 = await listApprovalRequests(
        db,
        { organizationId: ws.orgId, userId: ws.creator },
        { view: "mine" },
        { limit: 2, cursor },
      );
      expect(p2.items.map((i) => i.id)).toEqual([parallel.id, sequential.id]);
      expect(p2.pageInfo.hasMore).toBe(false);
      expect(p2.pageInfo.cursor).toBeNull();
    });
  });
});

describe.skipIf(!hasDb())("approval service — expiry", () => {
  test("pending requests past their window close as expired with a system history row; others are untouched", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const chain = [{ order: 1, userId: ws.manager, role: "manager" as const }];
      const stale = await submit(db, ws, chain);
      const fresh = await submit(db, ws, chain);
      const forever = await submit(db, ws, chain, { expiresAt: null });
      const decided = await submit(db, ws, chain);
      await approveRequest(db, { id: decided.id, organizationId: ws.orgId, actorId: ws.manager });
      // Backdate two of them: the service refuses to *create* an already-expired request (and the
      // table's CHECK insists `expires_at > created_at`), so both clocks are moved underneath the
      // rows the way real time would have.
      await db.execute(sql`
        UPDATE approval_requests
        SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
        WHERE id IN (${stale.id}, ${decided.id})
      `);

      const first = await expireStaleApprovals(db);
      expect(first).toEqual({ expired: 1, failed: 0, errors: [], ids: [stale.id] });

      const after = (await getApprovalRequest(db, ws.orgId, stale.id)) as ApprovalRequestDetail;
      expect(after.status).toBe("expired");
      expect(after.currentApproverId).toBeNull();
      expect(after.completedAt).not.toBeNull();
      expect(after.version).toBe(2);
      expect(after.history.at(-1)).toMatchObject({
        action: "expired",
        actorId: APPROVAL_SYSTEM_ACTOR,
      });
      expect((await getApprovalRequest(db, ws.orgId, fresh.id))?.status).toBe("pending");
      expect((await getApprovalRequest(db, ws.orgId, forever.id))?.status).toBe("pending");
      expect((await getApprovalRequest(db, ws.orgId, decided.id))?.status).toBe("approved");

      // Once closed, the entity is free for a resubmit and a decision on it is 409.
      await expectState(
        approveRequest(db, { id: stale.id, organizationId: ws.orgId, actorId: ws.manager }),
        ApprovalStateError,
        { code: "APPROVAL_ALREADY_REVIEWED" },
      );
      const again = await submit(db, ws, chain, {
        entityType: stale.entityType,
        entityId: stale.entityId,
        entityVersion: 2,
      });
      expect(again.status).toBe("pending");

      // Idempotent: the second sweep finds nothing.
      expect(await expireStaleApprovals(db)).toEqual({
        expired: 0,
        failed: 0,
        errors: [],
        ids: [],
      });
    });
  });

  test("the sweep honours its batch limit and reports how far it got", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await workspace(db);
      const chain = [{ order: 1, userId: ws.manager, role: "manager" as const }];
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) ids.push((await submit(db, ws, chain)).id);
      await db.execute(sql`
        UPDATE approval_requests
        SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
        WHERE id IN (${ids[0]}, ${ids[1]}, ${ids[2]})
      `);
      const partial = await expireStaleApprovals(db, { limit: 2 });
      expect(partial.expired).toBe(2);
      expect(partial.ids).toHaveLength(2);
      const rest = await expireStaleApprovals(db, { limit: 2 });
      expect(rest.expired).toBe(1);
    });
  });
});
