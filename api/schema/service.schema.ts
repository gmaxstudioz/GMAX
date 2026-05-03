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
 
export const ServiceTypeEnum = z.enum(["standard", "premium", "addon"]);
 
export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  features: z.array(z.string()),
  price: z.number().nonnegative(),
  salePrice: z.number().nonnegative().nullable().optional(),
  categoryId: z.string(),
  studioSessionId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).refine(
  (data) => data.salePrice == null || data.salePrice <= data.price,
  { message: "Sale price must be less than or equal to regular price", path: ["salePrice"] }
);
 
export const CreateServiceSchema = ServiceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
 
export const UpdateServiceSchema = CreateServiceSchema.partial();
 
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