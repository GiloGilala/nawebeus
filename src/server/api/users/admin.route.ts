import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import {
  adminUpdateSchema,
  endImpersonationSchema,
  parseWithValidation,
  startImpersonationSchema,
} from "@/lib/validation";
import {
  clearImpersonationCookie,
  setImpersonationCookie,
} from "@/server/api/auth/session-cookies";
import { patternParam, uuidParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
import {
  endImpersonation,
  type ImpersonationListEntry,
  impersonationCursorShape,
  listImpersonations,
  mintImpersonationToken,
  startImpersonation,
} from "@/services/impersonation";
import {
  deleteUser,
  getUserById,
  listUsers,
  updateUserAsAdmin,
} from "@/services/users/admin.service";
import { requestDataExport } from "@/services/users/dsar.service";

const router = new Hono();

// ── Impersonation (NWB-P1-011) ────────────────────────────────────────────────
// Registered BEFORE the `/:userId` routes below, on purpose: Hono resolves in
// registration order (verified empirically), so `GET /impersonations` placed
// after `GET /:userId` would be eaten by it and 422 on `userId =
// "impersonations"` — the F-11 shape, one level down. A regression test pins
// this (`src/tests/impersonation/`).

const IMPERSONATION_SESSION_ID_PATTERN = /^imp_[0-9a-f-]{36}$/i;

/**
 * End authorization has two legal callers: a normal admin holding
 * `users.impersonate` (oversight — terminate someone else's session), and the
 * impersonation session *itself* ("Stop" from inside the support bar — after
 * the cookie swap the caller's abilities are the target's, and a support
 * session the support UI cannot end is a support session that cannot be ended).
 * A self-end is bound to the session id in the impersonation context, so an
 * impersonated caller can end exactly one thing: their own session.
 */
const requireEndImpersonationAuthorization: MiddlewareHandler = async (c, next) => {
  const impersonation = c.var.impersonation;
  if (impersonation && impersonation.impersonationSessionId === c.req.param("sessionId")) {
    return next();
  }
  return requireAbility("impersonate", "users")(c, next);
};

router.get("/impersonations", authMiddleware, requireAbility("read", "audit"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const page = parsePagination(new URL(c.req.url), impersonationCursorShape);
  const scopeParam = new URL(c.req.url).searchParams.get("scope");
  const scope =
    scopeParam === null || scopeParam === "all"
      ? "all"
      : scopeParam === "active" || scopeParam === "ended"
        ? scopeParam
        : undefined;
  if (!scope) {
    throw new ValidationError("Invalid scope parameter", [
      { field: "scope", message: "Must be all, active, or ended" },
    ]);
  }
  const { items, pageInfo } = await listImpersonations(db, orgId, page, { scope });
  return c.json(
    success({ impersonations: items as ImpersonationListEntry[] }, paginationMeta(pageInfo)),
  );
});

router.post(
  "/:userId/impersonate",
  authMiddleware,
  requireAbility("impersonate", "users"),
  async (c) => {
    const { orgId, userId: adminUserId } = c.var.user;
    const db = c.var.db;
    const targetUserId = uuidParam(c, "userId", "user id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const parsed = parseWithValidation(startImpersonationSchema, body);
    const config = getConfig();
    const result = await startImpersonation(db, {
      organizationId: orgId,
      adminUserId,
      targetUserId,
      reason: parsed.reason,
      ...(parsed.ticketId !== undefined ? { ticketId: parsed.ticketId } : {}),
      ...(parsed.durationMinutes !== undefined ? { durationMinutes: parsed.durationMinutes } : {}),
      ...(parsed.mfaCode !== undefined ? { mfaCode: parsed.mfaCode } : {}),
      ...(getClientIp(c, config) ? { ip: getClientIp(c, config) as string } : {}),
      userAgent: c.req.header("user-agent"),
      accessSecret: config.JWT_ACCESS_SECRET,
    });

    // The cookie swap: the admin's browser now carries the target's short-lived
    // impersonation access token. Their refresh cookie is untouched — ending
    // the session (or its expiry) hands the browser back to `/api/auth/refresh`.
    setImpersonationCookie(
      c,
      result.token,
      Math.max(Math.floor((new Date(result.tokenExpiresAt).getTime() - Date.now()) / 1000), 1),
    );

    return c.json(
      success({
        impersonation: {
          sessionId: result.session.id,
          targetUserId: result.session.targetUserId,
          organizationId: result.session.organizationId,
          reason: result.session.reason,
          expiresAt: result.session.expiresAt.toISOString(),
          reentered: result.reentered,
        },
        token: result.token,
        tokenExpiresAt: result.tokenExpiresAt,
      }),
      result.reentered ? 200 : 201,
    );
  },
);

router.post(
  "/impersonations/:sessionId/token",
  authMiddleware,
  requireAbility("impersonate", "users"),
  async (c) => {
    const { orgId, userId: adminUserId } = c.var.user;
    const db = c.var.db;
    const sessionId = patternParam(
      c,
      "sessionId",
      IMPERSONATION_SESSION_ID_PATTERN,
      "impersonation session id",
    );
    const config = getConfig();
    const result = await mintImpersonationToken(db, {
      sessionId,
      organizationId: orgId,
      adminUserId,
      accessSecret: config.JWT_ACCESS_SECRET,
    });
    setImpersonationCookie(
      c,
      result.token,
      Math.max(Math.floor((new Date(result.tokenExpiresAt).getTime() - Date.now()) / 1000), 1),
    );
    return c.json(
      success({
        impersonation: {
          sessionId: result.session.id,
          targetUserId: result.session.targetUserId,
          expiresAt: result.session.expiresAt.toISOString(),
        },
        token: result.token,
        tokenExpiresAt: result.tokenExpiresAt,
      }),
    );
  },
);

router.post(
  "/impersonations/:sessionId/end",
  authMiddleware,
  requireEndImpersonationAuthorization,
  async (c) => {
    const { orgId, userId: tokenUserId } = c.var.user;
    const db = c.var.db;
    const sessionId = patternParam(
      c,
      "sessionId",
      IMPERSONATION_SESSION_ID_PATTERN,
      "impersonation session id",
    );
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    parseWithValidation(endImpersonationSchema, body);
    const config = getConfig();
    // From inside the impersonation, the actor is the admin behind the session
    // (the token user is the account being helped); from outside, the caller.
    const actorUserId = c.var.impersonation?.adminUserId ?? tokenUserId;
    const selfEnd = c.var.impersonation?.impersonationSessionId === sessionId;
    const result = await endImpersonation(db, {
      sessionId,
      organizationId: orgId,
      actorUserId,
      ...(getClientIp(c, config) ? { ip: getClientIp(c, config) as string } : {}),
      userAgent: c.req.header("user-agent"),
    });
    if (selfEnd) {
      // The support session ended itself: hand the browser back its dead
      // cookie so the client re-authenticates instead of replaying a token the
      // middleware now refuses.
      clearImpersonationCookie(c);
    }
    return c.json(success({ impersonation: result }));
  },
);

router.get("/", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const page = parsePagination(new URL(c.req.url));
  const { items: users, pageInfo } = await listUsers(db, orgId, page);
  return c.json(success({ users }, paginationMeta(pageInfo)));
});

router.get("/:userId", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
  const user = await getUserById(db, orgId, userId);
  return c.json(success({ user }));
});

router.patch("/:userId", authMiddleware, requireAbility("update", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = parseWithValidation(adminUpdateSchema, body);
  const user = await updateUserAsAdmin(db, orgId, userId, parsed, actingUserId);
  return c.json(success({ user }));
});

router.delete("/:userId", authMiddleware, requireAbility("delete", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
  await deleteUser(db, orgId, userId, actingUserId);
  c.status(204);
  return c.body(null);
});

// POST /api/users/:userId/data-export — file a DSAR export on a member's
// behalf (the DSAR ops channel). Org-scoped: getUserById answers 404 for a
// cross-tenant id and nothing is created. The response carries only the
// receipt — the payload is the subject's data and is delivered in their own
// channel (GET /api/users/me/data-export/:requestId), never here.
router.post("/:userId/data-export", authMiddleware, requireAbility("read", "users"), async (c) => {
  const { orgId, userId: actingUserId } = c.var.user;
  const db = c.var.db;
  const userId = uuidParam(c, "userId", "user id");
  await getUserById(db, orgId, userId);
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  const receipt = await requestDataExport(db, {
    userId,
    requestedBy: actingUserId,
    organizationId: orgId,
    ...(ip ? { actorIp: ip } : {}),
    ...(userAgent ? { actorUserAgent: userAgent } : {}),
  });
  return c.json(success(receipt), 201);
});

export { router as adminRouter };
