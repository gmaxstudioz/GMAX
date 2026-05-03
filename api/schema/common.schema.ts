import { z } from "zod";

// ─── Pagination Query ─────────────────────────────────────────────────────────

/**
 * Standard pagination + sort input for all list endpoints.
 * Every field is optional so callers can omit for sensible defaults.
 */
export const PaginationQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ─── ID Params ────────────────────────────────────────────────────────────────

/** Reusable single-ID param — use `.extend()` to rename if needed */
export const IdParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export type IdParam = z.infer<typeof IdParamSchema>;

// ─── Studio-scoped Query ──────────────────────────────────────────────────────

/**
 * For endpoints that list resources within a studio.
 * Extends pagination with a required studioId filter.
 */
export const StudioScopedQuerySchema = PaginationQuerySchema.extend({
  studioId: z.string().min(1, "Studio ID is required"),
});

export type StudioScopedQuery = z.infer<typeof StudioScopedQuerySchema>;

// ─── Search Query ─────────────────────────────────────────────────────────────

/** Pagination + freetext search for searchable list endpoints */
export const SearchQuerySchema = StudioScopedQuerySchema.extend({
  search: z.string().optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
