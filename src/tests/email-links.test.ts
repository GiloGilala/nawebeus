/**
 * Emailed-link bases — NWB-P0-021 (F-09, F-09b).
 *
 * Every link in an outbound email must be built from a server-decided base.
 * Two routes used to pass `c.req.header("origin")` into the email body, which
 * made the base client-controlled on an **unauthenticated** endpoint: sending
 * `Origin: https://evil.example.com` to `/api/auth/forgot-password` delivered a
 * *valid* reset token for someone else's account to a link on the attacker's
 * domain. Reproduced against the pre-fix code before this suite was written.
 *
 * The first test below is the regression pin for exactly that. The rest cover
 * the remaining `emailService.send` call sites the ticket asked to audit.
 */
import { afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { sql } from "drizzle-orm";
import { loadConfig } from "../lib/config";
import { emailService } from "../services/email";
import { createTestApp } from "./helpers/test-client";
import { withTestDb } from "./helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "./helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/** The configured base for this test run — what every link must start with. */
const BASE = "http://localhost:3000";
const HOSTILE = "https://evil.example.com";

/** Captures outbound email HTML without touching the transport. */
function captureEmails() {
  const sent: { subject: string; html: string; to: string }[] = [];
  const spy = spyOn(emailService, "send").mockImplementation(async (m: any) => {
    sent.push({
      subject: m.subject,
      html: m.html,
      to: Array.isArray(m.to) ? m.to.join(",") : m.to,
    });
    return { sent: true, messageId: `em_test_${sent.length}`, recipient: String(m.to) };
  });
  return { sent, restore: () => spy.mockRestore() };
}

/** Every href in an email body. */
const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] as string);

describe.skipIf(!hasDb())("Emailed links use a server-decided base (with DB)", () => {
  beforeAll(() => {
    loadConfig();
  });

  let active: { restore: () => void } | null = null;
  afterEach(() => {
    active?.restore();
    active = null;
  });

  test("F-09b: a forged Origin header cannot steer the password-reset link", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db);
      const cap = captureEmails();
      active = cap;

      const res = await app.request("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: HOSTILE },
        body: JSON.stringify({ email: user.email }),
      });
      expect(res.status).toBe(200);
      expect(cap.sent).toHaveLength(1);

      const links = hrefs(cap.sent[0]!.html);
      expect(links).toHaveLength(1);
      // The attacker's domain must appear nowhere — not as the base, not in a
      // query parameter, not anywhere in the body.
      expect(cap.sent[0]!.html).not.toContain("evil.example.com");
      expect(links[0]!.startsWith(`${BASE}/`)).toBe(true);
      expect(links[0]).toMatch(/\/reset-password\?token=[a-f0-9]{64}$/);
    });
  });

  test("F-09b: a forged Origin header cannot steer the verification-resend link", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db);
      await db.execute(sql`UPDATE users SET email_verified = false WHERE id = ${user.id}`);
      const cap = captureEmails();
      active = cap;

      const res = await app.request("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: HOSTILE },
        body: JSON.stringify({ email: user.email }),
      });
      expect(res.status).toBe(200);
      expect(cap.sent).toHaveLength(1);
      expect(cap.sent[0]!.html).not.toContain("evil.example.com");

      const links = hrefs(cap.sent[0]!.html);
      expect(links[0]!.startsWith(`${BASE}/`)).toBe(true);
    });
  });

  test("with no Origin header at all, links are still absolute", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db);
      const cap = captureEmails();
      active = cap;

      const res = await app.request("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      expect(res.status).toBe(200);

      const link = hrefs(cap.sent[0]!.html)[0] as string;
      // The old code produced `/reset-password?token=…` here — a relative URL
      // in an email, which no mail client can resolve. Absolute or nothing.
      expect(() => new URL(link)).not.toThrow();
      expect(link.startsWith(`${BASE}/`)).toBe(true);
    });
  });

  test("F-09: the signup verification link points at the route that exists", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const cap = captureEmails();
      active = cap;

      const uid = crypto.randomUUID().slice(0, 8);
      const res = await app.request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: HOSTILE },
        body: JSON.stringify({
          email: `signup-${uid}@example.com`,
          password: TEST_USER_PASSWORD,
          fullName: "Signup User",
          organizationName: `Signup Org ${uid}`,
          termsAccepted: true,
          privacyAccepted: true,
        }),
      });
      expect(res.status).toBe(201);
      expect(cap.sent.length).toBeGreaterThanOrEqual(1);

      const link = hrefs(cap.sent[0]!.html)[0] as string;
      expect(link).not.toContain("evil.example.com");
      // F-09 proper: signup emitted `${base}/verify-email`, but the route is
      // `GET /api/auth/verify-email` — every signup link 404'd. It now matches
      // what `sendVerificationEmail` emits.
      expect(link.startsWith(`${BASE}/api/auth/verify-email?token=`)).toBe(true);
    });
  });

  test("the invitation link uses the same base", async () => {
    await withTestDb(async ({ db }) => {
      const { inviteMember } = await import("../services/orgs/invitation.service");
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: owner.id,
        roleCode: "owner",
      });
      const cap = captureEmails();
      active = cap;

      await inviteMember(db, org.id, owner.id, {
        email: `invitee-${crypto.randomUUID().slice(0, 8)}@example.com`,
      });

      expect(cap.sent).toHaveLength(1);
      const link = hrefs(cap.sent[0]!.html)[0] as string;
      expect(link.startsWith(`${BASE}/invite?token=`)).toBe(true);
    });
  });

  test("the email-change confirmation link uses the same base", async () => {
    await withTestDb(async ({ db }) => {
      const { requestEmailChange } = await import("../services/auth/email-change");
      const user = await createTestUser(db);
      const cap = captureEmails();
      active = cap;

      await requestEmailChange(db, user.id, {
        newEmail: `changed-${crypto.randomUUID().slice(0, 8)}@example.com`,
      });

      expect(cap.sent.length).toBeGreaterThanOrEqual(1);
      const confirmation = cap.sent.find((m) => hrefs(m.html).length > 0);
      expect(confirmation).toBeDefined();
      const link = hrefs(confirmation!.html)[0] as string;
      expect(link.startsWith(`${BASE}/change-email/confirm?token=`)).toBe(true);
    });
  });

  test("no emailed link anywhere is relative or carries a client-supplied host", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const user = await createTestUser(db);
      await db.execute(sql`UPDATE users SET email_verified = false WHERE id = ${user.id}`);
      const cap = captureEmails();
      active = cap;

      // Sweep the unauthenticated, Origin-reachable surface in one pass.
      for (const path of ["/api/auth/forgot-password", "/api/auth/resend-verification"]) {
        await app.request(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: HOSTILE,
            Referer: `${HOSTILE}/phish`,
            "X-Forwarded-Host": "evil.example.com",
          },
          body: JSON.stringify({ email: user.email }),
        });
      }

      expect(cap.sent.length).toBeGreaterThanOrEqual(2);
      for (const message of cap.sent) {
        expect(message.html).not.toContain("evil.example.com");
        for (const link of hrefs(message.html)) {
          expect(() => new URL(link)).not.toThrow();
          expect(new URL(link).origin).toBe(BASE);
        }
      }
    });
  });
});

describe("APP_BASE_URL config resolution — no DB needed", () => {
  test("defaults to the first CORS_ORIGIN entry when unset", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgresql://localhost:5432/test",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CORS_ORIGIN: "https://app.nawebeus.com,https://admin.nawebeus.com",
    });
    expect(cfg.APP_BASE_URL_RESOLVED).toBe("https://app.nawebeus.com");
  });

  test("an explicit APP_BASE_URL wins over CORS_ORIGIN", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgresql://localhost:5432/test",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CORS_ORIGIN: "https://app.nawebeus.com",
      APP_BASE_URL: "https://links.nawebeus.com",
    });
    // The two are allowed to differ: the origin a browser calls from is not
    // necessarily the host you want in an email.
    expect(cfg.APP_BASE_URL_RESOLVED).toBe("https://links.nawebeus.com");
  });

  test("trailing slashes are stripped so links never double up", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgresql://localhost:5432/test",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CORS_ORIGIN: "https://app.nawebeus.com",
      APP_BASE_URL: "https://links.nawebeus.com///",
    });
    expect(cfg.APP_BASE_URL_RESOLVED).toBe("https://links.nawebeus.com");
    expect(`${cfg.APP_BASE_URL_RESOLVED}/invite`).toBe("https://links.nawebeus.com/invite");
  });

  test("a non-URL APP_BASE_URL fails closed at startup", () => {
    const base = {
      DATABASE_URL: "postgresql://localhost:5432/test",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
    };
    // Misconfiguration must stop the process, not silently emit broken links.
    for (const bad of ["not-a-url", "javascript:alert(1)", "//evil.example.com", ""]) {
      expect(() => loadConfig({ ...base, APP_BASE_URL: bad })).toThrow(/APP_BASE_URL/);
    }
  });

  test("the resolved base is always absolute, whatever the config shape", () => {
    const cfg = loadConfig({
      DATABASE_URL: "postgresql://localhost:5432/test",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
    });
    expect(() => new URL(cfg.APP_BASE_URL_RESOLVED)).not.toThrow();
  });
});
