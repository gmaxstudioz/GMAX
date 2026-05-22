import { z } from "zod";

// ─── Category ─────────────────────────────────────────────────────────────────
 
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.string().min(1),
  studioId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
 
export const CreateCategorySchema = CategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
 
export const UpdateCategorySchema = CreateCategorySchema.partial();
 
export type Category = z.infer<typeof CategorySchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

// ─── Service ──────────────────────────────────────────────────────────────────

export const ServiceVariantInputSchema = z.object({
  locationType: z.enum(["STUDIO", "OUTDOOR", "BOTH", "MULTIPLE"]),
  basePrice: z.number().nonnegative(),
  maxPrice: z.number().nonnegative().nullable().optional(),
  sessionDurationMins: z.number().int().positive(),
  logisticsIncluded: z.boolean().default(true),
  deliverables: z.array(z.object({
      label: z.string().min(1, "Label is required"),
      quantity: z.number().nullable().optional(),
      detail: z.string().nullable().optional(),
      isFree: z.boolean().default(false),
  })).default([]),
});

const ServiceBaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  isAddon: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().min(1),
  features: z.array(z.string()),
  categoryId: z.string(),
  studioSessionId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ServiceSchema = ServiceBaseSchema.extend({
  variants: z.array(ServiceVariantInputSchema)
});

export const CreateServiceSchema = ServiceBaseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  variants: z.array(ServiceVariantInputSchema).min(1, "At least one variant is required"),
});

export const UpdateServiceSchema = ServiceBaseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial().extend({
  variants: z.array(ServiceVariantInputSchema).optional(),
});
 
export type Service = z.infer<typeof ServiceSchema>;
export type CreateService = z.infer<typeof CreateServiceSchema>;
export type UpdateService = z.infer<typeof UpdateServiceSchema>;

export type CategoryPayload = z.infer<typeof CategorySchema>;
export type ServicePayload = z.infer<typeof ServiceSchema>;

// Delete service schema
export const DeleteServiceSchema = z.object({
    serviceId: z.string().min(1, "Service ID is required"),
});
export type DeleteServiceInput = z.infer<typeof DeleteServiceSchema>;