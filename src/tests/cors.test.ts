import { describe, expect, test } from "bun:test";
import { DEFAULT_CORS_ORIGIN } from "../lib/config";
import { createTestApp } from "./helpers/test-client";

/**
 * CORS allow-list behaviour (NWB-P0-017 / F-13). All through the health
 * endpoint with the no-op DB — CORS is decided before any route touches the
 * database, so no fixtures are needed.
 */
describe("CORS origin allow-list", () => {
  const preflight = (app: ReturnType<typeof createTestApp>, origin: string) =>
    app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

  test("preflight from an allowed origin succeeds with the origin echoed", async () => {
    const res = await preflight(createTestApp(), DEFAULT_CORS_ORIGIN);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(DEFAULT_CORS_ORIGIN);
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  test("preflight from an unlisted origin carries no ACAO header", async () => {
    const res = await preflight(createTestApp(), "https://evil.example.com");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("simple request with an allowed origin gets ACAO; unlisted gets none", async () => {
    const app = createTestApp();
    const ok = await app.request("/api/health", {
      headers: { Origin: DEFAULT_CORS_ORIGIN },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(DEFAULT_CORS_ORIGIN);

    const denied = await app.request("/api/health", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(denied.status).toBe(200);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("requests without an Origin header pass through untouched", async () => {
    const res = await createTestApp().request("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("injected allow-list governs matching (production wiring shape)", async () => {
    const app = createTestApp(undefined, ["https://app.nawebeus.com"]);
    const ok = await preflight(app, "https://app.nawebeus.com");
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://app.nawebeus.com");

    // The dev default is not on this list anymore.
    const denied = await preflight(app, DEFAULT_CORS_ORIGIN);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
