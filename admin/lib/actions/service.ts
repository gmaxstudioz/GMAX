"use server";

import { db } from "@/lib/db";
import { service, serviceVariant, serviceDeliverable, studioSession, booking, member } from "@/lib/schema";
import { eq, inArray, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { CategorySchema, CategoryPayload, ServiceSchema, ServicePayload } from "@/lib/schemas/service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function createCategory(data: CategoryPayload) {
    return { status: "error", message: "Categories are now managed via enums in Drizzle. This function is deprecated." };
}

export async function updateCategory(id: string, data: CategoryPayload) {
    return { status: "error", message: "Categories are now managed via enums in Drizzle. This function is deprecated." };
}

export async function createService(data: ServicePayload) {
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const userSession = await auth.api.getSession({ headers: await headers() });
        if (!userSession?.user) return { status: "error", message: "Unauthorized" };

        let studioId: string | null = null;

        if (parsed.data.studioSessionId) {
            const sSession = await db.query.studioSession.findFirst({
                where: eq(studioSession.id, parsed.data.studioSessionId),
                columns: { studioId: true }
            });
            if (!sSession) return { status: "error", message: "Studio session not found" };
            studioId = sSession.studioId;
        }

        if (!studioId) {
            return { status: "error", message: "Unable to determine owning studio" };
        }

        const memberRecord = await db.query.member.findFirst({
            where: and(eq(member.userId, userSession.user.id), eq(member.studioId, studioId))
        });
        if (!memberRecord) return { status: "error", message: "Unauthorized access to studio" };

        const newService = await db.transaction(async tx => {
            const [createdService] = await tx.insert(service).values({
                id: crypto.randomUUID(),
                name: parsed.data.name,
                isAddon: parsed.data.isAddon,
                isActive: parsed.data.isActive,
                discountPercentage: parsed.data.discountPercentage ?? 0,
                description: parsed.data.description,
                features: parsed.data.features ?? [],
                category: 'OTHERS',
                studioId: studioId!,
                studioSessionId: parsed.data.studioSessionId,
            }).returning();

            for (const v of parsed.data.variants) {
                const [createdVariant] = await tx.insert(serviceVariant).values({
                    id: crypto.randomUUID(),
                    serviceId: createdService.id,
                    locationType: v.locationType,
                    basePrice: v.basePrice.toString(),
                    maxPrice: v.maxPrice?.toString(),
                    sessionDurationMins: v.sessionDurationMins,
                    logisticsIncluded: v.logisticsIncluded,
                }).returning();

                if (v.deliverables && v.deliverables.length > 0) {
                    await tx.insert(serviceDeliverable).values(v.deliverables.map(d => ({
                        id: crypto.randomUUID(),
                        variantId: createdVariant.id,
                        label: d.label,
                        quantity: d.quantity,
                        detail: d.detail,
                        isFree: d.isFree,
                    })));
                }
            }
            return createdService;
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service created with pricing variants", data: newService };
    } catch (error) {
        console.error(error);
        return { status: "error", message: "Failed to create service" };
    }
}

export async function updateService(id: string, data: ServicePayload) {
    const parsed = ServiceSchema.safeParse(data);
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

    try {
        const existing = await db.query.service.findFirst({ where: eq(service.id, id) });
        if (!existing) return { status: "error", message: "Service not found" };

        const userSession = await auth.api.getSession({ headers: await headers() });
        if (!userSession?.user) return { status: "error", message: "Unauthorized" };

        const existingVariants = await db.query.serviceVariant.findMany({
            where: eq(serviceVariant.serviceId, id),
            with: { bookings: { columns: { id: true } } }
        });

        const inputLocationTypes = parsed.data.variants.map(v => v.locationType);
        const variantsToRemove = existingVariants.filter(variant => !inputLocationTypes.includes(variant.locationType as any));
        const variantIdsToRemove = variantsToRemove.map(variant => variant.id);

        if (variantIdsToRemove.length > 0) {
            const referencedBookingCount = await db.query.booking.findMany({
                where: inArray(booking.serviceVariantId, variantIdsToRemove),
                columns: { id: true }
            });

            if (referencedBookingCount.length > 0) {
                return {
                    status: "error",
                    message: "Unable to remove pricing variants that are referenced by existing bookings.",
                };
            }
        }

        const existingVariantByLocation = new Map(existingVariants.map(variant => [variant.locationType, variant]));

        const updatedService = await db.transaction(async tx => {
            const [updated] = await tx.update(service).set({
                name: parsed.data.name,
                isAddon: parsed.data.isAddon,
                isActive: parsed.data.isActive,
                discountPercentage: parsed.data.discountPercentage ?? 0,
                description: parsed.data.description,
                features: parsed.data.features ?? [],
                studioSessionId: parsed.data.studioSessionId,
            }).where(eq(service.id, id)).returning();

            for (const variant of parsed.data.variants) {
                const existingVariant = existingVariantByLocation.get(variant.locationType as any);
                let variantId: string;
                if (existingVariant) {
                    const [updatedVar] = await tx.update(serviceVariant).set({
                        basePrice: variant.basePrice.toString(),
                        maxPrice: variant.maxPrice?.toString(),
                        sessionDurationMins: variant.sessionDurationMins,
                        logisticsIncluded: variant.logisticsIncluded,
                    }).where(eq(serviceVariant.id, existingVariant.id)).returning();
                    variantId = updatedVar.id;
                } else {
                    const [createdVar] = await tx.insert(serviceVariant).values({
                        id: crypto.randomUUID(),
                        serviceId: id,
                        locationType: variant.locationType,
                        basePrice: variant.basePrice.toString(),
                        maxPrice: variant.maxPrice?.toString(),
                        sessionDurationMins: variant.sessionDurationMins,
                        logisticsIncluded: variant.logisticsIncluded,
                    }).returning();
                    variantId = createdVar.id;
                }

                if (existingVariant) {
                    await tx.delete(serviceDeliverable).where(eq(serviceDeliverable.variantId, variantId));
                }
                
                if (variant.deliverables && variant.deliverables.length > 0) {
                    await tx.insert(serviceDeliverable).values(variant.deliverables.map(d => ({
                        id: crypto.randomUUID(),
                        variantId,
                        label: d.label,
                        quantity: d.quantity,
                        detail: d.detail,
                        isFree: d.isFree,
                    })));
                }
            }

            if (variantIdsToRemove.length > 0) {
                await tx.delete(serviceVariant).where(inArray(serviceVariant.id, variantIdsToRemove));
            }

            return updated;
        });

        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service updated", data: updatedService };
    } catch (error) {
        console.error(error);
        return { status: "error", message: "Error updating service" };
    }
}

export async function deleteCategory(id: string) {
    return { status: "error", message: "Categories are now managed via enums in Drizzle. This function is deprecated." };
}

export async function deleteService(id: string) {
    try {
        const existing = await db.query.service.findFirst({
            where: eq(service.id, id),
            columns: { studioId: true }
        });
        if (!existing) return { status: "error", message: "Service not found" };

        const userSession = await auth.api.getSession({ headers: await headers() });
        if (!userSession?.user) return { status: "error", message: "Unauthorized" };

        const memberRecord = await db.query.member.findFirst({
            where: and(eq(member.userId, userSession.user.id), eq(member.studioId, existing.studioId))
        });
        if (!memberRecord) return { status: "error", message: "Unauthorized access to studio" };

        await db.delete(service).where(eq(service.id, id));
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: "Service deleted" };
    } catch (error) {
        console.error(error);
        return { status: "error", message: "Error deleting service" };
    }
}
export async function bulkUpdateDiscount(studioId: string, discountPercentage: number) {
    try {
        const userSession = await auth.api.getSession({ headers: await headers() });
        if (!userSession?.user) return { status: "error", message: "Unauthorized" };

        const memberRecord = await db.query.member.findFirst({
            where: and(eq(member.userId, userSession.user.id), eq(member.studioId, studioId))
        });
        if (!memberRecord) return { status: "error", message: "Unauthorized access to studio" };

        await db.update(service).set({ discountPercentage }).where(eq(service.studioId, studioId));
        revalidatePath(`/studios/[slug]`, "page");
        return { status: "success", message: `Discount of ${discountPercentage}% applied to all services.` };
    } catch (error) {
        console.error(error);
        return { status: "error", message: "Error updating services" };
    }
}
