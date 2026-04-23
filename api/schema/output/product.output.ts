import { z } from "zod";
import { PaginatedOutput } from "./common.output";

// ─── Product Output ───────────────────────────────────────────────────────────

export const ProductOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  salePrice: z.number().nullable(),
  fileName: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  mimeType: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  
  /** Signed download URL — generated at request time, absent on list views */
  signedUrl: z.url().nullable(),
  thumbnailSignedUrl: z.url().nullable(),
});

export const ProductListOutputSchema = PaginatedOutput(
  ProductOutputSchema.omit({ signedUrl: true, thumbnailSignedUrl: true })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductOutput = z.infer<typeof ProductOutputSchema>;
export type ProductListOutput = z.infer<typeof ProductListOutputSchema>;