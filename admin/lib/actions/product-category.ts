"use server"

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, or, ilike } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { requireSession } from "./with-auth";

export async function getProductCategories() {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const categories = await db.query.productCategory.findMany({
            orderBy: (productCategory, { asc }) => [asc(productCategory.name)],
            with: {
                products: {
                    columns: { id: true },
                },
            },
        });

        const mapped = categories.map(c => ({
            ...c,
            _count: { products: c.products.length }
        }));

        return { status: "success" as const, data: mapped as any };
    } catch (error) {
        console.error("Failed to fetch product categories:", error);
        return { status: "error" as const, message: "Failed to fetch categories" };
    }
}

export async function createProductCategory(data: { name: string }) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        // Generate slug from name
        const slug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

        const existing = await db.query.productCategory.findFirst({
            where: or(
                ilike(schema.productCategory.name, data.name),
                eq(schema.productCategory.slug, slug)
            )
        });

        if (existing) {
            return { status: "error" as const, message: "A category with this name already exists" };
        }

        const category = await db.insert(schema.productCategory).values({
            id: uuidv4(),
            name: data.name,
            slug
        }).returning().then(res => res[0]);

        revalidatePath("/store");
        return { status: "success" as const, data: category };
    } catch (error) {
        console.error("Failed to create product category:", error);
        return { status: "error" as const, message: "Failed to create category" };
    }
}

export async function deleteProductCategory(categoryId: string) {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        await db.delete(schema.productCategory).where(eq(schema.productCategory.id, categoryId));

        revalidatePath("/store");
        return { status: "success" as const, message: "Category deleted" };
    } catch (error) {
        console.error("Failed to delete product category:", error);
        return { status: "error" as const, message: "Failed to delete category" };
    }
}
