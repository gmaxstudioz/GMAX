import z from "zod";

export const CreateProductSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number().positive("Price must be greater than 0"),
    salePrice: z.coerce.number().positive("Sale price must be greater than 0").nullable(),
    categoryId: z.string().nullable().optional(),
    isPublished: z.boolean(),
    thumbnailKey: z.string().nullable().optional(),
    r2Key: z.string().min(1, "A product file is required"),
    fileName: z.string().min(1, "File name is required"),
    fileSize: z.number().min(1, "File size is required"),
    mimeType: z.string().min(1, "MIME type is required"),
});

export type CreateProductType = z.infer<typeof CreateProductSchema>;