/**
 * Audit actor-context anonymization on hard purge (NWB-P1-015, BR-AUTH-043 / F-29).
 *
 * The 7-year retention rule is why the rows must survive, so these tests never assert a delete —
 * they assert the row is still there with its evidence shape intact, its chain still verifying,
 * and nothing in it that resolves to the erased subject. Seeds mirror production writers' payload
 * shapes (`newEmail` on email-change, `email` on invite/accept) rather than inventing keys, and
 * the trigger tests execute `drizzle/migrations/0002_*.sql` itself, so the tested DDL and the
 * shipped DDL cannot drift (the `chain.test.ts` precedent for `0001`).
 *
 * Each DB test runs inside `withTestDb`'s transaction, so the purges are real and then rolled
 * back — including the `SET LOCAL` flag dance, which cannot leak past the outer rollback.
 */
import { describe, expect, test } from "bun:test";
import { type SQL, sql } from "drizzle-orm";
import { purgeExpiredAccountsJob } from "../../jobs/purge-expired-accounts";
import type { Db } from "../../lib/db";
import type { JobAttempt } from "../../lib/worker";
import {
  AUDIT_REDACTED,
  anonymizeAuditActorContext,
  mangleCandidates,
  scrubJsonValue,
  verifyAuditChains,
  writeAuditLog,
} from "../../services/audit";
import { purgeExpiredOrganizations } from "../../services/orgs/org-deletion.service";
import { deleteAccount, purgeExpiredAccounts } from "../../services/users/account-deletion.service";
import { ensureAnonymizationTrigger, withTestDb } from "../helpers/test-db";
import {
  createTestMember,
  createTestOrg,
  createTestUser,
  systemRoleId,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const ATTEMPT: JobAttempt = { id: "anonymize-test", attempt: 1 };

/** The columns the scrub tests read back, as PostgreSQL types them. */
type ScrubReadRow = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  actor_ip: string | null;
  actor_user_agent: string | null;
  organization_id: string | null;
  resource_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  checksum: string | null;
  hash_chain_valid: boolean;
};

async function selectOne<T>(db: Db, query: SQL): Promise<T | undefined> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: T[] }).rows?.[0];
}

async function auditRowByAction(db: Db, action: string, actorId: string): Promise<ScrubReadRow> {
  const row = await selectOne<ScrubReadRow>(
    db,
    sql`SELECT id, actor_id, target_user_id, actor_ip, actor_user_agent, organization_id,
               resource_id, before_state, after_state, metadata, checksum, hash_chain_valid
        FROM unified_audit_log WHERE action = ${action} AND actor_id = ${actorId} LIMIT 1`,
  );
  expect(row).toBeDefined();
  return row as ScrubReadRow;
}

async function rowGone(db: Db, table: string, id: string): Promise<boolean> {
  const row = await selectOne<{ n: string }>(
    db,
    sql`SELECT count(*)::text AS n FROM ${sql.raw(table)} WHERE id = ${id}`,
  );
  return Number(row?.n ?? 0) === 0;
}

let savepointCounter = 0;

/**
 * Run a statement that is expected to be rejected, inside its own savepoint so the rejection
 * rolls back exactly that statement. Returns the thrown error for message/code assertions — a
 * statement that unexpectedly succeeds fails the test instead of silently passing it.
 */
async function expectRejected(db: Db, query: SQL): Promise<unknown> {
  const savepoint = `sp_anonymize_reject_${savepointCounter++}`;
  await db.execute(sql.raw(`SAVEPOINT ${savepoint}`));
  try {
    await db.execute(query);
  } catch (error) {
    await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
    return error;
  }
  await db.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
  throw new Error("expected the statement to be rejected, but it succeeded");
}

describe("audit anonymization rule (no database)", () => {
  test("scrubJsonValue replaces known values under email/phone keys, at any depth", () => {
    const known = new Set(["user@example.com"]);
    const { value, changed } = scrubJsonValue(
      {
        newEmail: "user@example.com",
        nested: { email: "user@example.com", deep: [{ phone: "user@example.com" }] },
        status: "active",
        count: 3,
        nothing: null,
      },
      (entry) => known.has(entry),
    );
    expect(changed).toBe(true);
    expect(value).toEqual({
      newEmail: AUDIT_REDACTED,
      nested: { email: AUDIT_REDACTED, deep: [{ phone: AUDIT_REDACTED }] },
      status: "active",
      count: 3,
      nothing: null,
    });
  });

  test("scrubJsonValue leaves unknown values, non-strings and already-redacted values alone", () => {
    const known = new Set(["user@example.com"]);
    const input = {
      email: "someone-else@example.com",
      newEmail: AUDIT_REDACTED,
      phone: null,
      emailVerified: true,
      tags: ["user@example.com"],
    };
    const { value, changed } = scrubJsonValue(input, (entry) => known.has(entry));
    // A bare string in an array has no key, so no key family matches — untouched even though the
    // value is known. Scrubbing unkeyed strings would eat free text.
    expect(changed).toBe(false);
    expect(value).toEqual(input);
  });

  test("scrubJsonValue matches key families case-insensitively but still needs the value gate", () => {
    const { value: replaced } = scrubJsonValue({ EMAIL: "a@b.c" }, () => true);
    expect(replaced).toEqual({ EMAIL: AUDIT_REDACTED });
    const { value: kept, changed } = scrubJsonValue({ EMAIL: "a@b.c" }, () => false);
    expect(changed).toBe(false);
    expect(kept).toEqual({ EMAIL: "a@b.c" });
  });

  test("mangleCandidates recovers the original through single, double and absent mangling", () => {
    expect(mangleCandidates("user@example.com")).toEqual(["user@example.com"]);
    expect(mangleCandidates("user@example.com+deletedabcdef12")).toEqual([
      "user@example.com+deletedabcdef12",
      "user@example.com",
    ]);
    expect(mangleCandidates("user@example.com+deleted11111111+deleted22222222")).toEqual([
      "user@example.com+deleted11111111+deleted22222222",
      "user@example.com+deleted11111111",
      "user@example.com",
    ]);
  });
});

describe.skipIf(!hasDb())("audit anonymization on hard purge", () => {
  test("purge scrubs the subject's actor context, keeps the rows, and the chain still verifies", async () => {
    await withTestDb(async ({ db }) => {
      // Push-built databases (CI included) have no trigger at all — without this, the scrub
      // below would pass trivially and the flag/trigger integration would go untested.
      await ensureAnonymizationTrigger(db);
      const subject = await createTestUser(db);
      const originalEmail = subject.email;
      const other = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: other.id });
      const roleId = await systemRoleId(db, "creator");
      const { id: memberId } = await createTestMember(db, {
        organizationId: org.id,
        userId: subject.id,
        roleId,
      });
      // The invite flow records the addressee; the purge reads it back before the CASCADE.
      await db.execute(
        sql`UPDATE organization_members SET invited_email = ${originalEmail} WHERE id = ${memberId}`,
      );

      // Seeds mirror production payload shapes: newEmail on email-change, email on invite.
      await writeAuditLog({
        db,
        module: "core",
        actorId: subject.id,
        actorType: "user",
        action: "auth.email_change.requested",
        actorIp: "192.0.2.1",
        actorUserAgent: "test-agent/1.0",
        resourceType: "user",
        resourceId: subject.id,
        afterState: { newEmail: originalEmail },
      });
      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: other.id,
        actorType: "user",
        action: "organization.member.invited",
        actorIp: "192.0.2.2",
        resourceType: "member",
        resourceId: memberId,
        afterState: { email: originalEmail, roleId, roleCode: "creator" },
      });
      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: other.id,
        actorType: "user",
        action: "organization.member.removed",
        actorIp: "192.0.2.3",
        resourceType: "member",
        resourceId: memberId,
        targetUserId: subject.id,
        beforeState: { roleId, roleCode: "creator", status: "active" },
      });
      await writeAuditLog({
        db,
        module: "compliance",
        actorId: subject.id,
        actorType: "user",
        action: "compliance.dsar.requested",
        actorIp: "192.0.2.4",
        actorUserAgent: "test-agent/2.0",
        metadata: { expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
      });
      // Control: another user's email must survive the subject's erasure untouched.
      await writeAuditLog({
        db,
        module: "core",
        actorId: other.id,
        actorType: "user",
        action: "auth.email_change.requested",
        resourceType: "user",
        resourceId: other.id,
        afterState: { newEmail: other.email },
      });

      // The real soft-delete path, so the purge meets a mangled address like production does.
      await deleteAccount(db, subject.id);
      await db.execute(
        sql`UPDATE users SET scheduled_deletion_at = now() - interval '1 day' WHERE id = ${subject.id}`,
      );

      const outcome = await purgeExpiredAccountsJob.handle({ db, job: ATTEMPT }, null);
      expect(outcome).toEqual({ deleted: 1, failed: 0, errors: [], auditAnonymized: 3 });
      expect(await rowGone(db, "users", subject.id)).toBe(true);

      // The subject's own row: network context nulled, email redacted, references kept.
      const changed = await auditRowByAction(db, "auth.email_change.requested", subject.id);
      expect(changed.actor_ip).toBeNull();
      expect(changed.actor_user_agent).toBeNull();
      expect(changed.after_state).toEqual({ newEmail: AUDIT_REDACTED });
      expect(changed.actor_id).toBe(subject.id);
      expect(changed.resource_id).toBe(subject.id);

      // The inviter's row: the invitee's email redacted, everything else — including the
      // inviter's own ip — intact.
      const invited = await auditRowByAction(db, "organization.member.invited", other.id);
      expect(invited.after_state).toEqual({
        email: AUDIT_REDACTED,
        roleId,
        roleCode: "creator",
      });
      expect(invited.actor_ip).toBe("192.0.2.2");
      expect(invited.organization_id).toBe(org.id);

      // Target-only row: the actor's ip is the actor's data, and there is no subject email in
      // it — byte-identical after the purge.
      const removed = await auditRowByAction(db, "organization.member.removed", other.id);
      expect(removed.actor_ip).toBe("192.0.2.3");
      expect(removed.before_state).toEqual({ roleId, roleCode: "creator", status: "active" });
      expect(removed.target_user_id).toBe(subject.id);

      // Chained row: scrubbed like the rest, still linked.
      const dsar = await auditRowByAction(db, "compliance.dsar.requested", subject.id);
      expect(dsar.actor_ip).toBeNull();
      expect(dsar.actor_user_agent).toBeNull();
      expect(dsar.checksum).not.toBeNull();
      expect(dsar.hash_chain_valid).toBe(true);

      // Control row untouched.
      const control = await auditRowByAction(db, "auth.email_change.requested", other.id);
      expect(control.after_state).toEqual({ newEmail: other.email });

      // The chain walks the scrubbed row and finds it intact — asserted, not argued.
      const verification = await verifyAuditChains(db);
      expect(verification.rowsChecked).toBe(1);
      expect(verification.broken).toEqual([]);
      expect(verification.newlyFlagged).toBe(0);
    });
  });

  test("a blocked row's scrub rolls back with its DELETE, and the retry scrubs it for real", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await writeAuditLog({
        db,
        module: "core",
        actorId: owner.id,
        actorType: "user",
        action: "auth.email_change.requested",
        actorIp: "192.0.2.9",
        resourceType: "user",
        resourceId: owner.id,
        afterState: { newEmail: owner.email },
      });
      await db.execute(
        sql`UPDATE users SET deleted_at = now() - interval '31 days',
                             scheduled_deletion_at = now() - interval '1 day'
         WHERE id = ${owner.id}`,
      );

      // The org still exists, so the owner FK refuses — and the scrub must roll back with the
      // DELETE rather than half-erasing a user who was not erased.
      const blocked = await purgeExpiredAccounts(db);
      expect(blocked.deleted).toBe(0);
      expect(blocked.failed).toBe(1);
      expect(blocked.auditAnonymized).toBe(0);
      expect(await rowGone(db, "users", owner.id)).toBe(false);
      const intact = await auditRowByAction(db, "auth.email_change.requested", owner.id);
      expect(intact.actor_ip).toBe("192.0.2.9");
      expect(intact.after_state).toEqual({ newEmail: owner.email });

      // The next night's shape: org gone, reference cleared, erasure lands with its scrub.
      await db.execute(
        sql`UPDATE organizations SET deleted_at = now() - interval '31 days',
                                     scheduled_deletion_at = now() - interval '1 day'
         WHERE id = ${org.id}`,
      );
      expect((await purgeExpiredOrganizations(db)).deleted).toBe(1);
      const retried = await purgeExpiredAccounts(db);
      expect(retried).toEqual({ deleted: 1, failed: 0, errors: [], auditAnonymized: 1 });
      expect(await rowGone(db, "users", owner.id)).toBe(true);
      const scrubbed = await auditRowByAction(db, "auth.email_change.requested", owner.id);
      expect(scrubbed.actor_ip).toBeNull();
      expect(scrubbed.after_state).toEqual({ newEmail: AUDIT_REDACTED });
    });
  });

  test("anonymize is idempotent and safe on a missing user", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const subject = await createTestUser(db);
      await writeAuditLog({
        db,
        module: "core",
        actorId: subject.id,
        actorType: "user",
        action: "auth.email_change.requested",
        actorIp: "192.0.2.7",
        resourceType: "user",
        resourceId: subject.id,
        afterState: { newEmail: subject.email },
      });

      expect(await anonymizeAuditActorContext(db, { userId: subject.id })).toBe(1);
      const snapshot = await auditRowByAction(db, "auth.email_change.requested", subject.id);
      expect(snapshot.actor_ip).toBeNull();

      // Second run: nothing left to change, nothing written, zero claimed.
      expect(await anonymizeAuditActorContext(db, { userId: subject.id })).toBe(0);
      expect(await auditRowByAction(db, "auth.email_change.requested", subject.id)).toEqual(
        snapshot,
      );

      // The concurrent-purge case: the user is already gone, so there is nothing to do — and
      // nothing to throw about.
      expect(await anonymizeAuditActorContext(db, { userId: crypto.randomUUID() })).toBe(0);
    });
  });

  test("purging the inviter keeps the invitee's email — the value gate works both directions", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const inviter = await createTestUser(db);
      const invitee = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: invitee.id });
      await writeAuditLog({
        db,
        module: "core",
        organizationId: org.id,
        actorId: inviter.id,
        actorType: "user",
        action: "organization.member.invited",
        actorIp: "192.0.2.5",
        resourceType: "member",
        resourceId: crypto.randomUUID(),
        afterState: { email: invitee.email, roleCode: "creator" },
      });
      await db.execute(
        sql`UPDATE users SET deleted_at = now() - interval '31 days',
                             scheduled_deletion_at = now() - interval '1 day'
         WHERE id = ${inviter.id}`,
      );

      const outcome = await purgeExpiredAccounts(db);
      expect(outcome.deleted).toBe(1);
      // The row changed (the inviter's ip was nulled) but the invitee's email is not the
      // inviter's value, so it survives.
      expect(outcome.auditAnonymized).toBe(1);
      const invited = await auditRowByAction(db, "organization.member.invited", inviter.id);
      expect(invited.actor_ip).toBeNull();
      expect(invited.after_state).toEqual({ email: invitee.email, roleCode: "creator" });
      expect(await rowGone(db, "users", invitee.id)).toBe(false);
    });
  });

  test("the trigger allows the scrub and only the scrub", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAnonymizationTrigger(db);
      const subject = await createTestUser(db);
      await writeAuditLog({
        db,
        module: "core",
        actorId: subject.id,
        actorType: "user",
        action: "auth.email_change.requested",
        actorIp: "192.0.2.8",
        resourceType: "user",
        resourceId: subject.id,
        metadata: { expiresAt: "2030-01-01T00:00:00.000Z" },
      });
      const row = await auditRowByAction(db, "auth.email_change.requested", subject.id);

      // The NWB-P1-014 contract still holds under the new function: plain UPDATEs raise.
      const plainUpdate = await expectRejected(
        db,
        sql`UPDATE unified_audit_log SET action = 'tampered.action' WHERE id = ${row.id}`,
      );
      expect(String(plainUpdate)).toMatch(/NWB-P1-014/);
      const deleted = await expectRejected(
        db,
        sql`DELETE FROM unified_audit_log WHERE id = ${row.id}`,
      );
      expect(String(deleted)).toMatch(/NWB-P1-014/);

      // The flag flip still works.
      await db.execute(
        sql`UPDATE unified_audit_log SET hash_chain_valid = false WHERE id = ${row.id}`,
      );
      expect(
        (await auditRowByAction(db, "auth.email_change.requested", subject.id)).hash_chain_valid,
      ).toBe(false);
      await db.execute(
        sql`UPDATE unified_audit_log SET hash_chain_valid = true WHERE id = ${row.id}`,
      );

      // A PII change without the declared intent raises under the old message.
      const unflagged = await expectRejected(
        db,
        sql`UPDATE unified_audit_log SET actor_ip = NULL WHERE id = ${row.id}`,
      );
      expect(String(unflagged)).toMatch(/NWB-P1-014/);

      // With the flag: the scrub lands.
      await db.execute(sql.raw("SET LOCAL audit.anonymizing = 'on'"));
      await db.execute(
        sql`UPDATE unified_audit_log
            SET actor_ip = NULL, metadata = '{"expiresAt":"2030-01-01T00:00:00.000Z","email":"x"}'::jsonb
            WHERE id = ${row.id}`,
      );
      const scrubbed = await auditRowByAction(db, "auth.email_change.requested", subject.id);
      expect(scrubbed.actor_ip).toBeNull();

      // With the flag, out-of-scope columns still raise — including a combined flag flip, which
      // keeps the two sanctioned mutations disjoint.
      const smuggled = await expectRejected(
        db,
        sql`UPDATE unified_audit_log SET actor_ip = NULL, action = 'tampered.action' WHERE id = ${row.id}`,
      );
      expect(String(smuggled)).toMatch(/NWB-P1-015/);
      const combined = await expectRejected(
        db,
        sql`UPDATE unified_audit_log SET actor_ip = NULL, hash_chain_valid = false WHERE id = ${row.id}`,
      );
      expect(String(combined)).toMatch(/NWB-P1-015/);
      await db.execute(sql.raw("SET LOCAL audit.anonymizing = 'off'"));

      // And with the flag back off, a PII change raises again. (It must change something
      // real — setting an already-NULL column to NULL is a no-op UPDATE, which the trigger
      // correctly allows because it mutates nothing.)
      const relocked = await expectRejected(
        db,
        sql`UPDATE unified_audit_log SET metadata = '{"relocked":true}'::jsonb WHERE id = ${row.id}`,
      );
      expect(String(relocked)).toMatch(/NWB-P1-014/);
    });
  });
});
