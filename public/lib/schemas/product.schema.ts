// portal/lib/schemas/product.schema.ts
import { z } from "zod";

export const purchaseProductSchema = z.object({
    productId: z.string().min(1),
    buyerName: z.string().min(2, "Name must be at least 2 characters"),
    buyerEmail: z.email("Invalid email address"),
    buyerPhone: z.string().min(1, "Phone number is required"),
});

export const requestAccessLinkSchema = z.object({
    email: z.email("Invalid email address"),
});

export const requestDownloadSchema = z.object({
    productId: z.string().min(1),
    token: z.string().min(1),
});

export type PurchaseProductInput = z.infer<typeof purchaseProductSchema>;
export type RequestAccessLinkInput = z.infer<typeof requestAccessLinkSchema>;
export type RequestDownloadInput = z.infer<typeof requestDownloadSchema>;