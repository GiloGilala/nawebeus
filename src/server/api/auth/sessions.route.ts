import { type Context, Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { uuidParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import {
  getSessionDetail,
  listUserSessions,
  revokeOtherSessions,
  revokeSession,
} from "@/services/auth/session";

const router = new Hono();

/**
 * Who is acting, for the audit rows the services now write themselves.
 *
 * `authMethod` matters: this surface accepts a Bearer API key exactly as `/api-keys` does, and a
 * machine credential ending a session is a different fact from the user ending it. The same three
 * lines exist in `api-keys.route.ts` — they are not factored out because the two routes need
 * different shapes (`api-keys` has no org on the actor), and a shared helper with an optional org is
 * how an actor loses its tenant.
 */
function actorOf(c: Context): {
  actorId: string;
  actorType: "user" | "api_key";
  organizationId: string;
} {
  return {
    actorId: c.var.user.userId,
    actorType: c.var.authMethod === "api_key" ? "api_key" : "user",
    organizationId: c.var.user.orgId,
  };
}

router.use("/sessions/*", authMiddleware);

// GET /sessions — list current user's active sessions
router.get("/sessions", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const page = parsePagination(new URL(c.req.url));
  const { items: sessions, pageInfo } = await listUserSessions(db, userId, page);
  return c.json(success({ sessions }, paginationMeta(pageInfo)));
});

// GET /sessions/:sessionId — session detail
router.get("/sessions/:sessionId", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const sessionId = uuidParam(c, "sessionId", "session id");
  const detail = await getSessionDetail(db, sessionId, userId);
  if (!detail) throw new NotFoundError("Session not found");
  return c.json(success({ session: detail }));
});

// DELETE /sessions/revoke-others — revoke all sessions except the current one
const revokeOthersSchema = z.object({
  currentSessionId: z.string().uuid().optional(),
});

router.delete("/sessions/revoke-others", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = revokeOthersSchema.parse(body);

  const revokedCount = await revokeOtherSessions(db, userId, parsed.currentSessionId, actorOf(c));

  return c.json(success({ revokedCount }));
});

// DELETE /sessions/:sessionId — revoke a specific session
router.delete("/sessions/:sessionId", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const sessionId = uuidParam(c, "sessionId", "session id");

  const detail = await getSessionDetail(db, sessionId, userId);
  if (!detail) throw new NotFoundError("Session not found");

  // The service writes `auth.session.revoked` — see `revokeSession`'s `actor` contract, which is the
  // reason this handler no longer calls `writeAuditLog` itself.
  await revokeSession(db, sessionId, actorOf(c));

  return c.json(success({ revoked: true, sessionId }));
});

export { router as sessionsRouter };
