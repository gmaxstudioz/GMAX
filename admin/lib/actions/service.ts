"use server";

import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { CategorySchema, CategoryPayload, ServiceSchema, ServicePayload } from "@/lib/schemas/service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function createCategory(data: CategoryPayload) {
    const parsed = CategorySchema.safeParse(data);
    if (!parsed.success) {
        return { status: "error", message: parsed.error.issues[0].message };
    }

    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: parsed.data.studioId! },
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        const newCategory = await prisma.category.create({
            data: {
                name: parsed.data.name,
                type: parsed.data.type || "standard",
                studioId: parsed.data.studioId!,
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Category created successfully", data: newCategory };
    } catch (error: any) {
        console.error("Failed to create category:", error);
        return { status: "error", message: error.message || "Failed to create category" };
    }
}

export async function updateCategory(id: string, data: CategoryPayload) {
    const parsed = CategorySchema.safeParse(data);
    if (!parsed.success) {
        return { status: "error", message: parsed.error.issues[0].message };
    }

    try {
        const existing = await prisma.category.findUnique({ where: { id } });
        if (!existing) return { status: "error", message: "Category not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: existing.studioId },
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        const updatedCategory = await prisma.category.update({
            where: { id },
            data: {
                name: parsed.data.name,
                ...(parsed.data.type ? { type: parsed.data.type } : {}),
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Category updated", data: updatedCategory };
    } catch (error: any) {
        return { status: "error", message: "Error updating category" };
    }
}

export async function createService(data: ServicePayload) {
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) {
        return { status: "error", message: parsed.error.issues[0].message };
    }

    try {
        const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId! } });
        if (!category) return { status: "error", message: "Category not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: category.studioId },
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        const id = uuidv4();
        const newService = await prisma.service.create({
            data: {
                id,
                name: parsed.data.name,
                type: parsed.data.type,
                description: parsed.data.description,
                features: parsed.data.features,
                price: parsed.data.price,
                salePrice: parsed.data.salePrice,
                categoryId: parsed.data.categoryId!,
                studioSessionId: parsed.data.studioSessionId,
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service added successfully", data: newService };
    } catch (error: any) {
        console.error("Failed to add service:", error);
        return { status: "error", message: error.message || "Failed to add service" };
    }
}

export async function updateService(id: string, data: ServicePayload) {
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const existing = await prisma.service.findUnique({ where: { id }, include: { category: true } });
        if (!existing) return { status: "error", message: "Service not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: existing.category.studioId },
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        const updatedService = await prisma.service.update({
            where: { id },
            data: {
                name: parsed.data.name,
                ...(parsed.data.type ? { type: parsed.data.type } : {}),
                description: parsed.data.description,
                features: parsed.data.features,
                price: parsed.data.price,
                salePrice: parsed.data.salePrice,
                studioSessionId: parsed.data.studioSessionId,
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service updated", data: updatedService };
    } catch (error: any) {
        return { status: "error", message: "Error updating service" };
    }
}

export async function deleteCategory(id: string) {
    try {
        const existing = await prisma.category.findUnique({ where: { id } });
        if (!existing) return { status: "error", message: "Category not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: existing.studioId },
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        await prisma.category.delete({ where: { id } });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Category deleted" };
    } catch (error: any) {
        return { status: "error", message: "Error deleting category" };
    }
}

export async function deleteService(id: string) {
    try {
        const existing = await prisma.service.findUnique({ where: { id }, include: { category: true } });
        if (!existing) return { status: "error", message: "Service not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: existing.category.studioId },
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        await prisma.service.delete({ where: { id } });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service deleted" };
    } catch (error: any) {
        return { status: "error", message: "Error deleting service" };
    }
}

// ── Fetch Services ───────────────────────────────────────────────────────────

export async function FetchServices(studioId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error" as const, message: "Unauthorized", data: [] };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId },
        });
        if (!member) {
            return { status: "error" as const, message: "Unauthorized access to studio", data: [] };
        }

        const data = await prisma.service.findMany({
            where: { category: { studioId } },
            include: { category: true, studioSession: true },
            orderBy: { createdAt: "desc" },
        });

        revalidatePath("/services", "page");
        return { status: "success" as const, message: "Services fetched successfully", data };
    } catch (error) {
        console.error("[Action] FetchServices failed:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to fetch services",
            data: [],
        };
    }
}