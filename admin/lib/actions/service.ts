"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ServiceSchema, ServicePayload } from "@/lib/schemas/service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

// If ServiceCategoryType is an enum in schema, we can cast it if needed.
// type ServiceCategoryType = any;

export async function createService(data: ServicePayload) {
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const userSession = await auth.api.getSession({ headers: await headers() });
        if (!userSession?.user) return { status: "error", message: "Unauthorized" };

        let studioId: string | null = parsed.data.studioId || null;

        if (!studioId && parsed.data.studioSessionId) {
            const studioSession = await db.query.studioSession.findFirst({
                where: eq(schema.studioSession.id, parsed.data.studioSessionId),
                columns: { studioId: true }
            });
            if (!studioSession) return { status: "error", message: "Studio session not found" };
            studioId = studioSession.studioId;
        }

        if (!studioId) {
            return { status: "error", message: "Unable to determine owning studio" };
        }

        const member = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, userSession.user.id),
                eq(schema.member.studioId, studioId)
            )
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        const newServiceId = uuidv4();

        await db.transaction(async (tx) => {
            await tx.insert(schema.service).values({
                id: newServiceId,
                name: parsed.data.name,
                isAddon: parsed.data.isAddon ?? false,
                isActive: parsed.data.isActive ?? true,
                description: parsed.data.description,
                features: parsed.data.features ?? [],
                category: parsed.data.category as any,
                studioId: studioId!,
                studioSessionId: parsed.data.studioSessionId ?? "",
            });

            if (parsed.data.variants && parsed.data.variants.length > 0) {
                for (const v of parsed.data.variants) {
                    const variantId = uuidv4();
                    await tx.insert(schema.serviceVariant).values({
                        id: variantId,
                        serviceId: newServiceId,
                        title: (v as any).title,
                        locationType: (v as any).locationType,
                        basePrice: (v as any).basePrice.toString(),
                        maxPrice: (v as any).maxPrice ? (v as any).maxPrice.toString() : null,
                        sessionDurationMins: (v as any).sessionDurationMins,
                        logisticsIncluded: (v as any).logisticsIncluded ?? true,
                    });

                    if ((v as any).deliverables && (v as any).deliverables.length > 0) {
                        const deliverablesToInsert = (v as any).deliverables.map((d: any) => ({
                            id: uuidv4(),
                            variantId: variantId,
                            label: d.label,
                            quantity: d.quantity,
                            detail: d.detail,
                            isFree: d.isFree ?? false,
                        }));
                        await tx.insert(schema.serviceDeliverable).values(deliverablesToInsert);
                    }
                }
            }
        });
        
        const newService = await db.query.service.findFirst({
            where: eq(schema.service.id, newServiceId),
            with: { serviceVariants: { with: { serviceDeliverables: true } } }
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service created with pricing variants", data: newService };
    } catch (e: any) {
        console.error(e);
        return { status: "error", message: "Failed to create service" };
    }
}

export async function updateService(id: string, data: ServicePayload) {
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const existing = await db.query.service.findFirst({ where: eq(schema.service.id, id) });
        if (!existing) return { status: "error", message: "Service not found" };

        const userSession = await auth.api.getSession({ headers: await headers() });
        if (!userSession?.user) return { status: "error", message: "Unauthorized" };

        const existingVariants = await db.query.serviceVariant.findMany({
            where: eq(schema.serviceVariant.serviceId, id),
        });

        const inputVariantIds = parsed.data.variants.map((v: any) => v.id).filter(Boolean) as string[];
        const variantsToRemove = existingVariants.filter((variant: any) => !inputVariantIds.includes(variant.id));
        const variantIdsToRemove = variantsToRemove.map((variant: any) => variant.id);

        if (variantIdsToRemove.length > 0) {
            const referencedBookings = await db.query.booking.findMany({
                where: inArray(schema.booking.serviceVariantId, variantIdsToRemove as any),
                columns: { id: true }
            });

            if (referencedBookings.length > 0) {
                return {
                    status: "error",
                    message: "Unable to remove pricing variants that are referenced by existing bookings.",
                };
            }
        }

        const existingVariantById = new Map(existingVariants.map((variant: any) => [variant.id, variant]));

        await db.transaction(async (tx) => {
            await tx.update(schema.service).set({
                name: parsed.data.name,
                isAddon: parsed.data.isAddon ?? false,
                isActive: parsed.data.isActive ?? true,
                description: parsed.data.description,
                features: parsed.data.features ?? [],
                category: parsed.data.category as any,
                studioSessionId: parsed.data.studioSessionId ?? "",
            }).where(eq(schema.service.id, id));

            for (const variant of parsed.data.variants) {
                const variantData = {
                    title: (variant as any).title,
                    locationType: (variant as any).locationType,
                    basePrice: (variant as any).basePrice.toString(),
                    maxPrice: (variant as any).maxPrice ? (variant as any).maxPrice.toString() : null,
                    sessionDurationMins: (variant as any).sessionDurationMins,
                    logisticsIncluded: (variant as any).logisticsIncluded ?? true,
                };

                const existingVariant = (variant as any).id ? existingVariantById.get((variant as any).id) : null;
                
                let currentVariantId = (variant as any).id;

                if (existingVariant) {
                    await tx.update(schema.serviceVariant)
                        .set(variantData)
                        .where(eq(schema.serviceVariant.id, existingVariant.id));
                    
                    if ((variant as any).deliverables) {
                        await tx.delete(schema.serviceDeliverable)
                            .where(eq(schema.serviceDeliverable.variantId, existingVariant.id));
                        
                        if ((variant as any).deliverables.length > 0) {
                            const deliverablesToInsert = (variant as any).deliverables.map((d: any) => ({
                                id: uuidv4(),
                                variantId: existingVariant.id,
                                label: d.label,
                                quantity: d.quantity,
                                detail: d.detail,
                                isFree: d.isFree ?? false,
                            }));
                            await tx.insert(schema.serviceDeliverable).values(deliverablesToInsert);
                        }
                    }
                } else {
                    currentVariantId = uuidv4();
                    await tx.insert(schema.serviceVariant).values({
                        id: currentVariantId,
                        serviceId: id,
                        ...variantData,
                    });

                    if ((variant as any).deliverables && (variant as any).deliverables.length > 0) {
                        const deliverablesToInsert = (variant as any).deliverables.map((d: any) => ({
                            id: uuidv4(),
                            variantId: currentVariantId,
                            label: d.label,
                            quantity: d.quantity,
                            detail: d.detail,
                            isFree: d.isFree ?? false,
                        }));
                        await tx.insert(schema.serviceDeliverable).values(deliverablesToInsert);
                    }
                }
            }

            if (variantIdsToRemove.length > 0) {
                await tx.delete(schema.serviceVariant).where(inArray(schema.serviceVariant.id, variantIdsToRemove as any));
            }
        });
        
        const updatedService = await db.query.service.findFirst({
            where: eq(schema.service.id, id),
            with: { serviceVariants: { with: { serviceDeliverables: true } } }
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service updated", data: updatedService };
    } catch (error: any) {
        console.error("SERVICE UPDATE ERROR:", error);
        return { status: "error", message: error instanceof Error ? error.message : "Error updating service" };
    }
}

export async function deleteService(id: string) {
    try {
        const existing = await db.query.service.findFirst({
            where: eq(schema.service.id, id),
            columns: { studioId: true }
        });
        if (!existing) return { status: "error", message: "Service not found" };

        const studioId = existing.studioId;

        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, session.user.id),
                eq(schema.member.studioId, studioId)
            )
        });
        if (!member) return { status: "error", message: "Unauthorized access to studio" };

        await db.delete(schema.service).where(eq(schema.service.id, id));
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service deleted" };
    } catch (error) {
        console.error(error);
        return { status: "error", message: "Error deleting service" };
    }
}

export async function cloneService(serviceId: string, targetStudioId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const member = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, session.user.id),
                eq(schema.member.studioId, targetStudioId)
            )
        });
        if (!member) return { status: "error", message: "Unauthorized access to target studio" };

        const existingService = await db.query.service.findFirst({
            where: eq(schema.service.id, serviceId),
            with: {
                studioSession: true,
                serviceVariants: {
                    with: { serviceDeliverables: true }
                }
            }
        });

        if (!existingService) return { status: "error", message: "Service not found" };

        let targetSessionId = "";
        
        const existingSession = await db.query.studioSession.findFirst({
            where: and(
                eq(schema.studioSession.studioId, targetStudioId),
                eq(schema.studioSession.name, existingService.studioSession.name),
                eq(schema.studioSession.duration, existingService.studioSession.duration)
            )
        });

        if (existingSession) {
            targetSessionId = existingSession.id;
        } else {
            targetSessionId = uuidv4();
            await db.insert(schema.studioSession).values({
                id: targetSessionId,
                name: existingService.studioSession.name,
                duration: existingService.studioSession.duration,
                studioId: targetStudioId
            });
        }

        const newServiceId = uuidv4();
        await db.transaction(async (tx) => {
            await tx.insert(schema.service).values({
                id: newServiceId,
                name: existingService.name,
                description: existingService.description,
                features: existingService.features,
                isAddon: existingService.isAddon,
                isActive: existingService.isActive,
                category: existingService.category as any,
                studioId: targetStudioId,
                studioSessionId: targetSessionId,
            });

            for (const v of existingService.serviceVariants) {
                const newVariantId = uuidv4();
                await tx.insert(schema.serviceVariant).values({
                    id: newVariantId,
                    serviceId: newServiceId,
                    title: v.title,
                    locationType: v.locationType,
                    basePrice: v.basePrice.toString(),
                    maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                    sessionDurationMins: v.sessionDurationMins,
                    logisticsIncluded: v.logisticsIncluded,
                });

                if (v.serviceDeliverables && v.serviceDeliverables.length > 0) {
                    const deliverablesToInsert = v.serviceDeliverables.map((d: any) => ({
                        id: uuidv4(),
                        variantId: newVariantId,
                        label: d.label,
                        quantity: d.quantity,
                        detail: d.detail,
                        isFree: d.isFree,
                    }));
                    await tx.insert(schema.serviceDeliverable).values(deliverablesToInsert);
                }
            }
        });

        const newService = await db.query.service.findFirst({
            where: eq(schema.service.id, newServiceId),
            with: { serviceVariants: { with: { serviceDeliverables: true } } }
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service cloned successfully", data: newService };
    } catch (e) {
        console.error("Failed to clone service:", e);
        return { status: "error", message: "Failed to clone service" };
    }
}

export async function bulkUpdateServiceDiscounts(serviceIds: string[], discountPercentage: number) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        await db.update(schema.service)
            .set({ discountPercentage })
            .where(inArray(schema.service.id, serviceIds));
            
        return { status: "success", message: "Discounts updated successfully" };
    } catch (error) {
        console.error("Failed to update discounts:", error);
        return { status: "error", message: "Failed to update discounts" };
    }
}
