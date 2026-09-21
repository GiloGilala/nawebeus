import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import { uuidParam } from "@/server/api/route-params";
import { authMiddleware } from "@/server/middleware/auth";
import { writeAuditLog } from "@/services/audit";
import {
  getSessionDetail,
  listAllLiveSessionIds,
  listUserSessions,
  revokeSession,
} from "@/services/auth/session";

const router = new Hono();

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

  // Unpaginated on purpose: revoking "all other" sessions must not stop at a
  // page boundary and leave sessions alive.
  const allIds = await listAllLiveSessionIds(db, userId);
  const toRevoke = allIds.filter((id) => id !== parsed.currentSessionId);

  for (const sessionId of toRevoke) {
    await revokeSession(db, sessionId);
  }

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.sessions.revoked_others",
    category: "authentication",
    resourceType: "user",
    resourceId: userId,
    afterState: { revokedCount: toRevoke.length },
  });

  return c.json(success({ revokedCount: toRevoke.length }));
});

// DELETE /sessions/:sessionId — revoke a specific session
router.delete("/sessions/:sessionId", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const sessionId = uuidParam(c, "sessionId", "session id");

  const detail = await getSessionDetail(db, sessionId, userId);
  if (!detail) throw new NotFoundError("Session not found");

  await revokeSession(db, sessionId);

  await writeAuditLog({
    db,
    module: "core",
    actorId: userId,
    actorType: "user",
    action: "auth.session.revoked",
    category: "authentication",
    resourceType: "session",
    resourceId: sessionId,
  });

  return c.json(success({ revoked: true, sessionId }));
});

export { router as sessionsRouter };
