import { describe, expect, test } from "bun:test";
import { ValidationError } from "../lib/errors";
import { createTestApp } from "./helpers/test-client";

describe("health check", () => {
  test("GET /api/health returns 200 with a readiness report", async () => {
    const app = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.checks.database.status).toBe("ok");
    expect(typeof body.data.checks.database.latencyMs).toBe("number");
    // No queue runtime in a plain test app — a legal state, not a fault (ADR-007).
    expect(body.data.checks.queue.status).toBe("disabled");
  });

  test("the probe echoes the correlation id like every other response", async () => {
    const app = createTestApp();
    const res = await app.request("/api/health", { headers: { "x-request-id": "probe-1" } });
    expect(res.headers.get("x-request-id")).toBe("probe-1");
  });
});

describe("not found", () => {
  test("non-existent route returns 404 with error envelope", async () => {
    const app = createTestApp();
    const res = await app.request("/api/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("error handler", () => {
  test("validation error returns 422 with field details", async () => {
    const app = createTestApp();
    app.get("/api/test-validation-error", () => {
      throw new ValidationError("Invalid input", [
        { field: "email", message: "must be a valid email" },
      ]);
    });

    const res = await app.request("/api/test-validation-error");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details[0].field).toBe("email");
  });
});
