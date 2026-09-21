/**
 * Audit — one log, one vocabulary, one way in and one way out (NWB-P1-002).
 *
 * The public surface of `src/services/audit/`. Import from `@/services/audit` (or `../audit` inside
 * `src/services`) rather than a file in this folder: the point of the folder is that the write path,
 * the registry and the read path cannot be used inconsistently, and a deep import is how that
 * guarantee gets nibbled away.
 *
 * What used to live here as `src/services/audit.ts`: a 5-value module union hand-mirroring a 15-value
 * database enum, a free-text `action`, no reads at all, and no way to say "this event has no
 * organization" other than leaving a field out. Each is fixed in the file that now owns it:
 *
 * | Concern | File |
 * | --- | --- |
 * | The vocabularies, derived from the schema enums | `./types` |
 * | Which actions exist, and how each is filed | `./actions` |
 * | The insert | `./write` |
 * | The hash chain: seal on write, verify on schedule | `./chain` |
 * | The reads: list, detail, tenant scope | `./query.service` |
 *
 * Not here on purpose: scrubbing actor context when a subject is erased → NWB-P1-015; retention
 * and legal holds → NWB-P1-010. Both are blocked on or blocked by this module, not the other way
 * round.
 */
export {
  AUDIT_ACTION_FORMAT,
  AUDIT_ACTIONS,
  type AuditActionName,
  type AuditActionSpec,
  auditActionNamingProblem,
  auditActionSpec,
  LEGACY_AUDIT_ACTION_NAMES,
} from "./actions";
export {
  type BrokenChainLink,
  type ChainedAuditModule,
  type ChainLinkInput,
  type ChainVerificationResult,
  computeChecksum,
  genesisPreviousChecksum,
  isChainedModule,
  type SealedChainLink,
  sealChainLink,
  verifyAuditChains,
} from "./chain";
export {
  type AuditEventDetail,
  type AuditEventFilters,
  type AuditEventSummary,
  type AuditReadScope,
  getAuditEvent,
  listAuditEvents,
} from "./query.service";
export {
  AUDIT_ACTOR_TYPE_VALUES,
  AUDIT_CATEGORY_VALUES,
  AUDIT_MODULE_VALUES,
  AUDIT_SEVERITY_VALUES,
  type AuditActor,
  type AuditActorType,
  type AuditCategory,
  type AuditModule,
  type AuditSeverity,
  CHECKSUM_ONLY_MODULES,
} from "./types";
export {
  resolveAuditDefaults,
  type WriteAuditLogEntryParams,
  writeAuditLog,
} from "./write";
