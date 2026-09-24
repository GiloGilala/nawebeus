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

export {
  acknowledgeAlertServerFn,
  createAlertRuleServerFn,
  deleteAlertRuleServerFn,
  escalateAlertServerFn,
  fireAlertServerFn,
  getAlertEventServerFn,
  getAlertRuleServerFn,
  getUnreadAlertCountServerFn,
  listAlertEventsServerFn,
  listAlertRulesServerFn,
  markAlertAsReadServerFn,
  markAllAlertsAsReadServerFn,
  updateAlertRuleServerFn,
} from "./alerts";
export {
  createApiKeyServerFn,
  listApiKeysServerFn,
  revokeApiKeyServerFn,
  rotateApiKeyServerFn,
} from "./api-keys";
// Auth — public
export {
  changePasswordServerFn,
  confirmMfaSetupServerFn,
  disableMfaServerFn,
  forgotPasswordServerFn,
  // Auth — protected
  getMfaStatusServerFn,
  getSessionDetailServerFn,
  initiateMfaSetupServerFn,
  listSessionsServerFn,
  refreshServerFn,
  resendVerificationServerFn,
  resetPasswordServerFn,
  revokeOthersServerFn,
  revokeSessionServerFn,
  signinServerFn,
  signoutServerFn,
  signupServerFn,
  verifyEmailServerFn,
  verifyMfaLoginServerFn,
} from "./auth";
export {
  createAppConfigServerFn,
  createFeatureFlagServerFn,
  deleteAppConfigServerFn,
  evaluateFlagServerFn,
  getAppConfigServerFn,
  getConfigValueServerFn,
  listAppConfigsServerFn,
  rollbackAppConfigServerFn,
  updateAppConfigServerFn,
} from "./config";
export {
  completeFollowUpServerFn,
  createContactServerFn,
  createInteractionServerFn,
  deleteContactServerFn,
  getContactServerFn,
  listContactsServerFn,
  listInteractionsServerFn,
  mergeContactsServerFn,
  updateContactServerFn,
} from "./contacts";
// Helpers for tests and advanced usage (injecting a transactional DB, headers)
export {
  clearServerAuthCookies,
  clearServerDbForTest,
  clearServerHeadersForTest,
  getServerAuth,
  getServerDb,
  type ServerAuth,
  type ServerRequestHeaders,
  setServerAuthCookies,
  setServerDbForTest,
  setServerHeadersForTest,
  tryGetServerAuth,
  withServerOrgContext,
} from "./helpers";
export {
  assignRoleServerFn,
  bulkInviteServerFn,
  deleteOrgServerFn,
  getMemberServerFn,
  getOrgServerFn,
  inviteMemberServerFn,
  listMembersServerFn,
  listOrgsServerFn,
  reactivateOrgServerFn,
  removeMemberServerFn,
  updateMemberServerFn,
  updateOrgServerFn,
} from "./orgs";
export {
  createTemplateServerFn,
  deleteTemplateServerFn,
  getTemplateServerFn,
  listTemplatesServerFn,
  recordTemplateUsageServerFn,
  renderTemplateServerFn,
  updateTemplateServerFn,
} from "./templates";
export {
  changePasswordServerFn as changeMyPasswordServerFn,
  confirmEmailChangeServerFn,
  deleteAccountServerFn,
  deleteUserServerFn,
  getDataExportServerFn,
  getMeServerFn,
  getUserByIdServerFn,
  listUsersServerFn,
  reactivateAccountServerFn,
  requestDataExportServerFn,
  requestEmailChangeServerFn,
  updateMeServerFn,
  updateUserAsAdminServerFn,
} from "./users";
