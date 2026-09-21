/**
 * Route-level invariant scan (NWB-P0-018, F-06).
 *
 * The org scoping of an ability is *not* enforced by CASL conditions — see the
 * comment in `src/services/auth/ability.ts`. What actually stops a caller from
 * reaching another tenant's data through a path parameter is
 * `requireOrgMatch()`, which compares the URL's `:orgId` with the JWT's org.
 *
 * That guard is applied by hand, once per route, which means a future route can
 * forget it and nothing would notice. This test is the thing that notices: it
 * reads the route files as text and fails when a registration whose path
 * contains `:orgId` has no `requireOrgMatch` covering it.
 *
 * Static scan, no database, no server — it costs milliseconds and catches an
 * IDOR by construction rather than by someone remembering to write a test.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(import.meta.dir, "..", "server", "api");
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "all"] as const;

type Registration = {
  file: string;
  method: string;
  path: string;
  /** Everything between the opening and closing parens of the registration. */
  args: string;
};

/** Returns the substring inside the parens opened at `openIndex`. */
function readCallArgs(source: string, openIndex: number): string | null {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

function collectRegistrations(source: string, file: string, methods: readonly string[]) {
  const found: Registration[] = [];
  for (const method of methods) {
    const needle = `.${method}(`;
    let from = 0;
    while (true) {
      const at = source.indexOf(needle, from);
      if (at === -1) break;
      from = at + needle.length;
      const args = readCallArgs(source, at + needle.length - 1);
      if (!args) continue;
      const pathMatch = args.match(/^\s*["'`]([^"'`]*)["'`]/);
      if (!pathMatch) continue;
      found.push({ file, method, path: pathMatch[1]!, args });
    }
  }
  return found;
}

/** A `router.use(pathPattern, …)` covers a route path when it matches it exactly
 *  or is a wildcard/prefix that contains it. */
function useCovers(usePath: string, routePath: string): boolean {
  if (usePath === routePath) return true;
  if (usePath === "*" || usePath === "/*") return true;
  if (usePath.endsWith("*")) return routePath.startsWith(usePath.slice(0, -1));
  return false;
}

function apiSourceFiles(): string[] {
  const glob = new Bun.Glob("**/*.ts");
  return [...glob.scanSync({ cwd: API_DIR, absolute: true })].sort();
}

describe("route invariants — static scan, no DB needed", () => {
  test("the scan actually finds the API route files (guards against a silent empty pass)", () => {
    const files = apiSourceFiles();
    expect(files.length).toBeGreaterThan(5);

    const registrations = files.flatMap((file) =>
      collectRegistrations(readFileSync(file, "utf8"), file, HTTP_METHODS),
    );
    expect(registrations.length).toBeGreaterThan(20);
  });

  test("every route with an :orgId path parameter is covered by requireOrgMatch", () => {
    const offenders: string[] = [];

    for (const file of apiSourceFiles()) {
      const source = readFileSync(file, "utf8");
      const uses = collectRegistrations(source, file, ["use"]);
      const routes = collectRegistrations(source, file, HTTP_METHODS);

      for (const route of routes) {
        if (!route.path.includes(":orgId")) continue;

        const guardedInline = route.args.includes("requireOrgMatch");
        const guardedByUse = uses.some(
          (u) => u.args.includes("requireOrgMatch") && useCovers(u.path, route.path),
        );

        if (!guardedInline && !guardedByUse) {
          offenders.push(`${route.method.toUpperCase()} ${route.path} (${route.file})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test("at least one :orgId route exists, so the invariant above is not vacuous", () => {
    const orgScoped = apiSourceFiles()
      .flatMap((file) => collectRegistrations(readFileSync(file, "utf8"), file, HTTP_METHODS))
      .filter((r) => r.path.includes(":orgId"));

    expect(orgScoped.length).toBeGreaterThan(0);
  });

  test("an unguarded :orgId route would be caught (negative control)", () => {
    const fabricated = `
      const router = new Hono();
      router.get("/orgs/:orgId/secrets", authMiddleware, (c) => c.json({}));
    `;
    const uses = collectRegistrations(fabricated, "fabricated.ts", ["use"]);
    const routes = collectRegistrations(fabricated, "fabricated.ts", HTTP_METHODS).filter((r) =>
      r.path.includes(":orgId"),
    );

    expect(routes.length).toBe(1);
    const route = routes[0]!;
    const guarded =
      route.args.includes("requireOrgMatch") ||
      uses.some((u) => u.args.includes("requireOrgMatch") && useCovers(u.path, route.path));
    expect(guarded).toBe(false);
  });
});
