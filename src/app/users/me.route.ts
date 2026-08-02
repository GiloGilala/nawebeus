import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../server/middleware/auth";
import { getUser, updateUser } from "../../services/users/user.service";
import { success } from "../../lib/response";

const updateMeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  profileImage: z.string().url().optional().or(z.literal("")),
});

const router = new Hono();

router.get("/me", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  const user = await getUser(db, userId);
  return c.json(success({ user }));
});

router.patch("/me", authMiddleware, async (c) => {
  const { userId } = c.var.user;
  const db = c.var.db;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = updateMeSchema.parse(body);
  const user = await updateUser(db, userId, parsed);
  return c.json(success({ user }));
});

export { router as meRouter };
