import { z } from "zod";

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  pageCount: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Generic paginated list wrapper.
 * Usage: PaginatedOutput(BookingOutputSchema)
 */
export const PaginatedOutput = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });

// ─── Mutation Results ─────────────────────────────────────────────────────────

/** Returned by delete procedures */
export const DeleteOutputSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

/** Generic success acknowledgement */
export const SuccessOutputSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});

export type DeleteOutput = z.infer<typeof DeleteOutputSchema>;
export type SuccessOutput = z.infer<typeof SuccessOutputSchema>;