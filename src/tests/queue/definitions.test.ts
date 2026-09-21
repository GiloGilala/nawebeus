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
  QUEUE_JOB_NAMES,
  QUEUE_JOBS,
  QUEUE_POLICY_DEFAULTS,
  type QueueJobName,
} from "../../lib/queue";
import { QUEUE_SCHEDULE_DEFAULTS, resolveSchedules } from "../../lib/scheduler";
import { assertJobSetIsComplete, validateJobDefinitions } from "../../lib/worker";

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

  test("organizations purge before accounts, and the reason is the owner FK (F-25/D16)", () => {
    const order = MAINTENANCE_JOBS.map((job) => job.name);
    expect(order.indexOf(QUEUE_JOBS.purgeExpiredOrganizations)).toBeLessThan(
      order.indexOf(QUEUE_JOBS.purgeExpiredAccounts),
    );
    expect(order.indexOf(QUEUE_JOBS.rateLimitReclaim)).toBe(0);
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
  const job = (name: QueueJobName, action = "thing.done") => ({
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
    expect(() => validateJobDefinitions([job(QUEUE_JOBS.rateLimitReclaim, "   ")])).toThrow(
      /no audit action/,
    );
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
  test("returns one entry per declared queue, on the shipped crons, in one timezone", () => {
    const schedules = resolveSchedules(scheduleConfig());
    expect(schedules.map((entry) => entry.job)).toEqual([...QUEUE_JOB_NAMES]);
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
