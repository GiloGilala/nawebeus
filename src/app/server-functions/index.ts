/**
 * Barrel for TanStack Start Server Functions.
 *
 * Each domain's Server Functions live in its own file and call `src/services/*`
 * directly (ADR-002, Principle 3: Direct Calls). Hono at `src/server/api/*`
 * remains the HTTP entry point for mobile / webhooks / third-party.
 *
 * Usage (web):
 * ```ts
 * import { signinServerFn } from "@/app/server-functions";
 * await signinServerFn({ data: { email, password } });
 * ```
 *
 * Usage (mobile): `POST /api/auth/signin` via Hono — same service, different entry point.
 */

// Auth — public
export {
  signupServerFn,
  signinServerFn,
  verifyMfaLoginServerFn,
  refreshServerFn,
  signoutServerFn,
  forgotPasswordServerFn,
  resetPasswordServerFn,
  resendVerificationServerFn,
  verifyEmailServerFn,
  // Auth — protected
  getMfaStatusServerFn,
  initiateMfaSetupServerFn,
  confirmMfaSetupServerFn,
  disableMfaServerFn,
  listSessionsServerFn,
  getSessionDetailServerFn,
  revokeSessionServerFn,
  revokeOthersServerFn,
  changePasswordServerFn,
} from "./auth";

export {
  listOrgsServerFn,
  getOrgServerFn,
  updateOrgServerFn,
  listMembersServerFn,
  getMemberServerFn,
  updateMemberServerFn,
  removeMemberServerFn,
  assignRoleServerFn,
  inviteMemberServerFn,
  bulkInviteServerFn,
} from "./orgs";

export {
  getMeServerFn,
  updateMeServerFn,
  changePasswordServerFn as changeMyPasswordServerFn,
  deleteAccountServerFn,
  reactivateAccountServerFn,
  requestEmailChangeServerFn,
  confirmEmailChangeServerFn,
  listUsersServerFn,
  getUserByIdServerFn,
  updateUserAsAdminServerFn,
  deleteUserServerFn,
} from "./users";

export {
  createApiKeyServerFn,
  listApiKeysServerFn,
  revokeApiKeyServerFn,
  rotateApiKeyServerFn,
} from "./api-keys";

// Helpers for tests and advanced usage (injecting a transactional DB, headers)
export {
  getServerDb,
  getServerAuth,
  tryGetServerAuth,
  withServerOrgContext,
  setServerDbForTest,
  clearServerDbForTest,
  setServerHeadersForTest,
  clearServerHeadersForTest,
  setServerAuthCookies,
  clearServerAuthCookies,
  type ServerAuth,
  type ServerRequestHeaders,
} from "./helpers";
