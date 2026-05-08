import { z } from "zod";

export const CategorySchema = z.object({
    name: z.string().min(1, "Category name is required"),
    type: z.string(),
    studioId: z.string().optional()
});

export const ServiceTypeEnum = z.enum(["standard", "vvip", "premium", "addon"]);

export const ServiceSchema = z.object({
    name: z.string().min(1, "Service name is required"),
    type: ServiceTypeEnum,
    description: z.string().min(1, "Description is required"),
    features: z.array(z.string()).optional(),
    price: z.number().min(0, "Price cannot be negative"),
    salePrice: z.number().min(0, "Sale price cannot be negative").optional(),
    studioSessionId: z.string().min(1, "Studio Session is required"),
    categoryId: z.string().optional()
});

export const ServiceOutput = z.object({
    id:         z.string(),
    name:       z.string(),
    type:       ServiceTypeEnum,
    description: z.string(),
    features:   z.array(z.string()).optional(),
    price:      z.number(),
    salePrice:  z.number().optional(),
    studioSessionId: z.string(),
    categoryId: z.string().optional()
});

export type ServiceType = z.infer<typeof ServiceTypeEnum>;
export type CategoryPayload = z.infer<typeof CategorySchema>;
export type ServicePayload = z.infer<typeof ServiceSchema>;
export type ServiceOutput = z.infer<typeof ServiceOutput>;
