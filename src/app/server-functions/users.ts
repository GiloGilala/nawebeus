/**
 * TanStack Start Server Functions — Users domain
 *
 * Thin adapters over `src/services/users/*` and auth email-change. Org id is
 * taken from the session, never the payload.
 */

import { ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import {
  adminUpdateByIdSchema,
  changePasswordSchema,
  dataExportIdSchema,
  deleteAccountSchema,
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  updateMeSchema,
  userIdSchema,
} from "@/lib/validation";
import { changePassword } from "@/services/auth/auth.service";
import { confirmEmailChange, requestEmailChange } from "@/services/auth/email-change";
import {
  deleteAccount,
  getAccountDeletionStatus,
  reactivateAccount,
} from "@/services/users/account-deletion.service";
import {
  deleteUser,
  getUserById,
  listUsers,
  updateUserAsAdmin,
} from "@/services/users/admin.service";
import { getDataExport, requestDataExport } from "@/services/users/dsar.service";
import { getUser, updateUser } from "@/services/users/user.service";
import { createServerFn } from "../lib/createServerFn";
import {
  assertServerAbility,
  assertServerRateLimit,
  getServerAuth,
  getServerClientIp,
  getServerDb,
  getServerHeaders,
  withServerOrgContext,
} from "./helpers";

export const getMeServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  const [user, deletionStatus] = await Promise.all([
    withServerOrgContext(auth, () => getUser(db, auth.userId)),
    withServerOrgContext(auth, () => getAccountDeletionStatus(db, auth.userId)),
  ]);
  return { user, deletionStatus };
});

export const updateMeServerFn = createServerFn({ method: "POST" })
  .validator(updateMeSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof updateMeSchema.parse>;
    const auth = await getServerAuth();
    const db = getServerDb();
    const user = await withServerOrgContext(auth, () => updateUser(db, auth.userId, parsed));
    return { user };
  });

export const changePasswordServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = changePasswordSchema.parse(data);
    const complexity = validatePassword(parsed.newPassword, { email: "" });
    if (!complexity.valid) {
      throw new ValidationError(
        "New password does not meet complexity requirements",
        complexity.errors.map((msg) => ({ field: "newPassword", message: msg })),
      );
    }
    return parsed;
  })
  .handler(async ({ data }) => {
    const parsed = data as { currentPassword: string; newPassword: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    await withServerOrgContext(auth, () =>
      changePassword(db, auth.userId, parsed.currentPassword, parsed.newPassword),
    );
    return { changed: true as const };
  });

export const deleteAccountServerFn = createServerFn({ method: "POST" })
  .validator(deleteAccountSchema)
  .handler(async ({ data }) => {
    const parsed = data as { reason?: string; confirmText: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      deleteAccount(db, auth.userId, parsed.reason ? { reason: parsed.reason } : undefined),
    );
    return { scheduledDeletionAt: result.scheduledDeletionAt };
  });

export const reactivateAccountServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getServerAuth();
  const db = getServerDb();
  await withServerOrgContext(auth, () => reactivateAccount(db, auth.userId));
  return { reactivated: true as const };
});

export const requestEmailChangeServerFn = createServerFn({ method: "POST" })
  .validator(emailChangeRequestSchema)
  .handler(async ({ data }) => {
    const parsed = data as { newEmail: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      requestEmailChange(db, auth.userId, { newEmail: parsed.newEmail }),
    );
    return result;
  });

export const confirmEmailChangeServerFn = createServerFn({ method: "POST" })
  .validator(emailChangeConfirmSchema)
  .handler(async ({ data }) => {
    const parsed = data as { token: string };
    const db = getServerDb();
    const result = await confirmEmailChange(db, { token: parsed.token });
    return result;
  });

export const requestDataExportServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getServerAuth();
  await assertServerRateLimit({
    category: "dsar",
    userId: auth.userId,
  });
  const db = getServerDb();
  const ip = getServerClientIp();
  const userAgent = getServerHeaders().userAgent;
  const receipt = await withServerOrgContext(auth, () =>
    requestDataExport(db, {
      userId: auth.userId,
      organizationId: auth.orgId,
      ...(ip ? { actorIp: ip } : {}),
      ...(userAgent ? { actorUserAgent: userAgent } : {}),
    }),
  );
  return receipt;
});

export const getDataExportServerFn = createServerFn({ method: "GET" })
  .validator(dataExportIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { requestId: string };
    const auth = await getServerAuth();
    const db = getServerDb();
    const payload = await withServerOrgContext(auth, () =>
      getDataExport(db, auth.userId, parsed.requestId),
    );
    return payload;
  });

export const listUsersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "read", "users");
  const db = getServerDb();
  const users = (await withServerOrgContext(auth, () => listUsers(db, auth.orgId))).items;
  return { users };
});

export const getUserByIdServerFn = createServerFn({ method: "GET" })
  .validator(userIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { userId: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "users");
    const db = getServerDb();
    const user = await withServerOrgContext(auth, () => getUserById(db, auth.orgId, parsed.userId));
    return { user };
  });

export const updateUserAsAdminServerFn = createServerFn({ method: "POST" })
  .validator(adminUpdateByIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof adminUpdateByIdSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "users");
    const db = getServerDb();
    const user = await withServerOrgContext(auth, () =>
      updateUserAsAdmin(
        db,
        auth.orgId,
        parsed.userId,
        {
          ...(parsed.firstName ? { firstName: parsed.firstName } : {}),
          ...(parsed.lastName ? { lastName: parsed.lastName } : {}),
          ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
          ...(parsed.status ? { status: parsed.status } : {}),
          ...(parsed.roleId ? { roleId: parsed.roleId } : {}),
        },
        auth.userId,
      ),
    );
    return { user };
  });

export const deleteUserServerFn = createServerFn({ method: "POST" })
  .validator(userIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { userId: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "users");
    const db = getServerDb();
    await withServerOrgContext(auth, () => deleteUser(db, auth.orgId, parsed.userId, auth.userId));
    return { deleted: true as const };
  });
