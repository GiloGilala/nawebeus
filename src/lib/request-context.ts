/**
 * Request-scope correlation id (NWB-P1-012).
 *
 * One id per inbound request, minted (or honored) by the request-context
 * middleware in `src/server/middleware/request-context.ts`. It lives in its own
 * AsyncLocalStorage rather than in `OrgContext` because the two scopes do not
 * coincide: audit rows are also written by workers and the CLI, where there is
 * no organization and `getOrgContext()` throws by contract — while still being
 * written, correctly, for a request that never authenticated (signup, signin).
 *
 * Consumers read it through {@link currentRequestId}, which never throws —
 * "no request scope" is a normal state, not an error. The primary consumer is
 * `writeAuditLog`, which defaults its `request_id` column from here so a row
 * written during a request can be found again from the access log line (and
 * vice versa via `GET /api/audit?requestId=`).
 */
import { AsyncLocalStorage } from "node:async_hooks";

const requestIdStore = new AsyncLocalStorage<string>();

/** Run `fn` with `requestId` as the current request's correlation id. */
export function runWithRequestId<T>(id: string, fn: () => T): T {
  return requestIdStore.run(id, fn);
}

/**
 * The current request's correlation id, or `undefined` outside a request
 * scope (worker job, CLI, direct service test). Never throws.
 */
export function currentRequestId(): string | undefined {
  return requestIdStore.getStore();
}
