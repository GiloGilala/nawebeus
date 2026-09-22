/**
 * Lapsed-invitation expiry (NWB-P1-016).
 *
 * An invitation lapses 7 days after sending and lingers one 30-day grace cycle so admins can
 * still see it in the member list; past that the member row is hard-deleted, because a lapsed
 * invite is consent that expired. What these tests pin:
 *
 * - the candidate predicate is lapsed-only: pending, accepted, dateless (`expires_at` NULL), and
 *   soft-deleted rows all survive;
 * - the scrub is resource-scoped, not email-blasted: another org's invite for the same address
 *   keeps its row, its column, and its audit text;
 * - pre-`invited_email` rows fall back to the invite audit row's own address;
 * - inviters keep their network context (no ip/UA nulling — the rows belong to someone who is
 *   not being erased), and a chained row in the invite's scope still verifies afterwards;
 * - a re-invite after cleanup is a fresh insert, and an existing user's account survives their
 *   invite's erasure.
 *
 * The job adapter (`retention.purge-expired-invitations`) is tested here too, next to the service
 * it schedules — the `chain.test.ts` precedent for the chain-verification job.
 *
 * Each DB test runs inside `withTestDb`'s transaction, so the DELETEs are real and then rolled
 * back — including the `SET LOCAL` flag dance, which cannot leak past the outer rollback.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { purgeExpiredInvitationsJob } from "../../jobs/purge-expired-invitations";
import { loadConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import type { JobAttempt } from "../../lib/worker";
import { AUDIT_REDACTED, verifyAuditChains, writeAuditLog } from "../../services/audit";
import { expireInvitations, inviteMember } from "../../services/orgs/invitation.service";
import { listMembers } from "../../services/orgs/member.service";
import { ensureAnonymizationTrigger, withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  systemRoleId,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const ATTEMPT: JobAttempt = { id: "job-test", attempt: 1 };

/** Unique addressee per call — the suites share one database host, so fixed emails collide. */
const inviteEmail = (tag: string): string =>
  `expiry-${tag}-${crypto.randomUUID().slice(0, 8)}@test.com`;

/** An org with an active owner who can invite (the service-layer predicate `inviteMember` needs). */
async function ownerOrg(db: Db) {
  const owner = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: owner.id });
  await addMemberWithRole(db, {
    organizationId: org.id,
    userId: owner.id,
    roleCode: "owner",
  });
  return { owner, org };
}

/** Age an invite past the lapse grace, the way 37 days of nobody accepting would. */
async function ageInvitePastGrace(db: Db, memberId: string): Promise<void> {
  await db.execute(
    sql`UPDATE organization_members SET expires_at = now() - interval '37 days' WHERE id = ${memberId}`,
  );
}

async function memberExists(db: Db, memberId: string): Promise<boolean> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM organization_members WHERE id = ${memberId}`,
  );
  return ((rows as unknown as { rows?: unknown[] }).rows ?? []).length > 0;
}

interface MemberAuditRow {
  action: string;
  after_state: Record<string, unknown> | null;
  actor_ip: string | null;
  actor_user_agent: string | null;
  checksum: string | null;
  hash_chain_valid: boolean | null;
}

async function memberAuditRows(db: Db, memberId: string): Promise<MemberAuditRow[]> {
  const rows = await db.execute(
    sql`SELECT action, after_state, actor_ip, actor_user_agent, checksum, hash_chain_valid
        FROM unified_audit_log
        WHERE resource_type = 'member' AND resource_id = ${memberId}
        ORDER BY created_at, id`,
  );
  return (rows as unknown as { rows?: MemberAuditRow[] }).rows ?? [];
}

// biome-ignore lint/suspicious/noExplicitAny: test rows are read dynamically throughout
const rowOf = (rows: unknown): any => (rows as any).rows?.[0];

describe.skipIf(!hasDb())("Lapsed-invitation expiry (NWB-P1-016)", () => {
  beforeAll(() => {
    loadConfig();
  });

  test("deletes only lapsed invites — pending, accepted, dateless, and soft-deleted rows survive", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const { owner, org } = await ownerOrg(db);
      const viewerId = await systemRoleId(db, "viewer");

      const lapsedA = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("lapsed-a"),
      });
      const lapsedB = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("lapsed-b"),
      });
      const fresh = await inviteMember(db, org.id, owner.id, { email: inviteEmail("fresh") });
      const accepted = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("accepted"),
      });
      const dateless = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("dateless"),
      });
      const softDeleted = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("soft-deleted"),
      });

      await ageInvitePastGrace(db, lapsedA.memberId);
      await ageInvitePastGrace(db, lapsedB.memberId);
      // Accept leaves `expires_at` set — the status predicate is what excludes it, not the clock.
      await ageInvitePastGrace(db, accepted.memberId);
      await db.execute(
        sql`UPDATE organization_members SET status = 'active', is_active = true, accepted_at = now() WHERE id = ${accepted.memberId}`,
      );
      // Lapse is unprovable without an expiry, so dateless rows are out of scope, not expired.
      await db.execute(
        sql`UPDATE organization_members SET expires_at = NULL WHERE id = ${dateless.memberId}`,
      );
      await ageInvitePastGrace(db, softDeleted.memberId);
      await db.execute(
        sql`UPDATE organization_members SET deleted_at = now() WHERE id = ${softDeleted.memberId}`,
      );

      const result = await expireInvitations(db);
      // One audit row per invite (the insert path audits once), both lapsed rows scrubbed.
      expect(result).toEqual({ deleted: 2, failed: 0, errors: [], auditAnonymized: 2, held: 0 });

      expect(await memberExists(db, lapsedA.memberId)).toBe(false);
      expect(await memberExists(db, lapsedB.memberId)).toBe(false);
      expect(await memberExists(db, fresh.memberId)).toBe(true);
      expect(await memberExists(db, accepted.memberId)).toBe(true);
      expect(await memberExists(db, dateless.memberId)).toBe(true);
      expect(await memberExists(db, softDeleted.memberId)).toBe(true);

      // The audit row is the durable record: the invite stays evidenced, the address does not.
      const scrubbed = await memberAuditRows(db, lapsedA.memberId);
      expect(scrubbed).toHaveLength(1);
      expect(scrubbed[0]?.after_state).toEqual({
        email: AUDIT_REDACTED,
        roleId: viewerId,
        roleCode: "viewer",
      });
      const untouched = await memberAuditRows(db, fresh.memberId);
      expect(untouched).toHaveLength(1);
      expect(untouched[0]?.after_state).toMatchObject({ email: fresh.email });

      // A re-run finds nothing — the idempotency at-least-once delivery leans on.
      expect(await expireInvitations(db)).toEqual({
        deleted: 0,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
    });
  });

  test("the scrub is resource-scoped: another org's pending invite for the same address is untouched", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const home = await ownerOrg(db);
      const away = await ownerOrg(db);
      const shared = inviteEmail("shared");

      const lapsed = await inviteMember(db, home.org.id, home.owner.id, { email: shared });
      const pending = await inviteMember(db, away.org.id, away.owner.id, { email: shared });
      await ageInvitePastGrace(db, lapsed.memberId);

      const result = await expireInvitations(db);
      expect(result).toEqual({ deleted: 1, failed: 0, errors: [], auditAnonymized: 1, held: 0 });

      expect(await memberExists(db, lapsed.memberId)).toBe(false);
      expect(await memberExists(db, pending.memberId)).toBe(true);

      const scrubbed = await memberAuditRows(db, lapsed.memberId);
      expect(scrubbed[0]?.after_state).toMatchObject({ email: AUDIT_REDACTED });

      // Both directions: the other org's audit text and its member column keep the address, and
      // the invite still lists — a whole-table email match would have eaten all three.
      const kept = await memberAuditRows(db, pending.memberId);
      expect(kept[0]?.after_state).toMatchObject({ email: shared });
      const column = rowOf(
        await db.execute(
          sql`SELECT invited_email FROM organization_members WHERE id = ${pending.memberId}`,
        ),
      );
      expect(column.invited_email).toBe(shared);
      const listing = await listMembers(db, away.org.id);
      expect(listing.items.some((member) => member.email === shared)).toBe(true);
    });
  });

  test("pre-invited_email rows fall back to the invite audit row's own address", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const { owner, org } = await ownerOrg(db);

      const invite = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("legacy"),
      });
      // Rows written before the column existed carry the address only in the audit row.
      await db.execute(
        sql`UPDATE organization_members SET invited_email = NULL WHERE id = ${invite.memberId}`,
      );
      await ageInvitePastGrace(db, invite.memberId);

      const result = await expireInvitations(db);
      expect(result).toEqual({ deleted: 1, failed: 0, errors: [], auditAnonymized: 1, held: 0 });

      expect(await memberExists(db, invite.memberId)).toBe(false);
      const scrubbed = await memberAuditRows(db, invite.memberId);
      expect(scrubbed[0]?.after_state).toMatchObject({ email: AUDIT_REDACTED });
    });
  });

  test("inviters keep their network context, and a chained row in the invite's scope still verifies", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const { owner, org } = await ownerOrg(db);
      const email = inviteEmail("network");

      const invite = await inviteMember(db, org.id, owner.id, { email });
      await ageInvitePastGrace(db, invite.memberId);

      // Refresh-shaped second invite row — a re-invite audits again against the same member id —
      // carrying the network context a proxied request would leave behind. Production writers set
      // no ip today; the seed proves the scrub's no-nulling guarantee for rows that carry it.
      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: owner.id,
        actorType: "user",
        action: "organization.member.invited",
        actorIp: "192.0.2.20",
        actorUserAgent: "test-agent/refresh",
        resourceType: "member",
        resourceId: invite.memberId,
        afterState: { email, roleCode: "viewer" },
      });
      // Invite-shaped compliance annotation: chained module, member scope, the same address.
      await writeAuditLog({
        db,
        module: "compliance",
        organizationId: org.id,
        actorId: owner.id,
        actorType: "user",
        action: "compliance.dsar.requested",
        actorIp: "192.0.2.21",
        actorUserAgent: "test-agent/chained",
        resourceType: "member",
        resourceId: invite.memberId,
        afterState: { email },
      });

      const result = await expireInvitations(db);
      expect(result).toEqual({ deleted: 1, failed: 0, errors: [], auditAnonymized: 3, held: 0 });

      const rows = await memberAuditRows(db, invite.memberId);
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.after_state).toMatchObject({ email: AUDIT_REDACTED });
      }
      // Found by identity, not position: the seeds can share a `created_at` millisecond, and the
      // id tie-break is random — positional asserts on them are a coin flip.
      const refresh = rows.find((row) => row.actor_ip === "192.0.2.20");
      const chained = rows.find((row) => row.action === "compliance.dsar.requested");
      expect(refresh).toBeDefined();
      expect(chained).toBeDefined();
      // Every matched row belongs to an inviter who is not being erased: network context stays.
      expect(refresh?.actor_user_agent).toBe("test-agent/refresh");
      expect(chained?.actor_ip).toBe("192.0.2.21");
      expect(chained?.actor_user_agent).toBe("test-agent/chained");

      // The chained row was re-sealed by the scrub, not broken by it.
      expect(chained?.checksum).not.toBeNull();
      expect(chained?.hash_chain_valid).toBe(true);
      const verification = await verifyAuditChains(db);
      expect(verification.rowsChecked).toBe(1);
      expect(verification.broken).toEqual([]);
      expect(verification.newlyFlagged).toBe(0);
    });
  });

  test("a re-invite after cleanup is a fresh insert, and an existing user's account survives", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const { owner, org } = await ownerOrg(db);

      // The invitee already has an account: the member row hints at it, the addressee of record
      // is `invited_email` either way.
      const account = await createTestUser(db, { email: inviteEmail("established") });
      const invite = await inviteMember(db, org.id, owner.id, { email: account.email });
      const hinted = rowOf(
        await db.execute(
          sql`SELECT user_id FROM organization_members WHERE id = ${invite.memberId}`,
        ),
      );
      expect(hinted.user_id).toBe(account.id);
      await ageInvitePastGrace(db, invite.memberId);

      expect(await expireInvitations(db)).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        auditAnonymized: 1,
        held: 0,
      });
      expect(await memberExists(db, invite.memberId)).toBe(false);

      // Only the member row goes — the account and its address are untouched.
      const user = rowOf(await db.execute(sql`SELECT email FROM users WHERE id = ${account.id}`));
      expect(user.email).toBe(account.email);

      // The dedup finds no pending row, so the insert path runs: new id, new token, and a new
      // audit row carrying the plain address for the new lifecycle.
      const again = await inviteMember(db, org.id, owner.id, { email: account.email });
      expect(again.memberId).not.toBe(invite.memberId);
      const fresh = rowOf(
        await db.execute(
          sql`SELECT status, invitation_token FROM organization_members WHERE id = ${again.memberId}`,
        ),
      );
      expect(fresh.status).toBe("invited");
      expect(fresh.invitation_token).not.toBeNull();
      const relived = await memberAuditRows(db, again.memberId);
      expect(relived).toHaveLength(1);
      expect(relived[0]?.after_state).toMatchObject({ email: account.email });
      const historic = await memberAuditRows(db, invite.memberId);
      expect(historic[0]?.after_state).toMatchObject({ email: AUDIT_REDACTED });
    });
  });

  test("a blocked row's scrub rolls back with its DELETE — proven with a stand-in restrictive FK", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      // No restrictive edge to `organization_members.id` exists in the active schema today, so the
      // blocker is a temporary table with the default NO ACTION FK — the same refusal class a
      // future restrictive reference would bring. Transactional DDL — rolls back with the test.
      await db.execute(
        sql`CREATE TABLE tmp_invite_purge_blocker (member_id uuid NOT NULL REFERENCES organization_members(id))`,
      );
      const { owner, org } = await ownerOrg(db);
      const blocked = await inviteMember(db, org.id, owner.id, {
        email: inviteEmail("blocked"),
      });
      const free = await inviteMember(db, org.id, owner.id, { email: inviteEmail("free") });
      await db.execute(
        sql`INSERT INTO tmp_invite_purge_blocker (member_id) VALUES (${blocked.memberId})`,
      );
      await ageInvitePastGrace(db, blocked.memberId);
      await ageInvitePastGrace(db, free.memberId);

      const result = await expireInvitations(db);
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toEqual([
        { id: blocked.memberId, error: expect.stringMatching(/23503/i) },
      ]);
      expect(result.auditAnonymized).toBe(1);

      expect(await memberExists(db, free.memberId)).toBe(false);
      expect(await memberExists(db, blocked.memberId)).toBe(true);
      // The scrub ran inside the row's savepoint, so it rolled back with the DELETE — the blocked
      // row's audit text is still plain, and the retry will scrub it for real.
      const freed = await memberAuditRows(db, free.memberId);
      expect(freed[0]?.after_state).toMatchObject({ email: AUDIT_REDACTED });
      const held = await memberAuditRows(db, blocked.memberId);
      expect(held[0]?.after_state).toMatchObject({ email: blocked.email });
    });
  });

  test("the job reports the service result and no-ops on re-run", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const { owner, org } = await ownerOrg(db);
      const invite = await inviteMember(db, org.id, owner.id, { email: inviteEmail("job") });
      await ageInvitePastGrace(db, invite.memberId);

      expect(await purgeExpiredInvitationsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 1,
        failed: 0,
        errors: [],
        auditAnonymized: 1,
        held: 0,
      });
      expect(await memberExists(db, invite.memberId)).toBe(false);
      expect(await purgeExpiredInvitationsJob.handle({ db, job: ATTEMPT }, null)).toEqual({
        deleted: 0,
        failed: 0,
        errors: [],
        auditAnonymized: 0,
        held: 0,
      });
    });
  });
});
