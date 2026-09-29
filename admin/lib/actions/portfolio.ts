"use server"

import { db } from "@/lib/db";
import { portfolioItem } from "@/lib/schema";
import { eq, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "./with-auth";

export async function fetchPortfolioItems() {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const items = await db.query.portfolioItem.findMany({
            orderBy: asc(portfolioItem.sortOrder),
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
        const item = await db.transaction(async (tx) => {
            const result = await tx.execute(sql`SELECT nextval('portfolio_item_sort_order_seq') AS nextval`);
            const sequenceRow = result.rows[0] as { nextval: string | number };
            const sortOrder = Number(sequenceRow?.nextval ?? 1);

            const [newItem] = await tx.insert(portfolioItem).values({
                id: crypto.randomUUID(),
                title: data.title || null,
                category: data.category,
                r2Key: data.r2Key,
                fileName: data.fileName,
                fileSize: data.fileSize,
                mimeType: data.mimeType,
                thumbnailKey: data.thumbnailKey || null,
                isPublished: data.isPublished ?? true,
                sortOrder,
            }).returning();
            
            return newItem;
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
        const [item] = await db.update(portfolioItem).set({
            title: data.title !== undefined ? (data.title || null) : undefined,
            category: data.category !== undefined ? data.category : undefined,
            isPublished: data.isPublished !== undefined ? data.isPublished : undefined,
            sortOrder: data.sortOrder !== undefined ? data.sortOrder : undefined,
        }).where(eq(portfolioItem.id, id)).returning();

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
        await db.delete(portfolioItem).where(eq(portfolioItem.id, id));
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
        await db.update(portfolioItem)
            .set({ isPublished })
            .where(eq(portfolioItem.id, id));
        revalidatePath("/portfolio");
        return { status: "success" as const };
    } catch (error) {
        console.error("Failed to toggle publish:", error);
        return { status: "error" as const, message: "Failed to update item" };
    }
}
