/**
 * One response envelope for the whole API.
 *
 * The portal was written against `{ data, meta }` (36 reads) while most routes
 * returned a bare `{ items, total }` (16 reads) — so panels rendered empty even
 * when the query found rows. Everything client-facing now goes through these
 * helpers.
 *
 * `_id` is a deliberate compatibility alias for `id`: the frontend was built
 * against a Mongo backend and keys lists off `_id` in ~30 places. Emitting both
 * lets the two sides converge without a flag-day rename. `id` is canonical —
 * new frontend code should use it, and `_id` can be dropped once nothing reads it.
 */

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Adds the `_id` alias to a row (and to nested rows the client keys on). */
export function withId<T extends { id?: unknown }>(row: T): T & { _id: unknown } {
  return { ...row, _id: (row as { id?: unknown }).id };
}

export function withIds<T extends { id?: unknown }>(rows: T[]): Array<T & { _id: unknown }> {
  return rows.map(withId);
}

/** Success envelope. `meta` is merged in, so callers can add their own keys. */
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return meta ? { data, meta } : { data };
}

/** Paginated list envelope: `{ data: [...], meta: { pagination } }`. */
export function paginated<T extends { id?: unknown }>(
  rows: T[],
  total: number,
  page: number,
  limit: number,
  extraMeta?: Record<string, unknown>,
) {
  return {
    data: withIds(rows),
    meta: {
      pagination: {
        total,
        page,
        limit,
        pages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
      ...extraMeta,
    },
  };
}

/** Parses `?page=&limit=` with sane bounds so a caller cannot request 1e9 rows. */
export function pageParams(
  query: Record<string, string | undefined>,
  defaultLimit = 20,
  maxLimit = 100,
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit ?? String(defaultLimit)) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
