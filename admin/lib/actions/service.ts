"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ServiceSchema, ServicePayload } from "@/lib/schemas/service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import { ServiceCategoryType } from "@/lib/generated/prisma/client";

export async function createService(data: ServicePayload) {
    // 1. Validate payload via Zod
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        let studioId: string | null = parsed.data.studioId || null;

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
                category: parsed.data.category as ServiceCategoryType,
                studioId,
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
        const existing = await prisma.service.findUnique({ where: { id } });
        if (!existing) return { status: "error", message: "Service not found" };

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const existingVariants = await prisma.serviceVariant.findMany({
            where: { serviceId: id },
            include: { _count: { select: { bookings: true } } },
        });

        const inputVariantIds = parsed.data.variants.map(v => v.id).filter(Boolean) as string[];
        const variantsToRemove = existingVariants.filter(variant => !inputVariantIds.includes(variant.id));
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

        const existingVariantById = new Map(existingVariants.map(variant => [variant.id, variant]));

        const updatedService = await prisma.$transaction(async tx => {
            const serviceUpdate = tx.service.update({
                where: { id },
                data: {
                    name: parsed.data.name,
                    isAddon: parsed.data.isAddon,
                    isActive: parsed.data.isActive,
                    description: parsed.data.description,
                    features: parsed.data.features,
                    category: parsed.data.category as ServiceCategoryType,
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
                };

                const existingVariant = variant.id ? existingVariantById.get(variant.id) : null;
                if (existingVariant) {
                    return tx.serviceVariant.update({
                        where: { id: existingVariant.id },
                        data: {
                            ...data,
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
                        },
                    });
                }

                return tx.serviceVariant.create({
                    data: {
                        serviceId: id,
                        ...data,
                        ...(variant.deliverables ? {
                            deliverables: {
                                create: variant.deliverables.map(d => ({
                                    label: d.label,
                                    quantity: d.quantity,
                                    detail: d.detail,
                                    isFree: d.isFree,
                                })),
                            },
                        } : {}),
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
    } catch (error: unknown) {
        console.error("SERVICE UPDATE ERROR:", error);
        return { status: "error", message: error instanceof Error ? error.message : "Error updating service" };
    }
}



export async function deleteService(id: string) {
    try {
        const existing = await prisma.service.findUnique({
            where: { id },
            select: { studioId: true }
        });
        if (!existing) return { status: "error", message: "Service not found" };

        const studioId = existing.studioId;

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

export async function cloneService(serviceId: string, targetStudioId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: targetStudioId }
        });
        if (!member) return { status: "error", message: "Unauthorized access to target studio" };

        const existingService = await prisma.service.findUnique({
            where: { id: serviceId },
            include: {
                studioSession: true,
                variants: {
                    include: { deliverables: true }
                }
            }
        });

        if (!existingService) return { status: "error", message: "Service not found" };

        let targetSessionId = "";
        const existingSession = await prisma.studioSession.findFirst({
            where: {
                studioId: targetStudioId,
                name: existingService.studioSession.name,
                duration: existingService.studioSession.duration
            }
        });

        if (existingSession) {
            targetSessionId = existingSession.id;
        } else {
            const newSession = await prisma.studioSession.create({
                data: {
                    name: existingService.studioSession.name,
                    duration: existingService.studioSession.duration,
                    studioId: targetStudioId
                }
            });
            targetSessionId = newSession.id;
        }

        const newService = await prisma.service.create({
            data: {
                name: existingService.name,
                description: existingService.description,
                features: existingService.features,
                isAddon: existingService.isAddon,
                isActive: existingService.isActive,
                category: existingService.category,
                studioId: targetStudioId,
                studioSessionId: targetSessionId,
                variants: {
                    create: existingService.variants.map(v => ({
                        locationType: v.locationType,
                        basePrice: v.basePrice,
                        maxPrice: v.maxPrice,
                        sessionDurationMins: v.sessionDurationMins,
                        logisticsIncluded: v.logisticsIncluded,
                        deliverables: {
                            create: v.deliverables.map(d => ({
                                label: d.label,
                                quantity: d.quantity,
                                detail: d.detail,
                                isFree: d.isFree
                            }))
                        }
                    }))
                }
            }
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service cloned successfully", data: newService };
    } catch (e) {
        console.error("Failed to clone service:", e);
        return { status: "error", message: "Failed to clone service" };
    }
}