/**
 * Impersonation sessions (NWB-P1-011) — the only import path for the service, matching the
 * `email/` convention: callers import from `../impersonation`, never from the files inside.
 */

export { impersonationAbility } from "./ability";
export {
  type EndImpersonationInput,
  type EndImpersonationResult,
  type ExpireLapsedResult,
  endImpersonation,
  expireLapsedImpersonations,
  IMPERSONATION_DEFAULT_MINUTES,
  IMPERSONATION_ID_PATTERN,
  IMPERSONATION_MAX_MINUTES,
  IMPERSONATION_MIN_MINUTES,
  IMPERSONATION_TOKEN_TTL_SECONDS,
  type ImpersonationListEntry,
  impersonationCursorShape,
  type LiveImpersonation,
  listImpersonations,
  type MintTokenInput,
  mintImpersonationToken,
  resolveLiveImpersonation,
  type StartImpersonationInput,
  type StartImpersonationResult,
  startImpersonation,
} from "./impersonation.service";
