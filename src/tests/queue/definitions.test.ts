/**
 * Job-set and schedule invariants — the static half of NWB-P1-001.
 *
 * These read like trivia until you notice what each one is guarding:
 *
 * - a declared queue with no definition is a schedule that fires into nothing, and nothing in
 *   pg-boss reports that as an error — the queue just stays empty forever;
 * - the nightly **order** (organizations before accounts) is what keeps one un-purgeable owner from
 *   wedging every other erasure that night, and it is the kind of thing a "tidy" alphabetical sort
 *   of a list silently undoes;
 * - audit `action` strings are queryable names, so a rename is a data migration.
 */
import { describe, expect, test } from "bun:test";
import { MAINTENANCE_JOBS } from "../../jobs";
import type { Config } from "../../lib/config";
import {
  isQueueJobName,
  isScheduledQueueJobName,
  ON_DEMAND_QUEUE_JOB_NAMES,
  QUEUE_JOB_NAMES,
  QUEUE_JOBS,
  QUEUE_POLICY_DEFAULTS,
  type QueueJobName,
  SCHEDULED_QUEUE_JOB_NAMES,
} from "../../lib/queue";
import { QUEUE_SCHEDULE_DEFAULTS, resolveSchedules } from "../../lib/scheduler";
import { assertJobSetIsComplete, validateJobDefinitions } from "../../lib/worker";
import type { AuditActionName } from "../../services/audit";

/**
 * A `Config` carrying only what `resolveSchedules` reads.
 *
 * Deliberately not `loadConfig()`: calling it with a partial env would replace the process-wide
 * singleton every other suite reads, and `getConfig()` would throw outright when `DATABASE_URL` is
 * unset — which is the state these no-DB tests run in.
 */
const scheduleConfig = (overrides: Partial<Config> = {}): Config =>
  ({ QUEUE_TIMEZONE: "UTC", ...overrides }) as Config;

describe("queue job set", () => {
  test("every declared queue has a definition — no schedule fires into nothing", () => {
    expect(MAINTENANCE_JOBS.map((job) => job.name)).toEqual([...QUEUE_JOB_NAMES]);
    expect(() => assertJobSetIsComplete(MAINTENANCE_JOBS)).not.toThrow();
  });

  test("a missing definition is refused at startup, by name", () => {
    const withoutAccounts = MAINTENANCE_JOBS.filter(
      (job) => job.name !== QUEUE_JOBS.purgeExpiredAccounts,
    );
    expect(() => assertJobSetIsComplete(withoutAccounts)).toThrow(
      new RegExp(QUEUE_JOBS.purgeExpiredAccounts),
    );
  });

  test("names are recognised by the guard and rejected for unknown queues", () => {
    for (const name of QUEUE_JOB_NAMES) expect(isQueueJobName(name)).toBe(true);
    expect(isQueueJobName("maintenance.does-not-exist")).toBe(false);
  });

  test("every queue is either scheduled or on-demand, never both, and the scheduled ones come first", () => {
    // The email outbox (NWB-P1-004) is the first queue a cron does not drive. It still needs a
    // worker — `assertJobSetIsComplete` covers all eight — but it must never gain a schedule row:
    // an occurrence with a `null` payload is a job the handler cannot run.
    expect([...QUEUE_JOB_NAMES]).toEqual([
      ...SCHEDULED_QUEUE_JOB_NAMES,
      ...ON_DEMAND_QUEUE_JOB_NAMES,
    ]);
    expect([...ON_DEMAND_QUEUE_JOB_NAMES]).toEqual([QUEUE_JOBS.emailDeliver]);
    for (const name of SCHEDULED_QUEUE_JOB_NAMES) expect(isScheduledQueueJobName(name)).toBe(true);
    for (const name of ON_DEMAND_QUEUE_JOB_NAMES) expect(isScheduledQueueJobName(name)).toBe(false);
    expect(Object.keys(QUEUE_SCHEDULE_DEFAULTS).sort()).toEqual(
      [...SCHEDULED_QUEUE_JOB_NAMES].sort(),
    );
  });

  test("organizations purge before accounts, and the reason is the owner FK (F-25/D16)", () => {
    const order = MAINTENANCE_JOBS.map((job) => job.name);
    expect(order.indexOf(QUEUE_JOBS.purgeExpiredOrganizations)).toBeLessThan(
      order.indexOf(QUEUE_JOBS.purgeExpiredAccounts),
    );
    expect(order.indexOf(QUEUE_JOBS.rateLimitReclaim)).toBe(0);
    // Chain verification walks the night's complete set, so it runs after the last mutation —
    // last of the *scheduled* jobs; the on-demand outbox follows because it is not in the night.
    expect(order.indexOf(QUEUE_JOBS.auditChainVerify)).toBe(SCHEDULED_QUEUE_JOB_NAMES.length - 1);
    expect(order.indexOf(QUEUE_JOBS.emailDeliver)).toBe(order.length - 1);
  });

  test("the approval expiry is hourly and sits outside the nightly chain (NWB-P1-003)", () => {
    // Hourly, because an approval window can be as short as an hour; second in the list, because
    // it touches rows none of the purges reference and its 02:00 firing coincides with
    // reclamation — the one slot that is not load-bearing.
    expect(QUEUE_SCHEDULE_DEFAULTS[QUEUE_JOBS.approvalsExpireStale]).toBe("0 * * * *");
    const order = MAINTENANCE_JOBS.map((job) => job.name);
    expect(order.indexOf(QUEUE_JOBS.approvalsExpireStale)).toBe(1);
    const job = MAINTENANCE_JOBS.find((entry) => entry.name === QUEUE_JOBS.approvalsExpireStale);
    expect(job?.audit).toEqual({
      action: "approvals.expired",
      category: "content",
      resourceType: "approval_request",
    });
  });

  test("the social token refresh is five-minute and sits with the minutes-scale jobs (NWB-P2-002)", () => {
    // Provider clocks are hours at most (Google: one), so a nightly-only sweep would wake up
    // to a fully dead account list; the window is only as fresh as the last tick.
    expect(QUEUE_SCHEDULE_DEFAULTS[QUEUE_JOBS.socialTokenRefresh]).toBe("*/5 * * * *");
    const order = MAINTENANCE_JOBS.map((job) => job.name);
    expect(order.indexOf(QUEUE_JOBS.socialTokenRefresh)).toBe(
      order.indexOf(QUEUE_JOBS.impersonationExpire) + 1,
    );
    const job = MAINTENANCE_JOBS.find((entry) => entry.name === QUEUE_JOBS.socialTokenRefresh);
    expect(job?.audit).toEqual({
      action: "socialaccounts.refreshed",
      category: "data_ops",
      resourceType: "social_account",
    });
  });

  test("invitations purge between the purges — member rows cascade on both ends (NWB-P1-016)", () => {
    const order = MAINTENANCE_JOBS.map((job) => job.name);
    // After the org purge (invites of just-purged workspaces are already gone), before the
    // account purge (a same-night-erased user's lapsed invite gets its own scrub instead of
    // vanishing in the user cascade) — see `src/lib/scheduler.ts`.
    expect(order.indexOf(QUEUE_JOBS.purgeExpiredOrganizations)).toBeLessThan(
      order.indexOf(QUEUE_JOBS.purgeExpiredInvitations),
    );
    expect(order.indexOf(QUEUE_JOBS.purgeExpiredInvitations)).toBeLessThan(
      order.indexOf(QUEUE_JOBS.purgeExpiredAccounts),
    );
  });

  test("retention enforcement runs after the purges and before verification (NWB-P1-010)", () => {
    const order = MAINTENANCE_JOBS.map((job) => job.name);
    // After the purges so the census reads the night's final state; before verification so its
    // audit rows join the walked set — see `src/lib/scheduler.ts`.
    expect(order.indexOf(QUEUE_JOBS.purgeExpiredAccounts)).toBeLessThan(
      order.indexOf(QUEUE_JOBS.retentionEnforce),
    );
    expect(order.indexOf(QUEUE_JOBS.retentionEnforce)).toBeLessThan(
      order.indexOf(QUEUE_JOBS.auditChainVerify),
    );
  });

  test("audit descriptors are `<resource>.<verb>`, unique, and drawn from the enum this table uses", () => {
    const categories = new Set([
      "authentication",
      "authorization",
      "user_management",
      "content",
      "billing",
      "security",
      "compliance",
      "system_config",
      "feature_flag",
      "engagement",
      "publishing",
      "listening",
      "data_ops",
    ]);
    const actions = new Set<string>();

    for (const job of MAINTENANCE_JOBS) {
      expect(job.audit.action).toMatch(/^[a-z][a-z-]*\.[a-z][a-z-]*$/);
      expect(categories.has(job.audit.category)).toBe(true);
      expect(job.audit.resourceType.length).toBeGreaterThan(1);
      expect(actions.has(job.audit.action)).toBe(false);
      actions.add(job.audit.action);
    }
  });

  test("descriptions exist — `queue:run --list` is the operator's only documentation", () => {
    for (const job of MAINTENANCE_JOBS) {
      expect(job.description.trim().length).toBeGreaterThan(20);
    }
  });
});

describe("validateJobDefinitions", () => {
  const job = (name: QueueJobName, action: AuditActionName = "rate-limits.reclaimed") => ({
    name,
    description: "a test job",
    audit: { action, category: "data_ops" as const, resourceType: "thing" },
    handle: async () => ({}),
  });

  test("rejects two definitions for one queue — the second worker would silently replace the first", () => {
    expect(() =>
      validateJobDefinitions([job(QUEUE_JOBS.rateLimitReclaim), job(QUEUE_JOBS.rateLimitReclaim)]),
    ).toThrow(/duplicate job definition/);
  });

  test("rejects an empty audit action, which would write an unattributable row", () => {
    expect(() =>
      validateJobDefinitions([job(QUEUE_JOBS.rateLimitReclaim, "   " as AuditActionName)]),
    ).toThrow(/no audit action/);
  });

  test("rejects a definition without a handler", () => {
    const broken = { ...job(QUEUE_JOBS.rateLimitReclaim), handle: undefined };
    expect(() => validateJobDefinitions([broken as never])).toThrow(/no handler/);
  });

  test("accepts a well-formed set", () => {
    expect(() => validateJobDefinitions([job(QUEUE_JOBS.rateLimitReclaim)])).not.toThrow();
  });
});

describe("queue policy", () => {
  test("defaults retry with exponential backoff", () => {
    expect(QUEUE_POLICY_DEFAULTS).toMatchObject({
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
    });
  });

  test("reclamation bounds its own runtime well under the 15-minute default expiry", () => {
    // The claim under test is the *rationale*, not the number: a job that dies with the process
    // should be retried soon rather than after the library default.
    expect(
      (MAINTENANCE_JOBS.find((entry) => entry.name === QUEUE_JOBS.rateLimitReclaim)?.policy ?? {})
        .expireInSeconds,
    ).toBeLessThan(QUEUE_POLICY_DEFAULTS.expireInSeconds ?? 900);
  });

  test("the purge jobs inherit the defaults rather than inventing a policy of their own", () => {
    expect(
      MAINTENANCE_JOBS.find((job) => job.name === QUEUE_JOBS.purgeExpiredAccounts)?.policy,
    ).toBeUndefined();
  });
});

describe("resolveSchedules", () => {
  test("returns one entry per scheduled queue, on the shipped crons, in one timezone", () => {
    const schedules = resolveSchedules(scheduleConfig());
    expect(schedules.map((entry) => entry.job)).toEqual([...SCHEDULED_QUEUE_JOB_NAMES]);
    expect(schedules.map((entry) => entry.job)).not.toContain(QUEUE_JOBS.emailDeliver);
    for (const entry of schedules) {
      expect(entry.cron).toBe(QUEUE_SCHEDULE_DEFAULTS[entry.job]);
      expect(entry.tz).toBe("UTC");
      // A missed night of retention enforcement is a compliance clock that stopped: run it.
      expect(entry.missed).toBe("once");
      expect(entry.data).toBeNull();
    }
  });

  test("one env override changes exactly that schedule", () => {
    const schedules = resolveSchedules(
      scheduleConfig({ QUEUE_CRON_PURGE_EXPIRED_ACCOUNTS: "*/10 * * * *" }),
    );
    const accounts = schedules.find((entry) => entry.job === QUEUE_JOBS.purgeExpiredAccounts);
    const orgs = schedules.find((entry) => entry.job === QUEUE_JOBS.purgeExpiredOrganizations);
    expect(accounts?.cron).toBe("*/10 * * * *");
    expect(orgs?.cron).toBe(QUEUE_SCHEDULE_DEFAULTS[QUEUE_JOBS.purgeExpiredOrganizations]);
  });

  test("the timezone is shared, so a deployment moves the whole night at once", () => {
    const schedules = resolveSchedules(scheduleConfig({ QUEUE_TIMEZONE: "Africa/Lagos" }));
    expect(new Set(schedules.map((entry) => entry.tz))).toEqual(new Set(["Africa/Lagos"]));
  });
});
