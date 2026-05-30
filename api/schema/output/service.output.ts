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

// ─── Service Variant Output ───────────────────────────────────────────────────

export const ServiceVariantOutputSchema = z.object({
  id: z.string(),
  locationType: z.enum(["STUDIO", "OUTDOOR", "BOTH", "MULTIPLE"]),
  basePrice: z.string(), // Decimals from Prisma often serialize as strings
  maxPrice: z.string().nullable(),
  sessionDurationMins: z.number().int(),
  logisticsIncluded: z.boolean(),
});

// ─── Service Output ───────────────────────────────────────────────────────────

export const ServiceOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAddon: z.boolean(),
  description: z.string(),
  features: z.array(z.string()),
  categoryId: z.string(),
  studioSessionId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),

  // Resolved relations
  category: CategoryOutputSchema,
  studioSession: StudioSessionOutputSchema,
  variants: z.array(ServiceVariantOutputSchema),
});

/** Lightweight variant for dropdown/select use cases */
export const ServiceOptionOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAddon: z.boolean(),
  variants: z.array(ServiceVariantOutputSchema),
});

export const ServiceListOutputSchema = PaginatedOutput(ServiceOutputSchema);

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryOutput = z.infer<typeof CategoryOutputSchema>;
export type CategoryListOutput = z.infer<typeof CategoryListOutputSchema>;
export type StudioSessionOutput = z.infer<typeof StudioSessionOutputSchema>;
export type StudioSessionListOutput = z.infer<typeof StudioSessionListOutputSchema>;
export type ServiceVariantOutput = z.infer<typeof ServiceVariantOutputSchema>;
export type ServiceOutput = z.infer<typeof ServiceOutputSchema>;
export type ServiceOptionOutput = z.infer<typeof ServiceOptionOutputSchema>;
export type ServiceListOutput = z.infer<typeof ServiceListOutputSchema>;