import { z } from "zod";

export const CategorySchema = z.object({
    name: z.string().min(1, "Category name is required"),
    type: z.string(),
    studioId: z.string().optional()
});

export const ServiceSchema = z.object({
    name: z.string().min(1, "Service name is required"),
    type: z.enum(["standard", "vvip", "premium"]),
    description: z.string().min(1, "Description is required"),
    features: z.array(z.string()).optional(),
    price: z.number().min(0, "Price cannot be negative"),
    salePrice: z.number().min(0, "Sale price cannot be negative").optional(),
    studioSessionId: z.string().min(1, "Studio Session is required"),
    categoryId: z.string().optional()
});

export type CategoryPayload = z.infer<typeof CategorySchema>;
export type ServicePayload = z.infer<typeof ServiceSchema>;
