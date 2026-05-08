"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireSession } from "./with-auth";

export async function getProductCategories() {
    const authResult = await requireSession();
    if (authResult.status === "error") {
        return { status: "error" as const, message: "Unauthorized" };
    }

    try {
        const categories = await prisma.productCategory.findMany({
            orderBy: { name: "asc" },
            include: {
                _count: { select: { products: true } },
            },
        });

        return { status: "success" as const, data: categories };
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

        const existing = await prisma.productCategory.findFirst({
            where: {
                OR: [
                    { name: { equals: data.name, mode: "insensitive" } },
                    { slug },
                ],
            },
        });

        if (existing) {
            return { status: "error" as const, message: "A category with this name already exists" };
        }

        const category = await prisma.productCategory.create({
            data: { name: data.name, slug },
        });

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
        await prisma.productCategory.delete({
            where: { id: categoryId },
        });

        revalidatePath("/store");
        return { status: "success" as const, message: "Category deleted" };
    } catch (error) {
        console.error("Failed to delete product category:", error);
        return { status: "error" as const, message: "Failed to delete category" };
    }
}
