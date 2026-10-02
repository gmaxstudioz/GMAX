"use server"

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, desc, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { requireSession } from "./with-auth";

export async function fetchPortfolioItems() {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const items = await db.query.portfolioItem.findMany({
            orderBy: [asc(schema.portfolioItem.sortOrder)],
        });
        return { status: "success" as const, data: items };
    } catch (error) {
        console.error("Failed to fetch portfolio items:", error);
        return { status: "error" as const, message: "Failed to fetch portfolio items" };
    }
}

export async function createPortfolioItem(data: {
    title?: string;
    category: string;
    r2Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    thumbnailKey?: string;
    isPublished?: boolean;
}) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const item = await db.transaction(async (tx: any) => {
            const lastItem = await tx.query.portfolioItem.findFirst({
                orderBy: [desc(schema.portfolioItem.sortOrder)],
                columns: { sortOrder: true }
            });

            const sortOrder = (lastItem?.sortOrder ?? 0) + 1;

            return await tx.insert(schema.portfolioItem).values({ id: uuidv4(), 
                    title: data.title || null,
                    category: data.category,
                    r2Key: data.r2Key,
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    mimeType: data.mimeType,
                    thumbnailKey: data.thumbnailKey || null,
                    isPublished: data.isPublished ?? true,
                    sortOrder,
                 }).returning().then((res: any[]) => res[0]);
        });

        revalidatePath("/portfolio");
        return { status: "success" as const, data: item };
    } catch (error) {
        console.error("Failed to create portfolio item:", error);
        return { status: "error" as const, message: "Failed to create portfolio item" };
    }
}

export async function updatePortfolioItem(
    id: string,
    data: {
        title?: string;
        category?: string;
        isPublished?: boolean;
        sortOrder?: number;
    }
) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const item = await db.update(schema.portfolioItem).set({
                ...(data.title !== undefined && { title: data.title || null }),
                ...(data.category !== undefined && { category: data.category }),
                ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
                ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
            }).where(eq(schema.portfolioItem.id, id)).returning().then((res: any[]) => res[0]);

        revalidatePath("/portfolio");
        return { status: "success" as const, data: item };
    } catch (error) {
        console.error("Failed to update portfolio item:", error);
        return { status: "error" as const, message: "Failed to update portfolio item" };
    }
}

export async function deletePortfolioItem(id: string) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        await db.delete(schema.portfolioItem).where(eq(schema.portfolioItem.id, id));
        revalidatePath("/portfolio");
        return { status: "success" as const, message: "Deleted successfully" };
    } catch (error) {
        console.error("Failed to delete portfolio item:", error);
        return { status: "error" as const, message: "Failed to delete portfolio item" };
    }
}

export async function togglePortfolioPublish(id: string, isPublished: boolean) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        await db.update(schema.portfolioItem).set({ isPublished }).where(eq(schema.portfolioItem.id, id)).returning().then((res: any[]) => res[0]);
        revalidatePath("/portfolio");
        return { status: "success" as const };
    } catch (error) {
        console.error("Failed to toggle publish:", error);
        return { status: "error" as const, message: "Failed to update item" };
    }
}
