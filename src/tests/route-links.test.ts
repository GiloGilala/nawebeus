/**
 * Dangling-link scan (NWB-P14.2) — the invariant that two shipped defects broke.
 *
 * Twice now a service has told a human to open a URL that nothing served:
 *
 * - `invitation.service.ts` has built `${APP_BASE_URL_RESOLVED}/invite?token=…` into every
 *   invitation email since NWB-P0-021, and `src/tests/email-links.test.ts` pins that *string*. No
 *   route answered it, so every invitee who clicked the button in their email got a 404 while the
 *   working `POST /api/auth/invitations/:token/accept` sat uncalled.
 * - `social.route.ts`'s OAuth callback has 302'd to `/settings/integrations?connected=<platform>`
 *   since NWB-P2-001; the route arrived with NWB-P14.3.
 *
 * Both survived because the tests that existed checked the link was *well-formed*, which is the
 * opposite of the property that matters: a link is only useful if something is on the other end. A
 * string assertion cannot see that, and no browser runs here to find out. This scan can, cheaply,
 * without either.
 *
 * It reads the source as text and answers two questions:
 *
 *  1. Every path a **service** hangs off `APP_BASE_URL_RESOLVED` resolves to something — a screen
 *     under `src/app/routes/` for a UI path, a registered Hono route for an `/api/` path.
 *  2. Every `to="…"` / `redirect({ to: "…" })` target in a **route** resolves to a route file.
 *
 * Both directions matter: (1) catches the emailed-link class above, (2) catches the in-app
 * navigation equivalent — a `<Link>` to a screen nobody built, which renders as a dead click rather
 * than a 404 and is therefore *less* likely to be reported.
 *
 * Known-unbuilt targets live in `KNOWN_UNBUILT` with the ticket that owns them. That list is
 * asserted to still be dangling, so it cannot rot: build the screen and this suite tells you to
 * delete the entry, rather than quietly keeping a stale excuse alive.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..");
const ROUTES = join(SRC, "app", "routes");
const API = join(SRC, "server", "api");
const SERVICES = join(SRC, "services");

/**
 * Targets that are genuinely unbuilt, with the ticket that owns them.
 *
 * These are P14.1's (the auth cluster's) residue, not P14.2's: password reset and email change have
 * working services, working HTTP routes and emailed links, and no screens. Building them here would
 * mean shipping three auth screens inside a team-management ticket; they are recorded instead, and
 * the assertion below keeps the record honest.
 */
const KNOWN_UNBUILT: { path: string; ticket: string }[] = [
  { path: "/reset-password", ticket: "P14.1 — auth cluster (password-reset screen)" },
  { path: "/change-email/confirm", ticket: "P14.1 — auth cluster (email-change confirm screen)" },
];

function walk(dir: string, accept: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full, accept));
    else if (accept(entry)) found.push(full);
  }
  return found;
}

/**
 * Does a route file serve `path`? TanStack Router's file conventions, restricted to the two this
 * repo uses: `routes/<path>.tsx` and `routes/<path>/index.tsx`. Query strings are stripped and a
 * trailing slash ignored, because `/settings/integrations?connected=youtube` and
 * `/dashboard/` both name a real screen.
 */
/** `noUncheckedIndexedAccess` makes every `split(…)[0]` a maybe; a split always has a first part. */
function head(parts: string[]): string {
  return parts[0] ?? "";
}

function routeExists(path: string): boolean {
  const clean = head(path.split("?")).replace(/\/+$/, "") || "/";
  if (clean === "/") return existsSync(join(ROUTES, "index.tsx"));
  const withoutLeading = clean.slice(1);
  return (
    existsSync(join(ROUTES, `${withoutLeading}.tsx`)) ||
    existsSync(join(ROUTES, withoutLeading, "index.tsx"))
  );
}

/** Every path a service builds off the app's public base URL. */
function serviceLinks(): { file: string; path: string }[] {
  const pattern = /APP_BASE_URL_RESOLVED\}(\/[^\s`"'${}]*)/g;
  const found: { file: string; path: string }[] = [];
  for (const file of walk(SERVICES, (name) => name.endsWith(".ts"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      // `${…}` interpolations inside the captured path (a platform segment, a token) are not
      // literal route text; keep the literal prefix, which is what has to resolve. The query string
      // goes too — `/invite?token=` names the same screen as `/invite`.
      const path = head(head((match[1] ?? "").split("${")).split("?")).replace(/\/+$/, "");
      if (path) found.push({ file, path });
    }
  }
  return found;
}

/** Every `to="…"` / `to: "…"` navigation target in a route file. */
function navigationTargets(): { file: string; path: string }[] {
  const pattern = /\bto[=:]?\s*["'{]?\s*["'](\/[^"']*)["']/g;
  const found: { file: string; path: string }[] = [];
  for (const file of walk(ROUTES, (name) => name.endsWith(".tsx"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      const path = head((match[1] ?? "").split("${")).replace(/\/+$/, "") || "/";
      found.push({ file, path });
    }
  }
  return found;
}

/** Is an `/api/…` path actually registered by a Hono route file? */
function apiPathRegistered(path: string): boolean {
  // The mount point is added in src/server/index.ts, so the route file carries the remainder.
  const tail = head(path.replace(/^\/api/, "").split("?"));
  const segments = tail.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return false;
  // Match on the last literal segment: registrations are written as `router.get("/auth/verify-email"…)`
  // and the leading segments vary with how each router is mounted.
  const needle = segments[segments.length - 1] ?? "";
  if (!needle || needle.startsWith(":")) return true;
  const sources = walk(API, (name) => name.endsWith(".ts")).map((file) =>
    readFileSync(file, "utf8"),
  );
  return sources.some((source) => source.includes(`/${needle}`));
}

describe("emailed and in-app links resolve to something real", () => {
  const links = serviceLinks();
  const targets = navigationTargets();

  test("the scan found links to check (a silent no-op would pass forever)", () => {
    expect(links.length).toBeGreaterThan(0);
    expect(targets.length).toBeGreaterThan(0);
  });

  test("every path a service puts in an email or a redirect is served", () => {
    const dangling = links.filter(({ path }) => {
      if (path.startsWith("/api/")) return !apiPathRegistered(path);
      if (KNOWN_UNBUILT.some((known) => known.path === path)) return false;
      return !routeExists(path);
    });
    expect(dangling.map((d) => `${d.path} (${d.file.split("/").slice(-2).join("/")})`)).toEqual([]);
  });

  test("every in-app navigation target is a route that exists", () => {
    const dangling = targets.filter(
      ({ path }) => !routeExists(path) && !KNOWN_UNBUILT.some((known) => known.path === path),
    );
    expect(dangling.map((d) => `${d.path} (${d.file.split("/").slice(-2).join("/")})`)).toEqual([]);
  });

  test("the known-unbuilt list is still true — build the screen, delete the entry", () => {
    const nowBuilt = KNOWN_UNBUILT.filter(({ path }) => routeExists(path));
    expect(
      nowBuilt.map(
        ({ path, ticket }) => `${path} now exists — remove it from KNOWN_UNBUILT (${ticket})`,
      ),
    ).toEqual([]);
  });

  test("every known-unbuilt entry names the ticket that owns it", () => {
    for (const entry of KNOWN_UNBUILT) {
      expect(entry.ticket.length).toBeGreaterThan(0);
      expect(entry.path.startsWith("/")).toBe(true);
    }
  });
});
