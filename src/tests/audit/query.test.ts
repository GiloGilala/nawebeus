/**
 * The audit read path against a live database (NWB-P1-002, F-19).
 *
 * Service-level rather than HTTP-level on purpose: the route adds validation and scope resolution,
 * both covered in `api.test.ts`, and everything here is about what the query actually returns for a
 * tenant. Written inside `withTestDb`'s transaction, so no audit row survives the file.
 *
 * One property of that harness is load-bearing rather than incidental: `now()` is the *transaction*
 * start time, so every row inserted here shares one `created_at` to the microsecond. That is exactly
 * the condition that breaks naive keyset pagination — a cursor on the timestamp alone either drops
 * every row tied with the boundary or repeats them — so the pagination test below is not simulating
 * the hazard, it is running inside it. The same collision happens for real in a bulk invitation, which
 * writes several audit rows in one transaction.
 */
import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { decodeCursor } from "../../lib/pagination";
import {
  type AuditEventFilters,
  getAuditEvent,
  listAuditEvents,
  writeAuditLog,
} from "../../services/audit";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/** Mirrors the route's pattern: audit ids are prefixed varchar, and so is the cursor tiebreaker. */
const AUDIT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

interface Fixture {
  readonly orgA: string;
  readonly orgB: string;
  readonly actorA: string;
  readonly otherActor: string;
  readonly targetUser: string;
}

/**
 * Four events in org A, one in org B, one org-less (what the queue runtime writes).
 *
 * Shaped so each filter has something to find *and* something to exclude: only one row is
 * `critical`, only one carries `target_user_id`, only one is `rate_limit`-typed.
 */
async function seed(db: any): Promise<Fixture> {
  const owner = await createTestUser(db);
  const stranger = await createTestUser(db);
  const subject = await createTestUser(db);
  const orgA = await createTestOrg(db, { ownerId: owner.id });
  const orgB = await createTestOrg(db, { ownerId: stranger.id });

  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgA.id,
    actorId: owner.id,
    actorType: "user",
    action: "organization.member.invited",
    resourceType: "member",
    resourceId: "member-1",
    targetUserId: subject.id,
    requestId: "req-shared",
    metadata: { invitedEmail: "a@example.com" },
  });
  await writeAuditLog({
    db,
    module: "security",
    organizationId: orgA.id,
    actorId: stranger.id,
    actorType: "user",
    action: "security.password_changed",
    resourceId: owner.id,
    severity: "warning",
    reason: "password changed by another actor",
    beforeState: { hash: "old" },
    afterState: { hash: "new" },
    requestId: "req-shared",
  });
  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgA.id,
    actorId: owner.id,
    actorType: "user",
    action: "apikeys.revoked",
    resourceId: "key-9",
    severity: "critical",
  });
  await writeAuditLog({
    db,
    module: "core",
    organizationId: orgB.id,
    actorId: stranger.id,
    actorType: "user",
    action: "account.deleted",
    resourceId: stranger.id,
  });
  // The nightly runtime's shape: no organization, because one run sweeps every tenant.
  await writeAuditLog({
    db,
    module: "core",
    actorType: "system",
    action: "rate-limits.reclaimed",
    metadata: { queue: "maintenance.rate-limit-reclaim", attempt: 1 },
  });

  return {
    orgA: orgA.id,
    orgB: orgB.id,
    actorA: owner.id,
    otherActor: stranger.id,
    targetUser: subject.id,
  };
}

describe.skipIf(!hasDb())("audit query service", () => {
  test("one tenant's list is that tenant's rows, newest first", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const { items } = await listAuditEvents(db, { organizationId: f.orgA });

      expect(items).toHaveLength(3);
      // org B's row and the org-less row are both absent — and absent for different reasons, which is
      // why the two cases are asserted in one place: equality on `organization_id` excludes one, and
      // NULL is not equal to anything, so the other needs `includeOrgless` to appear at all.
      expect(items.every((e) => e.organizationId === f.orgA)).toBe(true);
      expect(items.some((e) => e.action === "account.deleted")).toBe(false);
      expect(items.some((e) => e.action === "rate-limits.reclaimed")).toBe(false);
      expect(items.map((e) => e.action)).toContain("apikeys.revoked");
    });
  });

  test("list rows carry no state snapshots, no actor context, and no chain material", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const { items } = await listAuditEvents(db, { organizationId: f.orgA });
      const keys = Object.keys(items[0] ?? {}).sort();
      expect(keys).toEqual(
        [
          "action",
          "actorId",
          "actorType",
          "category",
          "createdAt",
          "hashChainValid",
          "id",
          "module",
          "organizationId",
          "reason",
          "requestId",
          "resourceId",
          "resourceType",
          "severity",
          "sessionId",
          "targetUserId",
        ].sort(),
      );
      // Explicitly, so the rule survives someone "helpfully" spreading the row: `checksum` is what a
      // verifier consumes; handing it out is what lets a chain be rebuilt instead of detected.
      expect(keys).not.toContain("checksum");
      expect(keys).not.toContain("beforeState");
      expect(keys).not.toContain("actorIp");
    });
  });

  test("each filter narrows to the rows that match it", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const scope = { organizationId: f.orgA } as const;
      const actions = async (filters: AuditEventFilters) =>
        (await listAuditEvents(db, scope, filters)).items.map((e) => e.action).sort();

      expect(await actions({ actorId: f.actorA })).toEqual([
        "apikeys.revoked",
        "organization.member.invited",
      ]);
      expect(await actions({ targetUserId: f.targetUser })).toEqual([
        "organization.member.invited",
      ]);
      expect(await actions({ severity: "critical" })).toEqual(["apikeys.revoked"]);
      expect(await actions({ module: "security" })).toEqual(["security.password_changed"]);
      expect(await actions({ category: "authorization" })).toEqual(["organization.member.invited"]);
      expect(await actions({ action: "apikeys.revoked" })).toEqual(["apikeys.revoked"]);
      expect(await actions({ resourceId: "key-9" })).toEqual(["apikeys.revoked"]);
      expect(await actions({ resourceType: "member", resourceId: "nope" })).toEqual([]);
      expect(await actions({ requestId: "req-shared" })).toEqual([
        "organization.member.invited",
        "security.password_changed",
      ]);
      // An action nobody in this org wrote: empty, not an error — a compliance search for a retired
      // spelling has to be answerable, which is why `action` is not typed to the registry here.
      expect(await actions({ action: "auth.signup.completed" })).toEqual([]);

      // `actorType` is what turns this column into an investigation: "three users changed passwords"
      // and "a key did" are different findings. And because the only system row in the fixture is the
      // org-less one, the pair below also proves the filter composes with the scope predicate instead
      // of overriding it — `system` finds nothing inside a tenant, and everything once the scope
      // admits cross-tenant rows.
      expect(await actions({ actorType: "user" })).toEqual([
        "apikeys.revoked",
        "organization.member.invited",
        "security.password_changed",
      ]);
      expect(await actions({ actorType: "system" })).toEqual([]);
      const orglessActions = async (filters: AuditEventFilters) =>
        (await listAuditEvents(db, { organizationId: f.orgA, includeOrgless: true }, filters)).items
          .map((e) => e.action)
          .sort();
      expect(await orglessActions({ actorType: "system" })).toEqual(["rate-limits.reclaimed"]);
    });
  });

  test("chainValid narrows to flagged or clean rows, and absent means unfiltered", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const scope = { organizationId: f.orgA } as const;
      // The verifier's own write shape: a flag-only UPDATE, allowed under the trigger on
      // migrate-built databases and trivially on push-built ones.
      await db.execute(
        sql`UPDATE unified_audit_log SET hash_chain_valid = false
            WHERE organization_id = ${f.orgA} AND action = 'security.password_changed'`,
      );
      const actions = async (filters: AuditEventFilters) =>
        (await listAuditEvents(db, scope, filters)).items.map((e) => e.action).sort();

      expect(await actions({ chainValid: false })).toEqual(["security.password_changed"]);
      expect(await actions({ chainValid: true })).toEqual([
        "apikeys.revoked",
        "organization.member.invited",
      ]);
      // Omitted: all three, in no narrowed order — the filter must not have a default.
      expect(await actions({})).toHaveLength(3);
    });
  });

  test("a date range the rows fall outside of is empty, and one that contains them is not", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const scope = { organizationId: f.orgA } as const;
      const now = new Date();
      expect(
        (await listAuditEvents(db, scope, { from: new Date(now.getTime() + 60_000) })).items,
      ).toHaveLength(0);
      expect(
        (await listAuditEvents(db, scope, { to: new Date(now.getTime() - 60_000) })).items,
      ).toHaveLength(0);
      const window = await listAuditEvents(db, scope, {
        from: new Date(now.getTime() - 60_000),
        to: new Date(now.getTime() + 60_000),
      });
      expect(window.items).toHaveLength(3);
    });
  });

  test("paging a tied timestamp neither repeats nor drops rows", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const scope = { organizationId: f.orgA } as const;

      const seen: string[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 10; guard++) {
        const page = await listAuditEvents(
          db,
          scope,
          {},
          {
            limit: 1,
            cursor: cursor ? decodeCursor(cursor, { idPattern: AUDIT_ID_PATTERN }) : null,
          },
        );
        seen.push(...page.items.map((e) => e.id));
        if (!page.pageInfo.hasMore || !page.pageInfo.cursor) break;
        cursor = page.pageInfo.cursor;
      }

      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
    });
  });

  test("`includeOrgless` is the only way to see a system event, and it is not a filter", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const withSystem = await listAuditEvents(db, {
        organizationId: f.orgA,
        includeOrgless: true,
      });
      expect(withSystem.items.some((e) => e.action === "rate-limits.reclaimed")).toBe(true);
      expect(withSystem.items).toHaveLength(4);
    });
  });

  test("detail returns the snapshots the list omits, and cross-tenant ids read as absent", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const scope = { organizationId: f.orgA } as const;
      const { items } = await listAuditEvents(db, scope, { action: "security.password_changed" });
      const id = items[0]?.id as string;

      const detail = await getAuditEvent(db, scope, id);
      expect(detail?.beforeState).toEqual({ hash: "old" });
      expect(detail?.afterState).toEqual({ hash: "new" });
      expect(detail?.reason).toBe("password changed by another actor");
      // `actorIp`/`actorUserAgent` are NULL here because nothing in a unit-level insert carries a
      // request context — their *presence* in the payload is the assertion, and the route test covers
      // the case where they are populated.
      expect("actorIp" in (detail ?? {})).toBe(true);

      const foreign = await listAuditEvents(db, { organizationId: f.orgB });
      const foreignId = foreign.items[0]?.id as string;
      expect(await getAuditEvent(db, scope, foreignId)).toBeNull();
      expect(await getAuditEvent(db, scope, "al_doesnotexist000000000")).toBeNull();
    });
  });

  test("a system event is readable by a tenant only through the platform path", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const systemRow = (
        await listAuditEvents(db, { organizationId: f.orgA, includeOrgless: true })
      ).items.find((e) => e.organizationId === null);
      expect(systemRow).toBeDefined();

      expect(
        await getAuditEvent(db, { organizationId: f.orgA }, systemRow?.id as string),
      ).toBeNull();
      expect(
        await getAuditEvent(
          db,
          { organizationId: f.orgA, includeOrgless: true },
          systemRow?.id as string,
        ),
      ).not.toBeNull();
    });
  });

  test("the cursor value keeps microsecond precision, which is what makes the tie safe", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const { items } = await listAuditEvents(db, { organizationId: f.orgA });
      // `US` (microseconds) survives into the response. Truncating to milliseconds — which is what
      // `Date.toISOString()` would have done — silently skips rows between the truncated and real
      // instants, the F-14 class, and every row in this transaction is at the same instant.
      expect(items[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]{11,}\+00$/);
    });
  });

  test("an audit row for another tenant is invisible even when the id is known exactly", async () => {
    await withTestDb(async ({ db }) => {
      const f = await seed(db);
      const other = await listAuditEvents(db, { organizationId: f.orgB });
      const id = other.items[0]?.id as string;
      const mine = await listAuditEvents(db, { organizationId: f.orgA, includeOrgless: true });
      expect(mine.items.map((e) => e.id)).not.toContain(id);

      // Belt and braces: prove the row really exists, so the empty result above is isolation and not
      // a fixture that silently wrote nothing.
      const raw = await db.execute(sql`SELECT id FROM unified_audit_log WHERE id = ${id}`);
      expect((raw as any).rows?.length).toBe(1);
    });
  });
});
