/**
 * The email outbox job — NWB-P1-004.
 *
 * The transport is injected, so the handler's three verdicts are pinned without a provider:
 * delivered (success row with the provider's id), refused for good (a `{ failed: 1 }` outcome the
 * wrapper files as `email.delivery_failed` — and does **not** retry), and refused for now (thrown,
 * so pg-boss retries). The last two tests run the real audit sink against PostgreSQL and read the
 * row back: scoped to the payload's organization and user, recipient masked, no address anywhere.
 */
import { describe, expect, test } from "bun:test";
import { type SQL, sql } from "drizzle-orm";
import {
  createEmailDeliverJob,
  EMAIL_DELIVER_POLICY,
  emailDeliverJob,
} from "../../jobs/email-deliver";
import type { Db } from "../../lib/db";
import { EmailDeliveryError } from "../../lib/errors";
import { QUEUE_JOBS, QUEUE_POLICY_DEFAULTS } from "../../lib/queue";
import { type JobAttempt, runJobGuarded, type WorkerDeps } from "../../lib/worker";
import { type WriteAuditLogEntryParams, writeAuditLog } from "../../services/audit";
import type { EmailEnvelope } from "../../services/email";
import { withTestDb } from "../helpers/test-db";
import { createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const ATTEMPT: JobAttempt = { id: "email-job-1", attempt: 1, retryCount: 0, retryLimit: 6 };

const envelope = (overrides: Partial<EmailEnvelope> = {}): EmailEnvelope => ({
  messageId: "em_job_test",
  kind: "invitation",
  to: ["invitee@example.com"],
  subject: "You've been invited",
  html: "<p>Accept</p>",
  organizationId: "org_1",
  userId: "usr_1",
  createdAt: "2026-09-22T10:00:00.000Z",
  ...overrides,
});

function recordingDeps(events: WriteAuditLogEntryParams[]): WorkerDeps {
  return {
    db: {} as Db,
    audit: async (params) => {
      events.push(params);
    },
  };
}

async function selectOne<T>(db: Db, query: SQL): Promise<T | undefined> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: T[] }).rows?.[0];
}

describe("email.deliver — definition", () => {
  test("is the on-demand queue with the outbox policy: six backed-off retries, short expiry, one-hour retention", () => {
    expect(emailDeliverJob.name).toBe(QUEUE_JOBS.emailDeliver);
    expect(emailDeliverJob.policy).toEqual(EMAIL_DELIVER_POLICY);
    expect(EMAIL_DELIVER_POLICY).toEqual({
      retryLimit: 6,
      retryDelay: 60,
      retryBackoff: true,
      expireInSeconds: 60,
      deleteAfterSeconds: 3_600,
    });
    // Payloads carry raw token links; the default 7-day retention of completed jobs would keep
    // them around long after the tokens themselves had been hashed and consumed.
    expect(EMAIL_DELIVER_POLICY.deleteAfterSeconds).toBeLessThan(7 * 24 * 3_600);
    expect(EMAIL_DELIVER_POLICY.retryLimit).toBeGreaterThan(QUEUE_POLICY_DEFAULTS.retryLimit ?? 0);
  });

  test("names its failures separately and scopes its rows to the payload, masked", () => {
    expect(emailDeliverJob.audit.action).toBe("email.delivered");
    expect(emailDeliverJob.audit.failureAction).toBe("email.delivery_failed");
    const scope = emailDeliverJob.audit.scope?.(envelope());
    expect(scope).toEqual({
      organizationId: "org_1",
      targetUserId: "usr_1",
      resourceId: "em_job_test",
      metadata: { kind: "invitation", recipient: "i***@example.com", provider: "console" },
    });
    expect(JSON.stringify(scope)).not.toContain("invitee@example.com");
  });
});

describe("email.deliver — handler through the wrapper", () => {
  test("delivered: success outcome with the provider's id, filed as email.delivered", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const delivered: EmailEnvelope[] = [];
    const job = createEmailDeliverJob({
      deliver: async (env) => {
        delivered.push(env);
        return { provider: "fake", providerMessageId: "re_abc" };
      },
      providerName: () => "fake",
    });

    const outcome = await runJobGuarded(job, recordingDeps(events), ATTEMPT, envelope());

    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.messageId).toBe("em_job_test");
    expect(outcome).toEqual({ delivered: 1, provider: "fake", providerMessageId: "re_abc" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "email.delivered",
      severity: "info",
      organizationId: "org_1",
      targetUserId: "usr_1",
      resourceId: "em_job_test",
      afterState: { delivered: 1, provider: "fake", providerMessageId: "re_abc" },
    });
    expect(events[0]?.metadata).toMatchObject({
      kind: "invitation",
      recipient: "i***@example.com",
    });
  });

  test("a final rejection is recorded, not retried: no throw, email.delivery_failed at warning", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const job = createEmailDeliverJob({
      deliver: async () => {
        throw new EmailDeliveryError("resend: 422 validation_error: bad sender", false, {
          provider: "resend",
          status: 422,
          providerCode: "validation_error",
        });
      },
      providerName: () => "resend",
    });

    const outcome = await runJobGuarded(job, recordingDeps(events), ATTEMPT, envelope());

    expect(outcome).toEqual({
      delivered: 0,
      failed: 1,
      provider: "resend",
      status: 422,
      providerCode: "validation_error",
      error: "resend: 422 validation_error: bad sender",
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("email.delivery_failed");
    expect(events[0]?.severity).toBe("warning");
    expect(events[0]?.organizationId).toBe("org_1");
  });

  test("a retryable rejection is rethrown so pg-boss retries, and the failure is still filed", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const job = createEmailDeliverJob({
      deliver: async () => {
        throw new EmailDeliveryError("resend: 503: down", true, {
          provider: "resend",
          status: 503,
        });
      },
    });

    await expect(runJobGuarded(job, recordingDeps(events), ATTEMPT, envelope())).rejects.toThrow(
      "resend: 503: down",
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("email.delivery_failed");
    expect(events[0]?.severity).toBe("warning");

    // The budget spent: the same failure is an alarm.
    events.length = 0;
    await expect(
      runJobGuarded(
        job,
        recordingDeps(events),
        { ...ATTEMPT, retryCount: 6, attempt: 7 },
        envelope(),
      ),
    ).rejects.toThrow();
    expect(events[0]?.severity).toBe("critical");
  });

  test("an unclassified transport error is treated as retryable — a lost email costs more than a duplicate", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    const job = createEmailDeliverJob({
      deliver: async () => {
        throw new TypeError("fetch is not a function");
      },
    });
    await expect(runJobGuarded(job, recordingDeps(events), ATTEMPT, envelope())).rejects.toThrow(
      TypeError,
    );
    expect(events[0]?.action).toBe("email.delivery_failed");
  });

  test("a payload the handler cannot act on is a final failure, never a retry loop", async () => {
    const events: WriteAuditLogEntryParams[] = [];
    let calls = 0;
    const job = createEmailDeliverJob({
      deliver: async () => {
        calls += 1;
        return { provider: "fake" };
      },
    });

    for (const bad of [
      null,
      {},
      { messageId: "em_x" },
      { messageId: "em_x", to: [] },
      { messageId: "em_x", to: ["a@b.co"], subject: "s" },
      { messageId: "em_x", to: ["a@b.co"], subject: "s", html: "<p/>" },
    ]) {
      const outcome = await runJobGuarded(job, recordingDeps(events), ATTEMPT, bad as never);
      expect(outcome?.failed).toBe(1);
    }
    expect(calls).toBe(0);
    expect(events.every((event) => event.action === "email.delivery_failed")).toBe(true);
  });
});

describe.skipIf(!hasDb())("email.deliver — the real audit sink", () => {
  test("a delivered email lands as a tenant-scoped row with a masked recipient and the provider id", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      const invitee = await createTestUser(db, {
        email: `invitee-${crypto.randomUUID().slice(0, 8)}@example.com`,
      });
      const jobId = `email-audit-${crypto.randomUUID().slice(0, 8)}`;
      const job = createEmailDeliverJob({
        deliver: async () => ({ provider: "resend", providerMessageId: "re_db_1" }),
        providerName: () => "resend",
      });

      await runJobGuarded(
        job,
        { db, audit: (params) => writeAuditLog(params) },
        { id: jobId, attempt: 1 },
        envelope({
          messageId: "em_db_1",
          to: [invitee.email],
          organizationId: org.id,
          userId: invitee.id,
        }),
      );

      const row = await selectOne<{
        action: string;
        severity: string;
        category: string;
        resource_type: string;
        resource_id: string;
        organization_id: string;
        target_user_id: string;
        actor_type: string;
        after_state: Record<string, unknown>;
        metadata: Record<string, unknown>;
        raw: string;
      }>(
        db,
        sql`SELECT action, severity, category, resource_type, resource_id, organization_id,
                   target_user_id, actor_type, after_state, metadata, row_to_json(unified_audit_log)::text AS raw
             FROM unified_audit_log WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );

      expect(row).toMatchObject({
        action: "email.delivered",
        severity: "info",
        category: "user_management",
        resource_type: "email",
        resource_id: "em_db_1",
        organization_id: org.id,
        target_user_id: invitee.id,
        actor_type: "system",
        after_state: { delivered: 1, provider: "resend", providerMessageId: "re_db_1" },
      });
      expect(row?.metadata).toMatchObject({
        queue: "email.deliver",
        jobId,
        kind: "invitation",
        provider: "resend",
        recipient: `i***@example.com`,
      });
      // The whole row, serialised: no address, no body.
      expect(row?.raw).not.toContain(invitee.email);
      expect(row?.raw).not.toContain("<p>Accept</p>");
    });
  });

  test("a final rejection lands as email.delivery_failed, warning, same scope", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      const jobId = `email-audit-fail-${crypto.randomUUID().slice(0, 8)}`;
      const job = createEmailDeliverJob({
        deliver: async () => {
          throw new EmailDeliveryError("resend: 403 validation_error: domain not verified", false, {
            provider: "resend",
            status: 403,
            providerCode: "validation_error",
          });
        },
        providerName: () => "resend",
      });

      const outcome = await runJobGuarded(
        job,
        { db, audit: (params) => writeAuditLog(params) },
        { id: jobId, attempt: 1 },
        envelope({ messageId: "em_db_2", organizationId: org.id, userId: owner.id }),
      );
      expect(outcome?.failed).toBe(1);

      const row = await selectOne<{
        action: string;
        severity: string;
        organization_id: string;
        target_user_id: string;
        after_state: Record<string, unknown>;
      }>(
        db,
        sql`SELECT action, severity, organization_id, target_user_id, after_state
             FROM unified_audit_log WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );
      expect(row).toMatchObject({
        action: "email.delivery_failed",
        severity: "warning",
        organization_id: org.id,
        target_user_id: owner.id,
        after_state: { failed: 1, status: 403, providerCode: "validation_error" },
      });
    });
  });
});
