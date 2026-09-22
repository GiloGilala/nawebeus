import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { loadConfig } from "../../lib/config";
import { LegalHoldError, NotFoundError, ValidationError } from "../../lib/errors";
import { writeAuditLog } from "../../services/audit";
import { AUDIT_REDACTED } from "../../services/audit/anonymize";
import { expireInvitations, inviteMember } from "../../services/orgs/invitation.service";
import {
  deleteOrganization,
  purgeExpiredOrganizations,
} from "../../services/orgs/org-deletion.service";
import {
  assertNoActiveHoldForUser,
  placeLegalHold,
  releaseLegalHold,
} from "../../services/retention/legal-holds.service";
import { deleteAccount, purgeExpiredAccounts } from "../../services/users/account-deletion.service";
import { ensureAnonymizationTrigger, ensureRetentionTables, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/**
 * Input validation runs before the first database touch, so these cases need no database at
 * all — and passing no database proves the fail-fast order.
 */
const NO_DB = undefined as never;

describe("placeLegalHold input validation (no database)", () => {
  test("rejects a hold naming both a user and an organization", async () => {
    await expect(
      placeLegalHold(NO_DB, {
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        reason: "lawsuit",
        placedBy: "tester",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("rejects a hold naming neither a user nor an organization", async () => {
    await expect(placeLegalHold(NO_DB, { reason: "lawsuit", placedBy: "tester" })).rejects.toThrow(
      ValidationError,
    );
  });

  test("rejects an empty reason", async () => {
    await expect(
      placeLegalHold(NO_DB, { userId: crypto.randomUUID(), reason: "  ", placedBy: "tester" }),
    ).rejects.toThrow(ValidationError);
  });

  test("rejects an expiry in the past", async () => {
    await expect(
      placeLegalHold(NO_DB, {
        userId: crypto.randomUUID(),
        reason: "lawsuit",
        expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
        placedBy: "tester",
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe.skipIf(!hasDb())("legal holds lifecycle (NWB-P1-010)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("place → release → idempotent re-release, with both audits evidenced", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const subject = await createTestUser(db);

      const placed = await placeLegalHold(db, {
        userId: subject.id,
        reason: "employment tribunal",
        placedBy: "compliance-officer",
      });
      expect(placed.id).toMatch(/^lh_/);

      const row = (await db.execute(
        sql`SELECT status, data_type, reason, released_at, placed_by FROM legal_holds WHERE id = ${placed.id}`,
      )) as unknown as {
        rows?: {
          status: string;
          data_type: string;
          reason: string;
          released_at: string | null;
          placed_by: string;
        }[];
      };
      expect(row.rows).toHaveLength(1);
      expect(row.rows?.[0]).toMatchObject({
        status: "active",
        data_type: "all",
        reason: "employment tribunal",
        released_at: null,
        placed_by: "compliance-officer",
      });

      const placedAudit = (await db.execute(
        sql`SELECT action, severity, resource_type, resource_id
            FROM unified_audit_log WHERE action = 'legal-holds.placed' AND resource_id = ${placed.id}`,
      )) as unknown as { rows?: unknown[] };
      expect(placedAudit.rows).toHaveLength(1);

      const released = await releaseLegalHold(db, {
        id: placed.id,
        releasedBy: "compliance-officer",
        releaseReason: "settled",
      });
      expect(released).toEqual({ released: true });

      const again = await releaseLegalHold(db, {
        id: placed.id,
        releasedBy: "compliance-officer",
        releaseReason: "settled",
      });
      expect(again).toEqual({ released: false });

      const releasedAudit = (await db.execute(
        sql`SELECT action, resource_type, resource_id
            FROM unified_audit_log WHERE action = 'legal-holds.released' AND resource_id = ${placed.id}`,
      )) as unknown as { rows?: unknown[] };
      expect(releasedAudit.rows).toHaveLength(1);
    });
  });

  test("unknown subjects and unknown holds fail closed with 404", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      await expect(
        placeLegalHold(db, {
          userId: crypto.randomUUID(),
          reason: "a typo'd id must freeze nothing",
          placedBy: "tester",
        }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        placeLegalHold(db, {
          organizationId: crypto.randomUUID(),
          reason: "a typo'd id must freeze nothing",
          placedBy: "tester",
        }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        releaseLegalHold(db, { id: "lh_doesnotexist", releasedBy: "tester", releaseReason: "x" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  test("a soft-deleted subject can still be held: preservation must not race the grace clock", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const subject = await createTestUser(db);
      await deleteAccount(db, subject.id);

      const placed = await placeLegalHold(db, {
        userId: subject.id,
        reason: "claim filed during grace",
        placedBy: "compliance-officer",
      });
      expect(placed.id).toMatch(/^lh_/);

      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${subject.id}`,
      );
      const outcome = await purgeExpiredAccounts(db);
      expect(outcome.held).toBe(1);
      expect(outcome.deleted).toBe(0);
    });
  });
});

describe.skipIf(!hasDb())("holds block purges (NWB-P1-010)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("a held account survives the purge with its audit rows untouched; release unblocks it", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      await ensureRetentionTables(db);
      const held = await createTestUser(db);
      const free = await createTestUser(db);

      // Seed audit context for the held user, then soft-delete both through the real path.
      await writeAuditLog({
        db,
        module: "core",
        actorId: held.id,
        actorType: "user",
        action: "auth.email_change.requested",
        actorIp: "192.0.2.10",
        resourceType: "user",
        resourceId: held.id,
        afterState: { newEmail: held.email },
      });
      await deleteAccount(db, held.id);
      await deleteAccount(db, free.id);
      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day'
            WHERE id IN (${held.id}, ${free.id})`,
      );

      const hold = await placeLegalHold(db, {
        userId: held.id,
        reason: "litigation",
        placedBy: "compliance-officer",
      });

      const blocked = await purgeExpiredAccounts(db);
      expect(blocked.deleted).toBe(1);
      expect(blocked.failed).toBe(1);
      expect(blocked.held).toBe(1);
      expect(blocked.errors).toHaveLength(1);
      expect(blocked.errors[0]?.id).toBe(held.id);
      // The hold id in the reason is what lets the operator find the freeze, not just the refusal.
      expect(String(blocked.errors[0]?.error)).toContain(hold.id);
      expect(String(blocked.errors[0]?.error)).toContain("LEGAL_HOLD");

      const survivor = (await db.execute(
        sql`SELECT id FROM users WHERE id = ${held.id}`,
      )) as unknown as { rows?: unknown[] };
      expect(survivor.rows).toHaveLength(1);
      const gone = (await db.execute(
        sql`SELECT id FROM users WHERE id = ${free.id}`,
      )) as unknown as { rows?: unknown[] };
      expect(gone.rows).toHaveLength(0);

      // The scrub never ran for the held user: the hold check precedes the flag dance, so the
      // audit rows keep their plaintext exactly as written.
      const kept = (await db.execute(
        sql`SELECT actor_ip, after_state FROM unified_audit_log
            WHERE resource_type = 'user' AND resource_id = ${held.id}
              AND action = 'auth.email_change.requested'`,
      )) as unknown as { rows?: { actor_ip: string | null; after_state: unknown }[] };
      expect(kept.rows).toHaveLength(1);
      expect(kept.rows?.[0]?.actor_ip).toBe("192.0.2.10");
      expect(kept.rows?.[0]?.after_state).toMatchObject({ newEmail: held.email });

      await releaseLegalHold(db, {
        id: hold.id,
        releasedBy: "compliance-officer",
        releaseReason: "matter closed",
      });
      const unblocked = await purgeExpiredAccounts(db);
      expect(unblocked).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        auditAnonymized: expect.any(Number),
        held: 0,
      });
      const scrubbed = (await db.execute(
        sql`SELECT actor_ip, after_state FROM unified_audit_log
            WHERE resource_type = 'user' AND resource_id = ${held.id}
              AND action = 'auth.email_change.requested'`,
      )) as unknown as { rows?: { actor_ip: string | null; after_state: unknown }[] };
      expect(scrubbed.rows?.[0]?.actor_ip).toBeNull();
      expect(scrubbed.rows?.[0]?.after_state).toMatchObject({ newEmail: AUDIT_REDACTED });
    });
  });

  test("an org hold freezes the org but not a member's account; release unblocks the org", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const owner = await createTestUser(db);
      const member = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: member.id,
        roleCode: "viewer",
      });

      await deleteOrganization(db, org.id, owner.id);
      await deleteAccount(db, member.id);
      await db.execute(
        sql`UPDATE organizations SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${org.id}`,
      );
      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${member.id}`,
      );

      const hold = await placeLegalHold(db, {
        organizationId: org.id,
        reason: "regulatory inquiry",
        placedBy: "compliance-officer",
      });

      const orgOutcome = await purgeExpiredOrganizations(db);
      expect(orgOutcome.held).toBe(1);
      expect(orgOutcome.deleted).toBe(0);
      expect(String(orgOutcome.errors[0]?.error)).toContain(hold.id);

      // The hold is org-scoped: the member's own erasure proceeds — the freeze does not leak
      // sideways onto people who merely belonged to the org.
      const memberOutcome = await purgeExpiredAccounts(db);
      expect(memberOutcome.held).toBe(0);
      expect(memberOutcome.deleted).toBe(1);

      const orgSurvivor = (await db.execute(
        sql`SELECT id FROM organizations WHERE id = ${org.id}`,
      )) as unknown as { rows?: unknown[] };
      expect(orgSurvivor.rows).toHaveLength(1);

      await releaseLegalHold(db, {
        id: hold.id,
        releasedBy: "compliance-officer",
        releaseReason: "inquiry closed",
      });
      const unblocked = await purgeExpiredOrganizations(db);
      expect(unblocked.deleted).toBe(1);
      expect(unblocked.held).toBe(0);
    });
  });

  test("lapsed invites: org hold freezes all, user hold freezes the invitee's rows, release frees them", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      await ensureRetentionTables(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: owner.id,
        roleCode: "owner",
      });
      const invitee = await createTestUser(db);

      const plain = await inviteMember(db, org.id, owner.id, {
        email: `hold-plain-${crypto.randomUUID().slice(0, 8)}@test.com`,
      });
      // Inviting an existing account hints the member row at it — the user_id predicate path.
      const linked = await inviteMember(db, org.id, owner.id, { email: invitee.email });
      // A legacy/imported row: no account link, only the addressee column — the invited_email path.
      const legacyEmail = `hold-legacy-${crypto.randomUUID().slice(0, 8)}@test.com`;
      const legacy = await inviteMember(db, org.id, owner.id, { email: legacyEmail });
      await db.execute(
        sql`UPDATE organization_members SET user_id = NULL, invited_email = ${invitee.email}
            WHERE id = ${legacy.memberId}`,
      );
      for (const memberId of [plain.memberId, linked.memberId, legacy.memberId]) {
        await db.execute(
          sql`UPDATE organization_members SET expires_at = now() - interval '37 days' WHERE id = ${memberId}`,
        );
      }

      const orgHold = await placeLegalHold(db, {
        organizationId: org.id,
        reason: "org-wide preservation",
        placedBy: "compliance-officer",
      });
      const orgPhase = await expireInvitations(db);
      // Nothing scrubbed: every hold check runs before the scrub, so a fully held run leaves
      // the audit trail byte-identical.
      expect(orgPhase).toEqual({
        deleted: 0,
        failed: 3,
        errors: [
          { id: expect.any(String), error: expect.stringContaining(orgHold.id) },
          { id: expect.any(String), error: expect.stringContaining(orgHold.id) },
          { id: expect.any(String), error: expect.stringContaining(orgHold.id) },
        ],
        auditAnonymized: 0,
        held: 3,
      });

      await releaseLegalHold(db, {
        id: orgHold.id,
        releasedBy: "compliance-officer",
        releaseReason: "scoped down to the invitee",
      });
      const userHold = await placeLegalHold(db, {
        userId: invitee.id,
        reason: "invitee litigation",
        placedBy: "compliance-officer",
      });
      const userPhase = await expireInvitations(db);
      expect(userPhase.deleted).toBe(1);
      expect(userPhase.failed).toBe(2);
      expect(userPhase.held).toBe(2);
      expect(userPhase.auditAnonymized).toBe(1);
      for (const entry of userPhase.errors) {
        expect(String(entry.error)).toContain(userHold.id);
      }

      const lapsed = (await db.execute(
        sql`SELECT id FROM organization_members WHERE id = ${plain.memberId}`,
      )) as unknown as { rows?: unknown[] };
      expect(lapsed.rows).toHaveLength(0);

      // The purged invite's audit row is scrubbed; the held rows' audit rows keep their plaintext.
      const scrubbed = (await db.execute(
        sql`SELECT after_state FROM unified_audit_log
            WHERE resource_type = 'member' AND resource_id = ${plain.memberId}`,
      )) as unknown as { rows?: { after_state: unknown }[] };
      expect(scrubbed.rows?.[0]?.after_state).toMatchObject({ email: AUDIT_REDACTED });
      // Each held row's audit keeps its own addressee in plaintext: the linked invite was
      // addressed to the invitee, the legacy row to its original address (the audit was written
      // at invite time, before the test overwrote the column to simulate the legacy shape).
      for (const [memberId, email] of [
        [linked.memberId, invitee.email],
        [legacy.memberId, legacyEmail],
      ] as const) {
        const kept = (await db.execute(
          sql`SELECT after_state FROM unified_audit_log
              WHERE resource_type = 'member' AND resource_id = ${memberId}`,
        )) as unknown as { rows?: { after_state: unknown }[] };
        expect(kept.rows?.[0]?.after_state).toMatchObject({ email });
      }

      await releaseLegalHold(db, {
        id: userHold.id,
        releasedBy: "compliance-officer",
        releaseReason: "matter closed",
      });
      const freed = await expireInvitations(db);
      expect(freed).toEqual({
        deleted: 2,
        failed: 0,
        errors: [],
        auditAnonymized: 2,
        held: 0,
      });
    });
  });

  test("an expired hold blocks nothing: expiry is evaluated at read time", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const subject = await createTestUser(db);
      await deleteAccount(db, subject.id);
      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${subject.id}`,
      );

      const hold = await placeLegalHold(db, {
        userId: subject.id,
        reason: "short-lived preservation",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        placedBy: "compliance-officer",
      });
      // Let the clock run out, the way a night passing would: backdate the placement too,
      // so the row reads "placed two hours ago with a one-hour TTL" and still satisfies the
      // expires-after-placed CHECK.
      await db.execute(
        sql`UPDATE legal_holds
            SET placed_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
            WHERE id = ${hold.id}`,
      );

      const outcome = await purgeExpiredAccounts(db);
      expect(outcome).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        auditAnonymized: expect.any(Number),
        held: 0,
      });
    });
  });

  test("assert helpers throw LegalHoldError naming the hold (423)", async () => {
    await withTestDb(async ({ db }) => {
      await ensureRetentionTables(db);
      const subject = await createTestUser(db);
      const hold = await placeLegalHold(db, {
        userId: subject.id,
        reason: "direct assert",
        placedBy: "tester",
      });
      const thrown = await assertNoActiveHoldForUser(db, subject.id, "test operation").catch(
        (error: unknown) => error,
      );
      expect(thrown).toBeInstanceOf(LegalHoldError);
      expect((thrown as LegalHoldError).statusCode).toBe(423);
      expect((thrown as LegalHoldError).holdId).toBe(hold.id);
    });
  });
});
