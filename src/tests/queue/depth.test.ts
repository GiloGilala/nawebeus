/**
 * NWB-P1-012 — queue depth reading behind the readiness probe.
 *
 * `queueDepthFrom` is the pure sum (unit-tested here with a recording fake);
 * `getQueueDepth` is the one-line wrapper over the process-wide client, which
 * `src/tests/queue/loop.test.ts` exercises against a live pg-boss — that suite
 * owns the throwaway-schema rules this file deliberately does not touch.
 */
import { describe, expect, test } from "bun:test";
import type { PgBoss } from "pg-boss";
import { getQueueDepth, isQueueStarted, QUEUE_JOB_NAMES, queueDepthFrom } from "../../lib/queue";

const asBoss = (getQueues: () => Promise<unknown[]>) =>
  ({ getQueues }) as unknown as Pick<PgBoss, "getQueues">;

describe("queueDepthFrom", () => {
  test("sums ready/active/failed across the app's queues", async () => {
    const boss = asBoss(async () => [
      { name: "a", readyCount: 3, activeCount: 1, failedCount: 0 },
      { name: "b", readyCount: 2, activeCount: 0, failedCount: 4 },
    ]);
    expect(await queueDepthFrom(boss)).toEqual({ ready: 5, active: 1, failed: 4 });
  });

  test("no queue rows yet → all zeros, not an error", async () => {
    expect(await queueDepthFrom(asBoss(async () => []))).toEqual({
      ready: 0,
      active: 0,
      failed: 0,
    });
  });

  test("queries exactly this app's queue names by default", async () => {
    let seen: string[] = [];
    const boss = {
      getQueues: async (names?: string[]) => {
        seen = names ?? [];
        return [];
      },
    } as unknown as Pick<PgBoss, "getQueues">;
    await queueDepthFrom(boss);
    expect(seen).toEqual([...QUEUE_JOB_NAMES]);
  });
});

describe("getQueueDepth", () => {
  test("is undefined while this process runs no queue runtime", async () => {
    if (isQueueStarted()) {
      // Another suite (loop.test) owns the singleton right now; its own test
      // covers the started path.
      return;
    }
    expect(await getQueueDepth()).toBeUndefined();
  });
});
