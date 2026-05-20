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
    } catch (error) {
        console.error("Failed to create category:", error);
        return { status: "error", message: error instanceof Error ? error.message : "Failed to create category" };
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
    } catch {
        return { status: "error", message: "Error updating category" };
    }
}

export async function createService(data: ServicePayload) {
    // 1. Validate payload via Zod
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        // 2. Transactional creation
        const newService = await prisma.service.create({
            data: {
                name: parsed.data.name,
                isAddon: parsed.data.isAddon,
                isActive: parsed.data.isActive,
                description: parsed.data.description,
                features: parsed.data.features,
                categoryId: parsed.data.categoryId!,
                studioSessionId: parsed.data.studioSessionId,
                variants: {
                    create: parsed.data.variants.map(v => ({
                        locationType: v.locationType,
                        basePrice: v.basePrice,
                        maxPrice: v.maxPrice,
                        sessionDurationMins: v.sessionDurationMins,
                        logisticsIncluded: v.logisticsIncluded
                    }))
                }
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service created with pricing variants", data: newService };
    } catch (error) {
        return { status: "error", message: "Failed to create service" };
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

        // We delete old variants and create new ones to ensure clean sync
        const updatedService = await prisma.service.update({
            where: { id },
            data: {
                name: parsed.data.name,
                isAddon: parsed.data.isAddon,
                isActive: parsed.data.isActive,
                description: parsed.data.description,
                features: parsed.data.features,
                studioSessionId: parsed.data.studioSessionId,
                variants: {
                    deleteMany: {},
                    create: parsed.data.variants.map(v => ({
                        locationType: v.locationType,
                        basePrice: v.basePrice,
                        maxPrice: v.maxPrice,
                        sessionDurationMins: v.sessionDurationMins,
                        logisticsIncluded: v.logisticsIncluded
                    }))
                }
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service updated", data: updatedService };
    } catch {
        return { status: "error", message: "Error updating service" };
    }
}

export async function deleteCategory(id: string) {
    try {
        await prisma.category.delete({ where: { id } });
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Category deleted" };
    } catch {
        return { status: "error", message: "Error deleting category" };
    }
}

export async function deleteService(id: string) {
    try {
        await prisma.service.delete({ where: { id } });
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service deleted" };
    } catch {
        return { status: "error", message: "Error deleting service" };
    }
}