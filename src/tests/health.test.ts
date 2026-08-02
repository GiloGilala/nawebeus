import { describe, expect, test } from "bun:test";
import { ValidationError } from "../lib/errors";
import { createTestApp } from "./helpers/test-client";

describe("health check", () => {
  test("GET /api/health returns 200 with status ok", async () => {
    const app = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { status: "ok" } });
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
