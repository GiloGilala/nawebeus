import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../server/middleware/auth";
import { listUserSessions, revokeSession, getSessionDetail } from "../../services/auth/session";
import { NotFoundError } from "../../lib/errors";
import { success } from "../../lib/response";
import { writeAuditLog } from "../../services/audit";

const router = new Hono();

router.use("/sessions/*", authMiddleware);

// GET /sessions — list current user's active sessions
router.get("/sessions", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const sessions = await listUserSessions(db, userId);
  return c.json(success({ sessions }));
});

// GET /sessions/:sessionId — session detail
router.get("/sessions/:sessionId", async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const sessionId = c.req.param("sessionId");
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

  const all = await listUserSessions(db, userId);
  const toRevoke = all.filter((s) => s.id !== parsed.currentSessionId);

  for (const session of toRevoke) {
    await revokeSession(db, session.id);
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
  const sessionId = c.req.param("sessionId");

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
