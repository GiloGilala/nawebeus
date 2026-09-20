import { Hono } from "hono";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { RateLimitError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { success } from "@/lib/response";
import { acceptInvitation, getInvitationByToken } from "@/services/orgs/invitation.service";

/**
 * Public invitation endpoints (F-08 / NWB-P0-016). The bearer of the token is
 * by definition mid-onboarding, so there is no session to verify — the
 * 32-byte emailed token is the credential. Both routes are rate-limited to
 * keep token probing infeasible; limits mirror the signin IP budget
 * (20 / 30 min) with a stricter per-token accept budget.
 */

const acceptInvitationSchema = z.object({
  password: z.string().min(1).max(128).optional(),
  fullName: z.string().min(1).max(200).optional(),
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

const VALIDATE_MAX = 20;
const ACCEPT_MAX = 10;
const WINDOW_MS = 30 * 60 * 1000;

const router = new Hono();

// GET /api/auth/invitations/:token — validate + landing-page context.
router.get("/invitations/:token", async (c) => {
  const db = c.var.db;
  const ip = getClientIp(c, getConfig());
  if (await checkRateLimit(db, `invite:validate:${ip}`, VALIDATE_MAX, WINDOW_MS)) {
    throw new RateLimitError("Too many invitation lookups. Try again later.", WINDOW_MS / 1000);
  }

  const invitation = await getInvitationByToken(db, c.req.param("token"));
  return c.json(success({ invitation }));
});

// POST /api/auth/invitations/:token/accept — register-into-org or link an
// existing account (single-org interim semantics, D14).
router.post("/invitations/:token/accept", async (c) => {
  const db = c.var.db;
  const ip = getClientIp(c, getConfig());
  const token = c.req.param("token");
  if (
    await checkRateLimit(db, `invite:accept:${ip}:${token.slice(0, 16)}`, ACCEPT_MAX, WINDOW_MS)
  ) {
    throw new RateLimitError("Too many acceptance attempts. Try again later.", WINDOW_MS / 1000);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = acceptInvitationSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join(".") || "_root",
      message: i.message,
    }));
    throw new ValidationError("Validation failed", details);
  }

  const result = await acceptInvitation(db, { token, ...parsed.data });
  return c.json(
    success({
      membership: {
        id: result.memberId,
        organizationId: result.organizationId,
        organizationName: result.organizationName,
        email: result.email,
        roleId: result.roleId,
        status: "active",
        newUser: result.newUser,
      },
    }),
  );
});

export { router as invitationRouter };
