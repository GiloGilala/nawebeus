import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { signOut } from "@/services/auth/auth.service";

const router = new Hono();

router.post("/signout", async (c) => {
  const refreshToken = getCookie(c, "nawebeus_refresh");

  if (refreshToken) {
    const db = c.var.db;
    await signOut(db, refreshToken);
  }

  setCookie(c, "nawebeus_access", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
  });
  setCookie(c, "nawebeus_refresh", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/api/auth",
    maxAge: 0,
  });

  c.status(204);
  return c.body(null);
});

export { router as signoutRouter };
