"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireSession } from "./with-auth";

export async function deleteProduct(productId: string) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        await prisma.product.delete({
            where: { id: productId }
        });
        
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
        const products = await prisma.product.findMany({
            include: {
                category: true,
                _count: {
                    select: { purchases: true }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });
        
        return { status: "success" as const, data: products };
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
        const product = await prisma.product.create({
            data: {
                id: data.id,
                title: data.title,
                description: data.description,
                price: data.price,
                salePrice: data.salePrice ?? null,
                categoryId: data.categoryId ?? null,
                isPublished: data.isPublished,
                thumbnailKey: data.thumbnailKey ?? null,
                r2Key: data.r2Key,
                fileName: data.fileName,
                fileSize: data.fileSize,
                mimeType: data.mimeType,
            },
        });

        revalidatePath("/store");
        return { status: "success" as const, data: product };
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
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                category: true,
                _count: {
                    select: { purchases: true }
                }
            }
        });

        if (!product) {
            return { status: "error" as const, message: "Product not found" };
        }

        return { status: "success" as const, data: product };
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
        const product = await prisma.product.update({
            where: { id: productId },
            data: {
                title: data.title,
                description: data.description,
                price: data.price,
                salePrice: data.salePrice ?? null,
                categoryId: data.categoryId ?? null,
                isPublished: data.isPublished,
                thumbnailKey: data.thumbnailKey ?? null,
                r2Key: data.r2Key,
                fileName: data.fileName,
                fileSize: data.fileSize,
                mimeType: data.mimeType,
            },
        });

        revalidatePath("/store");
        revalidatePath(`/store/${productId}`);
        revalidatePath(`/store/${productId}/edit`);

        return { status: "success" as const, data: product };
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
        await prisma.product.update({
            where: { id: productId },
            data: { isPublished },
        });

        revalidatePath("/store");
        revalidatePath(`/store/${productId}`);

        return { status: "success" as const };
    } catch (error) {
        console.error("Failed to toggle publish:", error);
        return { status: "error" as const, message: "Failed to update product" };
    }
}