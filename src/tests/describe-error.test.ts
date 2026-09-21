/**
 * `describeError` — the formatter the queue runtime logs through (NWB-P1-001).
 *
 * The reason this exists at all is a real one: a refused connection arrives as an
 * `AggregateError` with an **empty** `message`, so the first cut of the API's
 * "WORKER NOT STARTED" line printed nothing but the prefix. Every case below is a shape
 * that actually showed up while wiring the runtime, not a hypothetical.
 */
import { describe, expect, test } from "bun:test";
import { describeError } from "../lib/errors";

describe("describeError", () => {
  test("a plain Error reads as its message", () => {
    expect(describeError(new Error("queue table missing"))).toBe("queue table missing");
  });

  test("a named error keeps its name, which is usually the only clue", () => {
    class QueueUnavailable extends Error {
      override readonly name = "QueueUnavailable";
    }
    expect(describeError(new QueueUnavailable("no pool"))).toBe("QueueUnavailable no pool");
  });

  test("an AggregateError with no message of its own still says what happened", () => {
    const aggregate = new AggregateError([new Error("connect ECONNREFUSED 127.0.0.1:5432")]);
    Object.assign(aggregate, { code: "ECONNREFUSED" });

    const described = describeError(aggregate);
    expect(described).toContain("AggregateError");
    expect(described).toContain("(ECONNREFUSED)");
    expect(described).toContain("connect ECONNREFUSED 127.0.0.1:5432");
    // The bug this test pins: the message alone was "".
    expect(aggregate.message).toBe("");
  });

  test("a code with no nested errors is enough on its own", () => {
    const error = Object.assign(new Error(""), { code: "ETIMEDOUT" });
    expect(describeError(error)).toBe("(ETIMEDOUT)");
  });

  test("an error with nothing in it says so rather than printing nothing", () => {
    expect(describeError(new Error(""))).toBe("Error (no message)");
  });

  test("non-Error throw values are stringified", () => {
    expect(describeError("pg-boss is stopped")).toBe("pg-boss is stopped");
    expect(describeError(undefined)).toBe("undefined");
    expect(describeError({ weird: true })).toBe("[object Object]");
    // Drivers do throw bare strings and empty objects; a bare `""` must still be legible.
    expect(describeError("")).toBe('string value: ""');
  });

  test("never returns an empty string", () => {
    for (const value of [new Error(""), null, undefined, 0, ""]) {
      expect(describeError(value).length).toBeGreaterThan(0);
    }
  });
});
