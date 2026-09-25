/**
 * Impersonation service tests (NWB-P1-011).
 *
 * DB-gated: every meaningful rule here is a database rule (row state, audit
 * rows, the CHECK constraints that backstop the audit retagging). Runs inside
 * `withTestDb`'s transaction like every other integration suite.
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig } from "../../lib/config";
import {
  ConflictError,
  ForbiddenError,
  ImpersonationActiveError,
  MfaRequiredError,
  NotFoundError,
  SelfImpersonationError,
} from "../../lib/errors";
import { runWithImpersonationContext } from "../../lib/impersonation-context";
import { writeAuditLog } from "../../services/audit";
import { generateTOTOSecret, getCurrentTOTP } from "../../services/auth/totp";
import {
  endImpersonation,
  expireLapsedImpersonations,
  listImpersonations,
  mintImpersonationToken,
  resolveLiveImpersonation,
  startImpersonation,
} from "../../services/impersonation";
import { type TestDbContext, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/** Enables MFA on a user row directly — the service reads `two_factor_enabled`. */
async function enableMfa(db: TestDbContext["db"], userId: string): Promise<string> {
  const secret = generateTOTOSecret();
  await db.execute(
    sql`UPDATE users SET two_factor_enabled = true, two_factor_secret = ${secret} WHERE id = ${userId}`,
  );
  return secret;
}

interface World {
  db: TestDbContext["db"];
  orgId: string;
  adminId: string;
  adminMfaSecret: string;
  targetId: string;
  plainAdminId: string;
  accessSecret: string;
}

/**
 * One organization: `adminId` (owner, MFA enrolled) may impersonate;
 * `plainAdminId` (owner of the *same* org — two owners are legal) has no MFA;
 * `targetId` (creator role) is the support target.
 */
async function makeWorld(db: TestDbContext["db"]): Promise<World> {
  const admin = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: admin.id });
  await addMemberWithRole(db, { organizationId: org.id, userId: admin.id, roleCode: "owner" });

  const plainAdmin = await createTestUser(db);
  await addMemberWithRole(db, {
    organizationId: org.id,
    userId: plainAdmin.id,
    roleCode: "owner",
  });

  const target = await createTestUser(db);
  await addMemberWithRole(db, {
    organizationId: org.id,
    userId: target.id,
    roleCode: "creator",
  });

  const adminMfaSecret = await enableMfa(db, admin.id);

  return {
    db,
    orgId: org.id,
    adminId: admin.id,
    adminMfaSecret,
    targetId: target.id,
    plainAdminId: plainAdmin.id,
    accessSecret: getConfig().JWT_ACCESS_SECRET,
  };
}

async function startInput(
  world: World,
  overrides: Partial<Parameters<typeof startImpersonation>[1]> = {},
): Promise<Parameters<typeof startImpersonation>[1]> {
  return {
    organizationId: world.orgId,
    adminUserId: world.adminId,
    targetUserId: world.targetId,
    reason: "Customer cannot see their scheduled posts",
    mfaCode: await getCurrentTOTP(world.adminMfaSecret),
    accessSecret: world.accessSecret,
    ...overrides,
  };
}

async function auditRows(db: TestDbContext["db"], action: string) {
  return (
    (await db.execute(
      sql`SELECT * FROM unified_audit_log WHERE action = ${action} ORDER BY created_at ASC`,
    )) as any
  ).rows as any[];
}

describe.skipIf(!hasDb())("Impersonation service (NWB-P1-011)", () => {
  test("start creates the row, the token, and the audit evidence; target is notified", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      // The email transport resolves to the console printer in tests — a real send, so
      // `security_notified` flips true below without any provider.

      const result = await startImpersonation(
        world.db,
        await startInput(world, { ip: "10.1.2.3" }),
      );

      expect(result.reentered).toBe(false);
      expect(result.session.id).toMatch(/^imp_[0-9a-f-]{36}$/);
      expect(result.session.mfaVerified).toBe(true);
      expect(result.session.securityNotified).toBe(true);
      // Default window: 60 minutes.
      const windowMinutes =
        (result.session.expiresAt.getTime() - result.session.startedAt.getTime()) / 60000;
      expect(windowMinutes).toBeCloseTo(60, 1);
      // Token TTL is the access-token cap, not the window.
      const ttl = (new Date(result.tokenExpiresAt).getTime() - Date.now()) / 1000;
      expect(ttl).toBeGreaterThan(800);
      expect(ttl).toBeLessThanOrEqual(900);

      const started = await auditRows(world.db, "admin.impersonation.started");
      expect(started).toHaveLength(1);
      expect(started[0].module).toBe("admin");
      expect(started[0].actor_id).toBe(world.adminId);
      expect(started[0].actor_type).toBe("admin");
      expect(started[0].target_user_id).toBe(world.targetId);
      expect(started[0].severity).toBe("warning");
      expect(started[0].after_state.reason).toBe("Customer cannot see their scheduled posts");
      expect(started[0].after_state.mfaVerified).toBe(true);

      // The step-up left its own evidence.
      const mfaVerified = await auditRows(world.db, "auth.mfa.verified");
      expect(mfaVerified.length).toBeGreaterThanOrEqual(1);
    });
  });

  test("self-impersonation is refused with SELF_IMPERSONATION_DENIED", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      await expect(
        startImpersonation(world.db, await startInput(world, { targetUserId: world.adminId })),
      ).rejects.toBeInstanceOf(SelfImpersonationError);
    });
  });

  test("unknown, deleted, out-of-org, and non-signin-able targets are all a flat 404", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);

      // Not a member of this org.
      const outsider = await createTestUser(ctx.db);
      await expect(
        startImpersonation(world.db, await startInput(world, { targetUserId: outsider.id })),
      ).rejects.toBeInstanceOf(NotFoundError);

      // Soft-deleted member.
      await ctx.db.execute(sql`UPDATE users SET deleted_at = now() WHERE id = ${world.targetId}`);
      await expect(startImpersonation(world.db, await startInput(world))).rejects.toBeInstanceOf(
        NotFoundError,
      );

      // Suspended member (before the delete above? order matters — restore first).
      await ctx.db.execute(
        sql`UPDATE users SET deleted_at = NULL, status = 'suspended' WHERE id = ${world.targetId}`,
      );
      await expect(startImpersonation(world.db, await startInput(world))).rejects.toThrow(
        /suspended/i,
      );
    });
  });

  test("MFA is a hard gate: not enrolled → MFA_REQUIRED; enrolled without a code → MFA_REQUIRED", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);

      // An admin who never enrolled cannot bypass the control by omission.
      await expect(
        startImpersonation(
          world.db,
          await startInput(world, { adminUserId: world.plainAdminId, mfaCode: undefined }),
        ),
      ).rejects.toBeInstanceOf(MfaRequiredError);

      // Enrolled but present without a code.
      await expect(
        startImpersonation(world.db, await startInput(world, { mfaCode: undefined })),
      ).rejects.toBeInstanceOf(MfaRequiredError);

      // Enrolled with a wrong code.
      await expect(
        startImpersonation(world.db, await startInput(world, { mfaCode: "000000" })),
      ).rejects.toThrow(/Invalid MFA code/);

      // Sanity: nothing was created by the three failures.
      const started = await auditRows(world.db, "admin.impersonation.started");
      expect(started).toHaveLength(0);
    });
  });

  test("durations clamp to the 5..240 band; the token never outlives 900s", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      const code = await getCurrentTOTP(world.adminMfaSecret);

      const huge = await startImpersonation(
        world.db,
        await startInput(world, { durationMinutes: 10_000, mfaCode: code }),
      );
      expect(
        (huge.session.expiresAt.getTime() - huge.session.startedAt.getTime()) / 60000,
      ).toBeCloseTo(240, 1);

      // Same admin + target would re-enter the 240-minute session, so close it first —
      // which is the re-entry rule doing its job, not a clamp failure.
      await endImpersonation(world.db, {
        sessionId: huge.session.id,
        organizationId: world.orgId,
        actorUserId: world.adminId,
      });

      const tiny = await startImpersonation(
        world.db,
        await startInput(world, { durationMinutes: 1, mfaCode: code }),
      );
      expect(
        (tiny.session.expiresAt.getTime() - tiny.session.startedAt.getTime()) / 60000,
      ).toBeCloseTo(5, 1);
    });
  });

  test("one impersonator per target: a second admin gets 409, the same admin re-enters", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      const first = await startImpersonation(world.db, await startInput(world));

      // Same admin: re-entry, same row, audited.
      const again = await startImpersonation(world.db, await startInput(world));
      expect(again.reentered).toBe(true);
      expect(again.session.id).toBe(first.session.id);
      expect((await auditRows(world.db, "admin.impersonation.reentered")).length).toBe(1);

      // A different admin (with their own MFA): 409 naming the blocking session.
      const secondSecret = await enableMfa(world.db, world.plainAdminId);
      await expect(
        startImpersonation(
          world.db,
          await startInput(world, {
            adminUserId: world.plainAdminId,
            mfaCode: await getCurrentTOTP(secondSecret),
          }),
        ),
      ).rejects.toThrow(ImpersonationActiveError);
    });
  });

  test("end: own session → manual_end, another admin's → security_terminated, twice → 409", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      const started = await startImpersonation(world.db, await startInput(world));

      // Another impersonate-holder terminates it.
      const secondSecret = await enableMfa(world.db, world.plainAdminId);
      void secondSecret;
      const terminated = await endImpersonation(world.db, {
        sessionId: started.session.id,
        organizationId: world.orgId,
        actorUserId: world.plainAdminId,
      });
      expect(terminated.endReason).toBe("security_terminated");
      const terminatedRows = await auditRows(world.db, "admin.impersonation.terminated");
      expect(terminatedRows).toHaveLength(1);
      expect(terminatedRows[0].actor_id).toBe(world.plainAdminId);
      expect(terminatedRows[0].target_user_id).toBe(world.targetId);

      // Double end is a 409, not a rewrite.
      await expect(
        endImpersonation(world.db, {
          sessionId: started.session.id,
          organizationId: world.orgId,
          actorUserId: world.plainAdminId,
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      // A fresh session ended by its own admin is a manual end.
      const second = await startImpersonation(world.db, await startInput(world));
      const manual = await endImpersonation(world.db, {
        sessionId: second.session.id,
        organizationId: world.orgId,
        actorUserId: world.adminId,
      });
      expect(manual.endReason).toBe("manual_end");
      expect(await auditRows(world.db, "admin.impersonation.ended")).toHaveLength(1);
    });
  });

  test("resolveLiveImpersonation: live inside the window; undefined after end; undefined when any token binding disagrees", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      const started = await startImpersonation(
        world.db,
        await startInput(world, { ip: "10.9.9.9" }),
      );
      const token = {
        userId: started.session.targetUserId,
        orgId: started.session.organizationId,
        impersonationSessionId: started.session.id,
        impersonatorId: started.session.adminUserId,
      };
      expect(await resolveLiveImpersonation(world.db, token)).toBeDefined();

      // A token that claims another target/admin/org never validates.
      expect(
        await resolveLiveImpersonation(world.db, { ...token, userId: world.adminId }),
      ).toBeUndefined();
      expect(
        await resolveLiveImpersonation(world.db, { ...token, impersonatorId: world.plainAdminId }),
      ).toBeUndefined();
      expect(
        await resolveLiveImpersonation(world.db, { ...token, orgId: crypto.randomUUID() }),
      ).toBeUndefined();

      // Suspending the admin kills their running sessions on the next request.
      await ctx.db.execute(sql`UPDATE users SET status = 'suspended' WHERE id = ${world.adminId}`);
      expect(await resolveLiveImpersonation(world.db, token)).toBeUndefined();
      await ctx.db.execute(sql`UPDATE users SET status = 'active' WHERE id = ${world.adminId}`);

      // Ended → undefined, even though the JWT's exp would still allow it.
      await endImpersonation(world.db, {
        sessionId: started.session.id,
        organizationId: world.orgId,
        actorUserId: world.adminId,
      });
      expect(await resolveLiveImpersonation(world.db, token)).toBeUndefined();
    });
  });

  test("an expired-but-open session is closed inline by start, and the sweep closes the rest", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);

      // A ghost: inserted directly, already lapsed.
      const ghostId = `imp_${crypto.randomUUID()}`;
      await ctx.db.execute(sql`
        INSERT INTO impersonation_sessions (
          id, organization_id, admin_user_id, target_user_id, reason,
          started_at, expires_at, mfa_verified
        ) VALUES (
          ${ghostId}, ${world.orgId}, ${world.plainAdminId}, ${world.targetId},
          'abandoned fixture', now() - interval '3 hours', now() - interval '2 hours', false
        )
      `);

      // The sweep (the job's own service call) closes it with a per-row audit event.
      const swept = await expireLapsedImpersonations(world.db);
      expect(swept.expired).toBe(1);
      expect(swept.ids).toContain(ghostId);
      const expiredRows = await auditRows(world.db, "admin.impersonation.expired");
      expect(expiredRows).toHaveLength(1);
      expect(expiredRows[0].actor_type).toBe("system");
      expect(expiredRows[0].target_user_id).toBe(world.targetId);

      // Idempotent: the second tick finds nothing.
      expect((await expireLapsedImpersonations(world.db)).expired).toBe(0);

      // And a start that races a fresh ghost closes it inline instead of jamming on 409.
      const freshGhost = `imp_${crypto.randomUUID()}`;
      await ctx.db.execute(sql`
        INSERT INTO impersonation_sessions (
          id, organization_id, admin_user_id, target_user_id, reason,
          started_at, expires_at, mfa_verified
        ) VALUES (
          ${freshGhost}, ${world.orgId}, ${world.plainAdminId}, ${world.targetId},
          'lapsed mid-flight', now() - interval '20 minutes', now() - interval '5 minutes', false
        )
      `);
      const started = await startImpersonation(world.db, await startInput(world));
      expect(started.session.id).not.toBe(freshGhost);
      expect(started.reentered).toBe(false);
    });
  });

  test("mint re-issues inside the window for the session's own admin only", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      const started = await startImpersonation(world.db, await startInput(world));

      const minted = await mintImpersonationToken(world.db, {
        sessionId: started.session.id,
        organizationId: world.orgId,
        adminUserId: world.adminId,
        accessSecret: world.accessSecret,
      });
      expect(minted.token).toBeTruthy();

      // Another admin cannot borrow the credential — 403, not a token.
      await expect(
        mintImpersonationToken(world.db, {
          sessionId: started.session.id,
          organizationId: world.orgId,
          adminUserId: world.plainAdminId,
          accessSecret: world.accessSecret,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      // Ended → 409.
      await endImpersonation(world.db, {
        sessionId: started.session.id,
        organizationId: world.orgId,
        actorUserId: world.adminId,
      });
      await expect(
        mintImpersonationToken(world.db, {
          sessionId: started.session.id,
          organizationId: world.orgId,
          adminUserId: world.adminId,
          accessSecret: world.accessSecret,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("list is org-scoped and honours the scope filter", async () => {
    await withTestDb(async (ctx) => {
      const world = await makeWorld(ctx.db);
      const otherAdmin = await createTestUser(ctx.db);
      const otherOrg = await createTestOrg(ctx.db, { ownerId: otherAdmin.id });
      await addMemberWithRole(ctx.db, {
        organizationId: otherOrg.id,
        userId: otherAdmin.id,
        roleCode: "owner",
      });
      const otherTarget = await createTestUser(ctx.db);
      await addMemberWithRole(ctx.db, {
        organizationId: otherOrg.id,
        userId: otherTarget.id,
        roleCode: "creator",
      });
      const otherSecret = await enableMfa(ctx.db, otherAdmin.id);

      await startImpersonation(world.db, await startInput(world));
      await startImpersonation(ctx.db, {
        organizationId: otherOrg.id,
        adminUserId: otherAdmin.id,
        targetUserId: otherTarget.id,
        reason: "Other org support case",
        mfaCode: await getCurrentTOTP(otherSecret),
        accessSecret: world.accessSecret,
      });

      const mine = await listImpersonations(world.db, world.orgId, { limit: 50, cursor: null });
      expect(mine.items).toHaveLength(1);
      expect(mine.items[0]!.targetUserId).toBe(world.targetId);
      expect(mine.items[0]!.adminEmail).toBeTruthy();

      const theirs = await listImpersonations(ctx.db, otherOrg.id, {
        limit: 50,
        cursor: null,
      });
      expect(theirs.items).toHaveLength(1);
      expect(theirs.items[0]!.reason).toBe("Other org support case");

      // scope=ended hides the live session; scope=active shows only live ones.
      await endImpersonation(world.db, {
        sessionId: mine.items[0]!.id,
        organizationId: world.orgId,
        actorUserId: world.adminId,
      });
      expect(
        (
          await listImpersonations(
            world.db,
            world.orgId,
            { limit: 50, cursor: null },
            { scope: "active" },
          )
        ).items,
      ).toHaveLength(0);
      expect(
        (
          await listImpersonations(
            world.db,
            world.orgId,
            { limit: 50, cursor: null },
            { scope: "ended" },
          )
        ).items,
      ).toHaveLength(1);
    });
  });
});

// ─── The audit retagging (writeAuditLog + the ALS scope) ─────────────────────────────────────

describe.skipIf(!hasDb())("Impersonation audit retagging (NWB-P1-011)", () => {
  test("inside the scope, rows are impersonation rows: admin actor, session id, target default", async () => {
    await withTestDb(async (ctx) => {
      const { db } = ctx;
      const admin = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: admin.id });
      const target = await createTestUser(db);
      const sessionId = `imp_${crypto.randomUUID()}`;

      await runWithImpersonationContext(
        {
          impersonationSessionId: sessionId,
          adminUserId: admin.id,
          impersonatedUserId: target.id,
        },
        () =>
          writeAuditLog({
            db,
            module: "core",
            organizationId: org.id,
            actorId: target.id, // what a route would pass: the token user
            actorType: "user",
            action: "auth.session.revoked",
            resourceId: "sess-fixture",
          }),
      );

      const rows = (
        (await db.execute(
          sql`SELECT * FROM unified_audit_log WHERE action = 'auth.session.revoked' AND resource_id = 'sess-fixture'`,
        )) as any
      ).rows as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_type).toBe("impersonation");
      expect(rows[0].actor_id).toBe(admin.id);
      expect(rows[0].impersonation_session_id).toBe(sessionId);
      expect(rows[0].target_user_id).toBe(target.id);
    });
  });

  test("an explicit targetUserId wins; outside the scope nothing is retagged", async () => {
    await withTestDb(async (ctx) => {
      const { db } = ctx;
      const admin = await createTestUser(db);
      const target = await createTestUser(db);
      const third = await createTestUser(db);
      const sessionId = `imp_${crypto.randomUUID()}`;

      await runWithImpersonationContext(
        {
          impersonationSessionId: sessionId,
          adminUserId: admin.id,
          impersonatedUserId: target.id,
        },
        () =>
          writeAuditLog({
            db,
            module: "core",
            actorId: target.id,
            actorType: "user",
            action: "organization.member.role_changed",
            resourceId: "member-fixture",
            targetUserId: third.id, // an admin-as-user action on a third account
          }),
      );

      // And a plain write outside any impersonation scope is untouched.
      await writeAuditLog({
        db,
        module: "core",
        actorId: admin.id,
        actorType: "admin",
        action: "auth.session.revoked",
        resourceId: "sess-plain",
      });

      const rows = (
        (await db.execute(
          sql`SELECT * FROM unified_audit_log WHERE resource_id IN ('member-fixture', 'sess-plain') ORDER BY id`,
        )) as any
      ).rows as any[];
      expect(rows).toHaveLength(2);
      const retagged = rows.find((r) => r.resource_id === "member-fixture");
      const plain = rows.find((r) => r.resource_id === "sess-plain");
      expect(retagged.target_user_id).toBe(third.id);
      expect(retagged.actor_type).toBe("impersonation");
      expect(plain.actor_type).toBe("admin");
      expect(plain.impersonation_session_id).toBeNull();
      expect(plain.target_user_id).toBeNull();
    });
  });
});
