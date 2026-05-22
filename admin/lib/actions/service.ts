"use server";

import { prisma } from "@/lib/prisma";
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

        let studioId: string | null = null;

        if (parsed.data.categoryId) {
            const category = await prisma.category.findUnique({
                where: { id: parsed.data.categoryId },
                select: { studioId: true }
            });
            if (!category) return { status: "error", message: "Category not found" };
            studioId = category.studioId;
        }

        if (!studioId && parsed.data.studioSessionId) {
            const studioSession = await prisma.studioSession.findUnique({
                where: { id: parsed.data.studioSessionId },
                select: { studioId: true }
            });
            if (!studioSession) return { status: "error", message: "Studio session not found" };
            studioId = studioSession.studioId;
        }

        if (!studioId) {
            return { status: "error", message: "Unable to determine owning studio" };
        }

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId }
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

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
                        logisticsIncluded: v.logisticsIncluded,
                        ...(v.deliverables ? {
                            deliverables: {
                                create: v.deliverables.map(d => ({
                                    label: d.label,
                                    quantity: d.quantity,
                                    detail: d.detail,
                                    isFree: d.isFree,
                                })),
                            },
                        } : {}),
                    }))
                }
            },
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service created with pricing variants", data: newService };
    } catch {
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

        const existingVariants = await prisma.serviceVariant.findMany({
            where: { serviceId: id },
            include: { _count: { select: { bookings: true } } },
        });

        const inputLocationTypes = parsed.data.variants.map(v => v.locationType);
        const variantsToRemove = existingVariants.filter(variant => !inputLocationTypes.includes(variant.locationType));
        const variantIdsToRemove = variantsToRemove.map(variant => variant.id);

        if (variantIdsToRemove.length > 0) {
            const referencedBookingCount = await prisma.booking.count({
                where: { serviceVariantId: { in: variantIdsToRemove } },
            });

            if (referencedBookingCount > 0) {
                return {
                    status: "error",
                    message: "Unable to remove pricing variants that are referenced by existing bookings.",
                };
            }
        }

        const existingVariantByLocation = new Map(existingVariants.map(variant => [variant.locationType, variant]));

        const updatedService = await prisma.$transaction(async tx => {
            const serviceUpdate = tx.service.update({
                where: { id },
                data: {
                    name: parsed.data.name,
                    isAddon: parsed.data.isAddon,
                    isActive: parsed.data.isActive,
                    description: parsed.data.description,
                    features: parsed.data.features,
                    studioSessionId: parsed.data.studioSessionId,
                },
            });

            const variantPromises = parsed.data.variants.map(variant => {
                const data = {
                    locationType: variant.locationType,
                    basePrice: variant.basePrice,
                    maxPrice: variant.maxPrice,
                    sessionDurationMins: variant.sessionDurationMins,
                    logisticsIncluded: variant.logisticsIncluded,
                    ...(variant.deliverables ? {
                        deliverables: {
                            deleteMany: {},
                            create: variant.deliverables.map(d => ({
                                label: d.label,
                                quantity: d.quantity,
                                detail: d.detail,
                                isFree: d.isFree,
                            })),
                        },
                    } : {}),
                };

                const existingVariant = existingVariantByLocation.get(variant.locationType);
                if (existingVariant) {
                    return tx.serviceVariant.update({
                        where: { id: existingVariant.id },
                        data,
                    });
                }

                return tx.serviceVariant.create({
                    data: {
                        serviceId: id,
                        ...data,
                    },
                });
            });

            const [updated] = await Promise.all([serviceUpdate, ...variantPromises]);

            if (variantIdsToRemove.length > 0) {
                await tx.serviceVariant.deleteMany({
                    where: { id: { in: variantIdsToRemove } },
                });
            }

            return updated;
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service updated", data: updatedService };
    } catch {
        return { status: "error", message: "Error updating service" };
    }
}

export async function deleteCategory(id: string) {
    try {
        const existing = await prisma.category.findUnique({
            where: { id },
            select: { studioId: true }
        });
        if (!existing) return { status: "error", message: "Category not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: existing.studioId }
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        await prisma.category.delete({ where: { id } });
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Category deleted" };
    } catch {
        return { status: "error", message: "Error deleting category" };
    }
}

export async function deleteService(id: string) {
    try {
        const existing = await prisma.service.findUnique({
            where: { id },
            select: { categoryId: true, studioSessionId: true }
        });
        if (!existing) return { status: "error", message: "Service not found" };

        let studioId: string | null = null;
        if (existing.categoryId) {
            const category = await prisma.category.findUnique({
                where: { id: existing.categoryId },
                select: { studioId: true }
            });
            if (!category) return { status: "error", message: "Category not found" };
            studioId = category.studioId;
        }

        if (!studioId && existing.studioSessionId) {
            const studioSession = await prisma.studioSession.findUnique({
                where: { id: existing.studioSessionId },
                select: { studioId: true }
            });
            if (!studioSession) return { status: "error", message: "Studio session not found" };
            studioId = studioSession.studioId;
        }

        if (!studioId) {
            return { status: "error", message: "Unable to determine owning studio" };
        }

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId }
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        await prisma.service.delete({ where: { id } });
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service deleted" };
    } catch {
        return { status: "error", message: "Error deleting service" };
    }
}