/**
 * TanStack Start Server Functions — Users domain
 */

import { createServerFn } from "../lib/createServerFn";
import { z } from "zod";

import { ValidationError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";
import { changePassword } from "@/services/auth/auth.service";
import { confirmEmailChange, requestEmailChange } from "@/services/auth/email-change";
import {
  deleteAccount,
  getAccountDeletionStatus,
  reactivateAccount,
} from "@/services/users/account-deletion.service";
import { deleteUser, getUserById, listUsers, updateUserAsAdmin } from "@/services/users/admin.service";
import { getUser, updateUser } from "@/services/users/user.service";

const updateMeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  profileImage: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().max(500).optional(),
  jobTitle: z.string().max(100).optional(),
});

const adminUpdateSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "suspended", "pending_verification", "deleted"]).optional(),
  roleId: z.string().uuid().optional(),
});

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
    const auth = await getServerAuth();
    const db = getServerDb();
    const user = await withServerOrgContext(auth, () => updateUser(db, auth.userId, data));
    return { user };
  });

export const changePasswordServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const complexity = validatePassword(data.newPassword, { email: "" });
    if (!complexity.valid) {
      throw new ValidationError("New password does not meet complexity requirements", complexity.errors.map((msg) => ({ field: "newPassword", message: msg })));
    }
    const db = getServerDb();
    await withServerOrgContext(auth, () => changePassword(db, auth.userId, data.currentPassword, data.newPassword));
    return { changed: true as const };
  });

export const deleteAccountServerFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      reason: z.string().max(500).optional(),
      confirmText: z.string().refine((v) => v === "DELETE", { message: 'Type "DELETE" to confirm' }),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () =>
      deleteAccount(db, auth.userId, data.reason ? { reason: data.reason } : undefined),
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
  .validator(z.object({ newEmail: z.string().email() }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    const db = getServerDb();
    const result = await withServerOrgContext(auth, () => requestEmailChange(db, auth.userId, { newEmail: data.newEmail }));
    return result;
  });

export const confirmEmailChangeServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getServerDb();
    // confirmEmailChange is not org-scoped — it validates the token itself
    // so we don't need withServerOrgContext here.
    const result = await confirmEmailChange(db, { token: data.token });
    return result;
  });

export const listUsersServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getServerAuth();
  assertServerAbility(auth, "read", "users");
  const db = getServerDb();
  const users = await withServerOrgContext(auth, () => listUsers(db, auth.orgId));
  return { users };
});

export const getUserByIdServerFn = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "users");
    const db = getServerDb();
    const user = await withServerOrgContext(auth, () => getUserById(db, auth.orgId, data.userId));
    return { user };
  });

export const updateUserAsAdminServerFn = createServerFn({ method: "POST" })
  .validator(adminUpdateSchema)
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "users");
    const db = getServerDb();
    const user = await withServerOrgContext(auth, () =>
      updateUserAsAdmin(
        db,
        auth.orgId,
        data.userId,
        {
          ...(data.firstName ? { firstName: data.firstName } : {}),
          ...(data.lastName ? { lastName: data.lastName } : {}),
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.roleId ? { roleId: data.roleId } : {}),
        },
        auth.userId,
      ),
    );
    return { user };
  });

export const deleteUserServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "users");
    const db = getServerDb();
    await withServerOrgContext(auth, () => deleteUser(db, auth.orgId, data.userId, auth.userId));
    return { deleted: true as const };
  });
