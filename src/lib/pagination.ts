/**
 * Cursor pagination for list endpoints (F-14).
 *
 * `docs/technical/API Reference.md` §2.6 is normative: *"All list endpoints use
 * cursor-based pagination — never offset-based"*, with `limit` (default 20, max
 * 100) and an opaque base64 `cursor`. The roadmap's `13-api-service.md` line
 * suggesting `?page&limit` contradicts it; that conflict is registered as
 * discrepancy D-17 and resolved in favour of the API Reference.
 *
 * Why cursor rather than OFFSET, beyond "the doc says so": OFFSET re-scans and
 * discards every skipped row, so deep pages get slower the further you go, and
 * — worse for correctness — a row inserted or deleted between two requests
 * shifts every subsequent page, so a client walking the list silently skips or
 * repeats records. A keyset cursor carries the last row's sort key, so each
 * page resumes exactly where the previous one stopped regardless of concurrent
 * writes.
 *
 * ## The tiebreaker matters
 *
 * A keyset cursor is only stable if the sort key is **unique**. Every list here
 * sorted on a timestamp alone (`created_at`, `last_activity_at`, `issued_at`),
 * and timestamps collide: two members inserted in the same transaction, or two
 * sessions created in the same millisecond, share a value. With a non-unique
 * key, `WHERE created_at < $cursor` drops every row that ties with the boundary
 * row, and `<=` repeats them. So each cursor carries `(sortValue, id)` and the
 * queries compare the pair — `(created_at, id) < ($1, $2)` — with `id` as the
 * unique tiebreaker. That is why the ORDER BY clauses gained `, id` alongside
 * this change: it is part of the fix, not cosmetic.
 */
import { ValidationError } from "./errors";

/** Default page size when the client does not ask (API Reference §2.6). */
export const DEFAULT_PAGE_SIZE = 20;
/** Hard ceiling, so one request cannot ask for the whole table (§2.6). */
export const MAX_PAGE_SIZE = 100;

/** Decoded cursor: the sort value of the last row returned, plus its id. */
export interface CursorPayload {
  /** The ORDER BY value of the boundary row, ISO-8601 for timestamps. */
  v: string;
  /** The boundary row's uuid — the unique tiebreaker. */
  id: string;
}

/** What a paginated service returns alongside its rows. */
export interface PageInfo {
  /** Cursor to pass back for the next page; `null` when the list is exhausted. */
  cursor: string | null;
  /** Whether a further page exists. */
  hasMore: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
}

/** Parsed, validated query parameters for a list request. */
export interface PaginationParams {
  limit: number;
  cursor: CursorPayload | null;
}

/**
 * Encodes a cursor. Base64 of a compact JSON object — opaque by contract:
 * §2.6 tells clients never to parse or construct one, so the shape can change
 * without being a breaking API change.
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decodes a client-supplied cursor.
 *
 * Returns `null` for anything malformed rather than throwing, so callers decide
 * the status. A cursor is client-supplied input that reaches a WHERE clause, so
 * both fields are shape-checked: `id` must be a uuid and `v` a non-empty
 * string. Garbage in a cursor must never reach the driver — that is the same
 * class of bug as the malformed path params fixed in NWB-P0-029.
 */
export function decodeCursor(raw: string): CursorPayload | null {
  let json: string;
  try {
    json = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { v, id } = parsed as Record<string, unknown>;
  if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
  if (typeof id !== "string") return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return { v, id };
}

/**
 * Reads and validates `?limit` and `?cursor` from a URL.
 *
 * Throws `ValidationError` (422) on a bad value rather than silently clamping:
 * a client asking for `limit=1000` has misunderstood the contract, and quietly
 * returning 100 hides that. An unparseable cursor is likewise an error, not an
 * excuse to restart from page one — restarting would make a client's walk
 * silently repeat the beginning of the list.
 */
export function parsePagination(url: URL): PaginationParams {
  const rawLimit = url.searchParams.get("limit");
  let limit = DEFAULT_PAGE_SIZE;
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      throw new ValidationError("Invalid pagination parameter", [
        { field: "limit", message: "Must be a positive integer" },
      ]);
    }
    limit = Number.parseInt(rawLimit, 10);
    if (limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new ValidationError("Invalid pagination parameter", [
        { field: "limit", message: `Must be between 1 and ${MAX_PAGE_SIZE}` },
      ]);
    }
  }

  const rawCursor = url.searchParams.get("cursor");
  let cursor: CursorPayload | null = null;
  if (rawCursor !== null && rawCursor !== "") {
    cursor = decodeCursor(rawCursor);
    if (cursor === null) {
      throw new ValidationError("Invalid pagination parameter", [
        { field: "cursor", message: "Malformed cursor" },
      ]);
    }
  }

  return { limit, cursor };
}

/**
 * Turns `limit + 1` fetched rows into a page.
 *
 * Services select one row beyond the requested limit; its presence is how
 * `hasMore` is known without a second COUNT query. The extra row is dropped
 * before the page is returned.
 *
 * `sortValue` must return the exact value the query's ORDER BY used, so the
 * next cursor resumes on the same key.
 */
export function buildPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  sortValue: (row: T) => string,
): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    pageInfo: {
      // No cursor once the list is exhausted: a client that keeps paging
      // should stop, not loop on the final key.
      cursor: hasMore && last ? encodeCursor({ v: sortValue(last), id: last.id }) : null,
      hasMore,
    },
  };
}

/**
 * Renders `pageInfo` into the envelope's `meta` slot.
 *
 * The envelope in `src/lib/response.ts` is `{ data, meta }`. The API Reference
 * shows `pagination` as a sibling of `data`; the code's envelope has no such
 * slot, and `13-api-service.md` explicitly says to use "the envelope's existing
 * `meta` slot". Nesting under `meta.pagination` satisfies both without
 * inventing a third envelope shape — recorded in discrepancy D-17.
 */
export function paginationMeta(pageInfo: PageInfo): Record<string, unknown> {
  return { pagination: { cursor: pageInfo.cursor, hasMore: pageInfo.hasMore } };
}
