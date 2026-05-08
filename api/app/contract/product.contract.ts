import { baseContract } from "./errors";
import {
    CreateProductSchema,
    GetProductSchema,
    DeleteProductSchema,
    PurchaseProductSchema,
    PurchaseProductOutputSchema,
    RequestDownloadSchema,
    DownloadOutputSchema,
    RequestAccessLinkSchema,
    VerifyAccessTokenSchema,
    VerifyAccessTokenOutputSchema,
    UpdateProductWithIdSchema,
} from "@/schema/product.schema";
import { ProductOutputSchema, ProductListOutputSchema } from "@/schema/output/product.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { z } from "zod";

// ── Admin procedures (authMiddleware) ─────────────────────────────────────────

export const CreateProductContract = baseContract
    .route({
        method: "POST",
        path: "/products",
        successStatus: 201,
        summary: "Create a product",
        description: "Create a product. Requires authentication.",
        tags: ["Products"],
    })
    .input(CreateProductSchema)
    .output(ProductOutputSchema);

export const UpdateProductContract = baseContract
    .route({
        method: "PUT",
        path: "/products/{productId}",
        successStatus: 200,
        summary: "Update a product",
        description: "Update a product. Requires authentication.",
        tags: ["Products"],
    })
    .input(UpdateProductWithIdSchema)
    .output(ProductOutputSchema);

export const DeleteProductContract = baseContract
    .route({
        method: "DELETE",
        path: "/products/{productId}",
        successStatus: 200,
        summary: "Delete a product",
        description: "Delete a product. Requires authentication.",
        tags: ["Products"],
    })
    .input(DeleteProductSchema)
    .output(DeleteOutputSchema);

// ── Public procedures (optionalAuthMiddleware) ────────────────────────────────

export const GetProductContract = baseContract
    .route({
        method: "GET",
        path: "/products/{productId}",
        successStatus: 200,
        summary: "Get a product by ID",
        description: "Get a product by ID",
        tags: ["Products"],
    })
    .input(GetProductSchema)
    .output(ProductOutputSchema);

export const GetAllProductsContract = baseContract
    .route({
        method: "GET",
        path: "/products",
        successStatus: 200,
        summary: "Get all products",
        description: "Get all products",
        tags: ["Products"],
    })
    .input(z.object({ page: z.number().default(1), perPage: z.number().default(20) }))
    .output(ProductListOutputSchema);

// ── Purchase flow ─────────────────────────────────────────────────────────────

export const PurchaseProductContract = baseContract
    .route({
        method: "POST",
        path: "/products/purchase",
        successStatus: 200,
        summary: "Purchase a product",
        description: "Purchase a product",
        tags: ["Products"],
    })
    .input(PurchaseProductSchema)
    .output(PurchaseProductOutputSchema);

// ── Download flow ─────────────────────────────────────────────────────────────

export const RequestDownloadContract = baseContract
    .route({
        method: "POST",
        path: "/products/download",
        successStatus: 200,
        summary: "Request a download link",
        description: "Request a download link",
        tags: ["Products"],
    })
    .input(RequestDownloadSchema)
    .output(DownloadOutputSchema);

// ── Magic link flow ───────────────────────────────────────────────────────────

export const RequestAccessLinkContract = baseContract
    .route({
        method: "POST",
        path: "/products/access-link",
        successStatus: 200,
        summary: "Request an access link",
        description: "Request an access link",
        tags: ["Products"],
    })
    .input(RequestAccessLinkSchema)
    .output(z.object({ sent: z.boolean() }));

export const VerifyAccessTokenContract = baseContract
    .route({
        method: "GET",
        path: "/products/verify-access",
        successStatus: 200,
        summary: "Verify an access token",
        description: "Verify an access token",
        tags: ["Products"],
    })
    .input(VerifyAccessTokenSchema)
    .output(VerifyAccessTokenOutputSchema);