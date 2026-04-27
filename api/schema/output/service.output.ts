import { z } from "zod";
import { PaginatedOutput } from "./common.output";

// ─── Category Output ──────────────────────────────────────────────────────────

export const CategoryOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  studioId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CategoryListOutputSchema = PaginatedOutput(CategoryOutputSchema);

// ─── StudioSession Output ─────────────────────────────────────────────────────

export const StudioSessionOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number().int(),
  studioId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const StudioSessionListOutputSchema = PaginatedOutput(StudioSessionOutputSchema);

// ─── Service Output ───────────────────────────────────────────────────────────

export const ServiceOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  price: z.number(),
  salePrice: z.number().nullable(),
  categoryId: z.string(),
  studioSessionId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),

  // Resolved relations
  category: CategoryOutputSchema,
  studioSession: StudioSessionOutputSchema,
});

/** Lightweight variant for dropdown/select use cases */
export const ServiceOptionOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  price: z.number(),
  salePrice: z.number().nullable(),
});

export const ServiceListOutputSchema = PaginatedOutput(ServiceOutputSchema);

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryOutput = z.infer<typeof CategoryOutputSchema>;
export type CategoryListOutput = z.infer<typeof CategoryListOutputSchema>;
export type StudioSessionOutput = z.infer<typeof StudioSessionOutputSchema>;
export type StudioSessionListOutput = z.infer<typeof StudioSessionListOutputSchema>;
export type ServiceOutput = z.infer<typeof ServiceOutputSchema>;
export type ServiceOptionOutput = z.infer<typeof ServiceOptionOutputSchema>;
export type ServiceListOutput = z.infer<typeof ServiceListOutputSchema>;