import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { AuthError } from "../../lib/errors";
import { success } from "../../lib/response";
import { refreshSession } from "../../services/auth/auth.service";

const router = new Hono();

router.post("/refresh", async (c) => {
  const refreshToken = getCookie(c, "nawebeus_refresh");
  if (!refreshToken) throw new AuthError("No refresh token provided");

  const db = c.var.db;
  const result = await refreshSession(db, refreshToken);

  if (result.requiresMfa || !result.accessToken || !result.refreshToken) {
    throw new AuthError("Refresh failed");
  }

  setCookie(c, "nawebeus_access", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: 900,
  });
  setCookie(c, "nawebeus_refresh", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/api/auth",
    maxAge: 604800,
  });

  return c.json(
    success({
      user: {
        id: result.userId,
        orgId: result.orgId,
      },
    }),
  );
});

export { router as refreshRouter };
