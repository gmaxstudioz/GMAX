// schema/product.schema.ts
import { z } from "zod";

// ─── Product ──────────────────────────────────────────────────────────────────

export const ProductSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    price: z.number().nonnegative("Price must be positive"),
    salePrice: z.number().nonnegative().nullable().optional(),

    // R2 storage
    r2Key: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
    fileSize: z.number().int().positive().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    thumbnailKey: z.string().nullable().optional(),

    isPublished: z.boolean().default(false),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

const ProductBaseSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    price: z.number().nonnegative("Price must be positive"),
    salePrice: z.number().nonnegative().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    r2Key: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
    fileSize: z.number().int().positive().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    thumbnailKey: z.string().nullable().optional(),
    isPublished: z.boolean().default(false),
});

export const CreateProductSchema = ProductBaseSchema.refine(
    (data) => data.salePrice == null || data.salePrice <= data.price,
    { message: "Sale price must be less than or equal to regular price", path: ["salePrice"] }
);

const UpdateProductSchemaBase = ProductBaseSchema.partial();

export const UpdateProductSchema = UpdateProductSchemaBase.refine(
    (data) => data.salePrice == null || data.price == null || data.salePrice <= data.price,
    { message: "Sale price must be less than or equal to regular price", path: ["salePrice"] }
);

/** Pre-extended schema for the update contract — avoids .extend() on ZodEffects */
export const UpdateProductWithIdSchema = UpdateProductSchemaBase
    .extend({ productId: z.string().min(1, "Product ID is required") })
    .refine(
        (data) => data.salePrice == null || data.price == null || data.salePrice <= data.price,
        { message: "Sale price must be less than or equal to regular price", path: ["salePrice"] }
    );

export const GetProductSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
});

export const DeleteProductSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
});

export type Product = z.infer<typeof ProductSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type GetProductInput = z.infer<typeof GetProductSchema>;

// ─── Buyer ────────────────────────────────────────────────────────────────────

export const BuyerSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone is required"),
    email: z.email("Invalid email address"),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export const CreateBuyerSchema = BuyerSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type Buyer = z.infer<typeof BuyerSchema>;
export type CreateBuyerInput = z.infer<typeof CreateBuyerSchema>;

// ─── ProductAccess ────────────────────────────────────────────────────────────

export const ProductAccessSchema = z.object({
    id: z.string(),
    productId: z.string(),
    buyerId: z.string(),
    paymentId: z.string().nullable().optional(),
    downloadCount: z.number().int().nonnegative().default(0),
    lastDownloadAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    grantedAt: z.coerce.date(),
});

export type ProductAccess = z.infer<typeof ProductAccessSchema>;

// ─── BuyerAccessToken ─────────────────────────────────────────────────────────

export const BuyerAccessTokenSchema = z.object({
    id: z.string(),
    buyerId: z.string(),
    token: z.string(),
    expiresAt: z.coerce.date(),
    used: z.boolean().default(false),
    createdAt: z.coerce.date(),
});

export type BuyerAccessToken = z.infer<typeof BuyerAccessTokenSchema>;

// ─── Purchase Flow ────────────────────────────────────────────────────────────

// What the portal sends when a buyer checks out
export const PurchaseProductSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    buyerName: z.string().min(2, "Name must be at least 2 characters"),
    buyerEmail: z.email("Invalid email address"),
    buyerPhone: z.string().min(1, "Phone is required"),
});

export const PurchaseProductOutputSchema = z.object({
    paymentUrl: z.string().nullable(),
    reference: z.string(),
    amount: z.number(),
    buyerId: z.string(),
    warning: z.string().optional(),
});

export type PurchaseProductInput = z.infer<typeof PurchaseProductSchema>;
export type PurchaseProductOutput = z.infer<typeof PurchaseProductOutputSchema>;

// ─── Download Flow ────────────────────────────────────────────────────────────

// Buyer requests a download using their access token
export const RequestDownloadSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    token: z.string().min(1, "Access token is required"),
});

export const DownloadOutputSchema = z.object({
    downloadUrl: z.string(),
    fileName: z.string(),
    expiresAt: z.coerce.date(),
});

export type RequestDownloadInput = z.infer<typeof RequestDownloadSchema>;
export type DownloadOutput = z.infer<typeof DownloadOutputSchema>;

// ─── Magic Link Flow ──────────────────────────────────────────────────────────

// Buyer requests a magic link to access their purchases
export const RequestAccessLinkSchema = z.object({
    email: z.email("Invalid email address"),
});

// Verify the token from the magic link
export const VerifyAccessTokenSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

export const VerifyAccessTokenOutputSchema = z.object({
    buyerId: z.string(),
    sessionToken: z.string(),
    purchases: z.array(z.object({
        productId: z.string(),
        productTitle: z.string(),
        downloadCount: z.number(),
        expiresAt: z.coerce.date().nullable(),
        grantedAt: z.coerce.date(),
    })),
});

export type RequestAccessLinkInput = z.infer<typeof RequestAccessLinkSchema>;
export type VerifyAccessTokenInput = z.infer<typeof VerifyAccessTokenSchema>;
export type VerifyAccessTokenOutput = z.infer<typeof VerifyAccessTokenOutputSchema>;