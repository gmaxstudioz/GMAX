"use server"

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "./with-auth";

export async function deleteProduct(productId: string) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        await db.delete(schema.product).where(eq(schema.product.id, productId));
        
        revalidatePath("/store");
        return { status: "success" as const, message: "Product deleted successfully" };
    } catch (error) {
        console.error("Failed to delete product:", error);
        return { status: "error" as const, message: "Failed to delete product" };
    }
}

export async function FetchProducts() {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const products = await db.query.product.findMany({
            with: {
                productCategory: true,
                productAccesses: {
                    columns: { id: true }
                }
            },
            orderBy: (product, { desc }) => [desc(product.createdAt)]
        });
        
        const mapped = products.map(p => ({
            ...p,
            category: p.productCategory,
            _count: { purchases: p.productAccesses.length }
        }));

        return { status: "success" as const, data: mapped as any };
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return { status: "error" as const, message: "Failed to fetch products" };
    }
}

export async function createProduct(data: {
    id: string;
    title: string;
    description: string;
    price: number;
    salePrice?: number;
    categoryId?: string;
    isPublished: boolean;
    thumbnailKey?: string;
    r2Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const product = await db.insert(schema.product).values({
            id: data.id,
            title: data.title,
            description: data.description,
            price: data.price.toString(),
            salePrice: data.salePrice?.toString() ?? null,
            categoryId: data.categoryId ?? null,
            isPublished: data.isPublished,
            thumbnailKey: data.thumbnailKey ?? null,
            r2Key: data.r2Key,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
        }).returning().then(res => res[0]);

        revalidatePath("/store");
        return { status: "success" as const, data: product as any };
    } catch (error) {
        console.error("Failed to create product:", error);
        return { status: "error" as const, message: "Failed to create product" };
    }
}

export async function getProduct(productId: string) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const product = await db.query.product.findFirst({
            where: eq(schema.product.id, productId),
            with: {
                productCategory: true,
                productAccesses: {
                    columns: { id: true }
                }
            }
        });

        if (!product) {
            return { status: "error" as const, message: "Product not found" };
        }

        const mapped = {
            ...product,
            category: product.productCategory,
            _count: { purchases: product.productAccesses.length }
        };

        return { status: "success" as const, data: mapped as any };
    } catch (error) {
        console.error("Failed to fetch product:", error);
        return { status: "error" as const, message: "Failed to fetch product" };
    }
}

export async function updateProduct(
    productId: string,
    data: {
        title: string;
        description: string;
        price: number;
        salePrice?: number;
        categoryId?: string;
        isPublished: boolean;
        thumbnailKey?: string;
        r2Key: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
    }
) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const product = await db.update(schema.product).set({
            title: data.title,
            description: data.description,
            price: data.price.toString(),
            salePrice: data.salePrice?.toString() ?? null,
            categoryId: data.categoryId ?? null,
            isPublished: data.isPublished,
            thumbnailKey: data.thumbnailKey ?? null,
            r2Key: data.r2Key,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
        }).where(eq(schema.product.id, productId)).returning().then(res => res[0]);

        revalidatePath("/store");
        revalidatePath(`/store/${productId}`);
        revalidatePath(`/store/${productId}/edit`);

        return { status: "success" as const, data: product as any };
    } catch (error) {
        console.error("Failed to update product:", error);
        return { status: "error" as const, message: "Failed to update product" };
    }
}

export async function togglePublish(productId: string, isPublished: boolean) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        await db.update(schema.product).set({ isPublished }).where(eq(schema.product.id, productId));

        revalidatePath("/store");
        revalidatePath(`/store/${productId}`);

        return { status: "success" as const };
    } catch (error) {
        console.error("Failed to toggle publish:", error);
        return { status: "error" as const, message: "Failed to update product" };
    }
}