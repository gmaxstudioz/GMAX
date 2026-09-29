/* eslint-disable @typescript-eslint/no-explicit-any */
import { contract } from "@/app/contract";
import { db } from "@/lib/db";
import { eq, and, or, inArray, asc, desc, isNull, sql } from "drizzle-orm";
import { studio, service, booking, bookingIntent, client, payment, bookingAddons } from "@/lib/schema";
import { implement } from "@orpc/server";
import { optionalAuthMiddleware, authMiddleware, BaseContext } from "./middleware";
import { calculateGrandTotal } from "@/lib/pricing";
import { v4 as uuidv4 } from "uuid";
import { paystackFetch } from "@/lib/paystack";
import { getPostHogClient } from "@/lib/auth";

const os = implement(contract).$context<BaseContext>();

async function captureEvent(event: string, properties: Record<string, string | number | boolean>) {
    const posthog = getPostHogClient();
    if (!posthog) return;

    posthog.capture({ event, properties });
    await posthog.flush();
}

const mapBookingToOutput = (data: any) => {
    const totalPaid = data.payments
        .filter((p: any) => p.status === "PAID")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    // Note: Assuming you fixed calculateGrandTotal previously to accept the new variant logic
    // If not, you might need to adjust what gets passed in here.
    const grandTotal = Number(data.totalAmount || 0); // Safest to use the saved totalAmount
    const balanceDue = grandTotal - totalPaid;

    return {
        id: data.id,
        bookingDate: data.bookingDate.toISOString(),
        sessionCount: data.sessionCount,
        notes: data.notes,
        bookingStatus: data.bookingStatus,
        paymentStatus: data.paymentStatus,
        deliveryStatus: data.deliveryStatus,
        serviceId: data.serviceId,
        studioId: data.studioId,
        clientId: data.clientId,
        createdBy: data.createdBy,
        memberId: data.memberId,
        createdAt: data.createdAt.toISOString(),
        updatedAt: data.updatedAt.toISOString(),

        client: {
            id: data.client.id,
            name: data.client.name,
            phone: data.client.phone,
            email: data.client.email,
            type: data.client.type,
        },
        service: {
            id: data.service.id,
            name: data.service.name,
            isAddon: data.service.isAddon,
            variants: data.service.serviceVariants ? data.service.serviceVariants.map((v: any) => ({
                id: v.id,
                locationType: v.locationType,
                basePrice: v.basePrice.toString(),
                maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                sessionDurationMins: v.sessionDurationMins,
                logisticsIncluded: v.logisticsIncluded,
            })) : [],
        },
        member: {
            id: data.member.id,
            studioId: data.member.studioId,
            userId: data.member.userId,
            role: data.member.role,
            createdAt: data.member.createdAt.toISOString(),
            user: {
                id: data.member.user.id,
                name: data.member.user.name,
                email: data.member.user.email,
                emailVerified: data.member.user.emailVerified,
                image: data.member.user.image,
                phoneNumber: data.member.user.phoneNumber,
                phoneNumberVerified: data.member.user.phoneNumberVerified,
                createdAt: data.member.user.createdAt.toISOString(),
                updatedAt: data.member.user.updatedAt.toISOString(),
            }
        },
        addons: (data.bookingAddons || []).map((ba: any) => ba.service).map((a: any) => ({
            id: a.id,
            name: a.name,
            isAddon: a.isAddon,
            variants: a.serviceVariants ? a.serviceVariants.map((v: any) => ({
                id: v.id,
                locationType: v.locationType,
                basePrice: v.basePrice.toString(),
                maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                sessionDurationMins: v.sessionDurationMins,
                logisticsIncluded: v.logisticsIncluded,
            })) : [],
        })),
        payments: data.payments.map((p: any) => ({
            id: p.id,
            amount: p.amount.toString(),
            method: p.method,
            status: p.status,
            receiptNumber: p.receiptNumber,
            paymentDate: p.paymentDate.toISOString(),
        })),
        photos: data.photos.map((p: any) => ({
            id: p.id,
            fileName: p.fileName,
            approvalStatus: p.approvalStatus,
            uploadedAt: p.uploadedAt.toISOString(),
            expiresAt: p.expiresAt.toISOString(),
            downloadCount: p.downloadCount,
        })),

        totalPaid: totalPaid.toString(),
        balanceDue: balanceDue.toString(),
        photoCount: data.photos.length,
    };
};

const mapBookingSummaryToOutput = (data: any) => {
    const totalPaid = data.payments
        .filter((p: any) => p.status === "PAID")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    
    const grandTotal = Number(data.totalAmount || 0);
    const balanceDue = grandTotal - totalPaid;

    return {
        id: data.id,
        bookingDate: data.bookingDate.toISOString(),
        sessionCount: data.sessionCount,
        bookingStatus: data.bookingStatus,
        paymentStatus: data.paymentStatus,
        deliveryStatus: data.deliveryStatus,
        createdAt: data.createdAt.toISOString(),
        client: {
            id: data.client.id,
            name: data.client.name,
            phone: data.client.phone,
            email: data.client.email,
            type: data.client.type,
        },
        service: {
            id: data.service.id,
            name: data.service.name,
            isAddon: data.service.isAddon,
            variants: data.service.serviceVariants ? data.service.serviceVariants.map((v: any) => ({
                id: v.id,
                locationType: v.locationType,
                basePrice: v.basePrice.toString(),
                maxPrice: v.maxPrice ? v.maxPrice.toString() : null,
                sessionDurationMins: v.sessionDurationMins,
                logisticsIncluded: v.logisticsIncluded,
            })) : [],
        },
        totalPaid: totalPaid.toString(),
        balanceDue: balanceDue.toString(),
    };
};

export const createBookings = os.booking.create.use(optionalAuthMiddleware).handler(
    async ({ input, context, errors }) => {
        const { addonIds, createdBy, memberId, ...bookingData } = input;

        const studio = await db.query.studio.findFirst({
            where: (model, { eq }) => eq(model.id, bookingData.studioId),
            with: { members: true },
        });

        if (!studio) {
            throw errors.NOT_FOUND({
                data: { resourceType: "Studio", resourceId: bookingData.studioId },
            });
        }

        // 1. Fetch Service & Add-ons to calculate the total amount securely
        const service = await db.query.service.findFirst({
            where: (model, { eq }) => eq(model.id, bookingData.serviceId),
            with: { serviceVariants: true }
        });
        
        if (!service) throw errors.NOT_FOUND({
            data: { resourceType: "Service", resourceId: bookingData.serviceId }
        });

        let fetchedAddons: any[] = [];
        let addonMapById: Record<string, any> = {};
        if (addonIds && addonIds.length > 0) {
            fetchedAddons = await db.query.service.findMany({
                where: (model, { inArray }) => inArray(model.id, addonIds),
                with: { serviceVariants: true }
            });
            // Create a map from addon ID to addon object for consistent lookup
            addonMapById = Object.fromEntries(fetchedAddons.map(addon => [addon.id, addon]));
        }

        // 2. Build pricing objects for the calculator
        // Use the first available variant (default/primary variant) for pricing calculation
        const servicePricingObj = {
            price: service.serviceVariants?.[0]?.basePrice ? Number(service.serviceVariants[0].basePrice) : 0,
            salePrice: null
        };
        // Map addon IDs to their pricing in the order they were selected, using the first variant of each addon
        const addonPricingObjs = (addonIds || []).map(addonId => {
            const addon = addonMapById[addonId];
            return {
                price: addon?.serviceVariants?.[0]?.basePrice ? Number(addon.serviceVariants[0].basePrice) : 0,
                salePrice: null
            };
        });

        // 3. Calculate the grand total
        const grandTotal = calculateGrandTotal(servicePricingObj, addonPricingObjs, bookingData.sessionCount);

        // -- Resolve Staff Member identity --
        let resolvedCreatedBy: string;
        let resolvedMemberId: string;

        if (context.user) {
            const member = studio.members.find(m => m.userId === context.user!.id);
            if (!member) throw errors.FORBIDDEN();

            resolvedCreatedBy = createdBy ?? context.user.id;
            resolvedMemberId = memberId ?? member.id;
        } else {
            const defaultMember =
                studio.members.find(m => m.role === "owner") ?? studio.members[0];

            if (!defaultMember) {
                throw errors.BAD_REQUEST({
                    message: "This studio has no available staff to handle bookings.",
                });
            }

            resolvedCreatedBy = defaultMember.userId;
            resolvedMemberId = defaultMember.id;
        }

        // 4. Pass totalAmount to Prisma
        const bookingId = uuidv4();
        await db.insert(booking).values({
            id: bookingId,
            ...bookingData,
            bookingDate: bookingData.bookingDate.toISOString(),
            totalAmount: grandTotal.toString(),
            createdBy: resolvedCreatedBy,
            memberId: resolvedMemberId,
            updatedAt: new Date().toISOString(),
        });
        
        if (addonIds && addonIds.length > 0) {
            await db.insert(bookingAddons).values(
                addonIds.map(id => ({ a: bookingId, b: id }))
            );
        }

        const data = await db.query.booking.findFirst({
            where: (model, { eq }) => eq(model.id, bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        await captureEvent("booking_created", {
            addon_count: addonIds?.length ?? 0,
            session_count: bookingData.sessionCount,
            source: context.user ? "staff" : "public",
        });

        return mapBookingToOutput(data);
    },
);

export const getBookingById = os.booking.getById.use(optionalAuthMiddleware).handler(
    async ({ input, errors }) => {
        const data = await db.query.booking.findFirst({
            where: (model, { eq }) => eq(model.id, input.bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        if (!data) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId }});
        return mapBookingToOutput(data);
    },
);

export const updateBooking = os.booking.update.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const { bookingId, addonIds, ...updateData } = input;
        
        const existing = await db.query.booking.findFirst({ where: (model, { eq }) => eq(model.id, bookingId) });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        if (Object.keys(updateData).length > 0) {
            const { bookingDate, ...restData } = updateData;
            await db.update(booking).set({ ...restData, updatedAt: new Date().toISOString(), ...(bookingDate ? { bookingDate: bookingDate.toISOString() } : {}) }).where(eq(booking.id, bookingId));
        }

        if (addonIds !== undefined) {
            await db.delete(bookingAddons).where(eq(bookingAddons.a, bookingId));
            if (addonIds.length > 0) {
                await db.insert(bookingAddons).values(addonIds.map(id => ({ a: bookingId, b: id })));
            }
        }

        const data = await db.query.booking.findFirst({
            where: (model, { eq }) => eq(model.id, bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        await captureEvent("booking_updated", {
            addons_updated: addonIds !== undefined,
        });

        return mapBookingToOutput(data);
    }
);

export const deleteBooking = os.booking.delete.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const existing = await db.query.booking.findFirst({ where: (model, { eq }) => eq(model.id, input.bookingId) });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId }});

        await db.delete(booking).where(eq(booking.id, input.bookingId));
        await captureEvent("booking_deleted", {});
        return { id: input.bookingId, deleted: true as const };
    }
);

export const getAllBookings = os.booking.getAll.use(authMiddleware).handler(
    async ({ input }) => {
        const { page, perPage, sortBy, sortOrder, studioId, search } = input;
        
        let baseWhere = eq(booking.studioId, studioId);
        
        // Handling search correctly with Drizzle requires joins, but since we are replacing the ORM we can just use exists or similar.
        // For simplicity, we fetch all matching client/service IDs first if there is a search
        if (search) {
            const clients = await db.query.client.findMany({
                where: (model, { ilike }) => ilike(model.name, `%${search}%`),
                columns: { id: true }
            });
            const services = await db.query.service.findMany({
                where: (model, { ilike }) => ilike(model.name, `%${search}%`),
                columns: { id: true }
            });
            
            const clientIds = clients.map(c => c.id);
            const serviceIds = services.map(s => s.id);
            
            const searchFilters = [];
            if (clientIds.length > 0) searchFilters.push(inArray(booking.clientId, clientIds));
            if (serviceIds.length > 0) searchFilters.push(inArray(booking.serviceId, serviceIds));
            
            if (searchFilters.length > 0) {
                baseWhere = and(baseWhere, or(...searchFilters)) as any;
            } else {
                baseWhere = and(baseWhere, sql`1=0`) as any; // Force no results
            }
        }

        const countResult = await db.select({ count: sql`count(*)` }).from(booking).where(baseWhere);
        const total = Number(countResult[0].count);
        
        const data = await db.query.booking.findMany({
            where: baseWhere,
            offset: (page - 1) * perPage,
            limit: perPage,
            orderBy: (model, { asc, desc }) => sortOrder === 'desc' ? desc((model as any)[sortBy || 'createdAt']) : asc((model as any)[sortBy || 'createdAt']),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        const pageCount = Math.ceil(total / perPage);
        return {
            items: data.map(mapBookingSummaryToOutput),
            meta: {
                total,
                page,
                perPage,
                pageCount,
                hasNextPage: page < pageCount,
                hasPreviousPage: page > 1,
            }
        };
    }
);

export const reassignBooking = os.booking.reassign.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const { bookingId, memberId } = input;
        const existing = await db.query.booking.findFirst({ where: (model, { eq }) => eq(model.id, bookingId) });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        await db.update(booking).set({ memberId, updatedAt: new Date().toISOString() }).where(eq(booking.id, bookingId));
        
        const data = await db.query.booking.findFirst({
            where: (model, { eq }) => eq(model.id, bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        await captureEvent("booking_reassigned", {});

        return mapBookingToOutput(data);
    }
);

export const rescheduleBooking = os.booking.reschedule.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const { bookingId, newDate } = input;
        const existing = await db.query.booking.findFirst({ where: (model, { eq }) => eq(model.id, bookingId) });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        await db.update(booking).set({ bookingDate: newDate.toISOString(), updatedAt: new Date().toISOString() }).where(eq(booking.id, bookingId));
        
        const data = await db.query.booking.findFirst({
            where: (model, { eq }) => eq(model.id, bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        await captureEvent("booking_rescheduled", {});

        return mapBookingToOutput(data);
    }
);

export const updateBookingStatus = os.booking.updateStatus.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const { bookingId, bookingStatus, paymentStatus, deliveryStatus } = input;
        const existing = await db.query.booking.findFirst({ where: (model, { eq }) => eq(model.id, bookingId) });
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const updateData: any = {};
        if (bookingStatus) updateData.bookingStatus = bookingStatus;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;

        const { bookingDate, ...restData } = updateData;
            await db.update(booking).set({ ...restData, updatedAt: new Date().toISOString(), ...(bookingDate ? { bookingDate: bookingDate.toISOString() } : {}) }).where(eq(booking.id, bookingId));
        
        const data = await db.query.booking.findFirst({
            where: (model, { eq }) => eq(model.id, bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                member: { with: { user: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                payments: true,
                photos: true,
            }
        });

        await captureEvent("booking_status_updated", {
            booking_status_changed: Boolean(bookingStatus),
            delivery_status_changed: Boolean(deliveryStatus),
            payment_status_changed: Boolean(paymentStatus),
        });

        return mapBookingToOutput(data);
    }
);

const PORTAL_URL = process.env.PORTAL_URL!;

export const createPublicBooking = os.booking.createPublic
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const studio = await db.query.studio.findFirst({
            where: (model, { eq }) => eq(model.id, input.studioId),
            with: { members: true },
        });
        if (!studio) throw errors.NOT_FOUND({
            data: { resourceType: "Studio", resourceId: input.studioId },
        });

        const service = await db.query.service.findFirst({
            where: (model, { eq, and }) => and(eq(model.id, input.selectedServiceId), eq(model.studioId, input.studioId)),
            with: { serviceVariants: true },
        });
        if (!service) throw errors.NOT_FOUND({
            data: { resourceType: "Service", resourceId: input.selectedServiceId },
        });

        const selectedVariant = service.serviceVariants.find(v => v.id === input.selectedVariantId);
        if (!selectedVariant) throw errors.BAD_REQUEST({ message: "Selected service option is invalid." });

        // Fetch selected addons to get their pricing
        let selectedAddonsMap: Record<string, any> = {};
        const parsedAddons = (input.selectedAddonIds || []).map(str => {
            // Support composite strings "addonId:variantId" or fallback to "addonId"
            const parts = str.split(":");
            return { addonId: parts[0], variantId: parts[1] };
        });
        const uniqueAddonIds = [...new Set(parsedAddons.map(p => p.addonId))];

        if (uniqueAddonIds.length > 0) {
            const selectedAddons = await db.query.service.findMany({
                where: (model, { inArray, eq, and }) => and(inArray(model.id, uniqueAddonIds), eq(model.studioId, input.studioId), eq(model.isAddon, true)),
                with: { serviceVariants: true },
            });
            selectedAddonsMap = Object.fromEntries(selectedAddons.map(addon => [addon.id, addon]));
        }

        // Construct pricing objects using the selected variant
        const servicePricingObj = {
            price: Number(selectedVariant.basePrice),
            salePrice: null
        };
        // Map selected addon IDs to their pricing in the order they were selected
        const addonPricingObjs = parsedAddons.map(({ addonId, variantId }) => {
            const addon = selectedAddonsMap[addonId];
            if (!addon) {
                throw errors.BAD_REQUEST({ message: `Addon ${addonId} not found.` });
            }
            
            const variant = variantId ? addon.serviceVariants?.find((v: any) => v.id === variantId) : addon.serviceVariants?.[0];
            if (!variant) {
                throw errors.BAD_REQUEST({ message: `Variant for addon ${addon.name} not found.` });
            }

            return {
                price: Number(variant.basePrice),
                salePrice: null
            };
        });

        const grandTotal = calculateGrandTotal(
            servicePricingObj,
            addonPricingObjs,
            input.sessionCount,
        );

        // Calculate the amount to charge based on payment plan
        const paymentPlan = input.paymentPlan ?? "FULL";
        const planMultiplier = paymentPlan === "QUARTER" ? 0.25 : paymentPlan === "HALF" ? 0.5 : 1;
        const chargeAmount = Math.round(grandTotal * planMultiplier * 100) / 100; // round to 2 decimal places

        const reference = `gmax-pub-${uuidv4().slice(0, 8)}`;

        // Store intent — nothing else goes to DB yet
        await db.insert(bookingIntent).values({
                id: uuidv4(),
                studioId:        input.studioId,
                clientName:      input.clientName,
                clientEmail:     input.clientEmail ?? null,
                clientPhone:     input.clientPhone ?? null,
                existingClientId: input.existingClientId ?? null,
                serviceId:       input.selectedServiceId,
                serviceVariantId: input.selectedVariantId,
                addonIds:        input.selectedAddonIds ?? [],
                sessionCount:    input.sessionCount,
                bookingDate:     new Date(input.bookingDate).toISOString(),
                notes:           input.notes ?? null,
                paystackReference: reference,
                totalAmount:     grandTotal.toString(),
                amount:          chargeAmount.toString(),
                paymentPlan,
                expiresAt:       new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        });

        await captureEvent("public_booking_checkout_started", {
            addon_count: parsedAddons.length,
            payment_plan: paymentPlan,
            session_count: input.sessionCount,
        });

        const clientEmail = input.clientEmail;

        if (!clientEmail) {
            return {
                bookingId:  reference,
                paymentUrl: null,
                reference,
                amount:     chargeAmount,
                warning: "No email provided — payment link must be sent manually.",
            };
        }

        // Initialize Paystack
        const paystack = await paystackFetch<{
            data?: { authorization_url?: string }
        }>("/transaction/initialize", {
            method: "POST",
            body: JSON.stringify({
                email:    clientEmail,
                amount:   Math.round(chargeAmount * 100), // kobo
                reference,
                metadata: {
                    type:     "booking",
                    studioId: input.studioId,
                    intentId: reference,
                },
                callback_url: `${PORTAL_URL}/booking/verify?reference=${reference}`,
            }),
        });

        return {
            bookingId:  reference,
            paymentUrl: paystack.data?.authorization_url ?? null,
            reference,
            amount:     chargeAmount,
        };
    });

export const checkClient = os.booking.checkClient
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const existing = await db.query.client.findFirst({
            where: (model, { eq, and, ilike }) => and(
                eq(model.studioId, input.studioId),
                ilike(model.name, input.name),
                input.email ? ilike(model.email, input.email) : undefined
            ),
            columns: { id: true, name: true, phone: true },
        });

        if (!existing) return { exists: false as const };

        const firstPhone = existing.phone ?? "";
        const digitsOnly = firstPhone.replace(/\D/g, "");
        const maskedPhone = digitsOnly.length >= 6
            ? digitsOnly.replace(/^(\d{3}).*(\d{3})$/, "$1****$2")
            : null;

        return {
            exists: true as const,
            client: { id: existing.id, name: existing.name, maskedPhone },
        };
    });

export const verifyBooking = os.booking.verifyBooking
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        let intent = await db.query.bookingIntent.findFirst({
            where: (model, { eq }) => eq(model.paystackReference, input.reference),
        });

        if (!intent) {
            return {
                status: "FAILED" as const,
                clientName: "",
                serviceName: "",
                bookingDate: "",
                totalAmount: 0,
                amountPaid: 0,
                paymentPlan: "FULL" as const,
                reference: input.reference,
                bookingId: null,
            };
        }

        // If intent is still PENDING, verify with Paystack and process if paid
        if (intent.status === "PENDING") {
            try {
                const verification = await paystackFetch<{
                    status: boolean;
                    data?: { status?: string; amount?: number; currency?: string; reference?: string };
                }>(`/transaction/verify/${encodeURIComponent(input.reference)}`);

                if (verification.status && verification.data?.status === "success") {
                    const paidAmount = Number(verification.data.amount ?? 0);
                    const expectedAmount = Math.round(Number(intent.amount) * 100);
                    const paidCurrency = String(verification.data.currency ?? "").toUpperCase();

                    if (paidAmount === expectedAmount && paidCurrency === "NGN") {
                        // Process the booking — same logic as webhook
                        const studio = await db.query.studio.findFirst({
                            where: (model, { eq }) => eq(model.id, intent!.studioId),
                            with: { members: true },
                        });

                        const defaultMember = studio?.members.find(m => m.role === "owner") ?? studio?.members[0];

                        if (studio && defaultMember) {
                            try {
                                await db.transaction(async (tx) => {
                                    // 0. Atomically claim the intent
                                    const claimResult = await tx.update(bookingIntent)
                                        .set({ status: "COMPLETED" })
                                        .where(and(eq(bookingIntent.paystackReference, input.reference), eq(bookingIntent.status, "PENDING")))
                                        .returning();

                                    if (claimResult.length === 0) {
                                        // Already processed or being processed by another request
                                        return;
                                    }

                                    // Defensively check for existing payment
                                    const existingPayment = await tx.query.payment.findFirst({
                                        where: (model, { eq }) => eq(model.paystackReference, input.reference)
                                    });

                                    if (existingPayment) {
                                        return; // Duplicate
                                    }

                                    // 1. Resolve client
                                    let clientId = intent!.existingClientId;
                                    if (!clientId) {
                                        const phone = intent!.clientPhone?.trim() ?? "";
                                        let existing = null;
                                        if (intent!.clientEmail) {
                                            existing = await tx.query.client.findFirst({
                                                where: (model, { eq, and }) => and(eq(model.studioId, intent!.studioId), intent!.clientEmail ? eq(model.email, intent!.clientEmail) : undefined),
                                            });
                                        }
                                        if (!existing && phone) {
                                            existing = await tx.query.client.findFirst({
                                                where: (model, { eq, and }) => and(eq(model.studioId, intent!.studioId), eq(model.phone, phone)),
                                            });
                                        }
                                        if (existing) {
                                            clientId = existing.id;
                                        } else {
                                            const [insertedClient] = await tx.insert(client).values({
                                                id: uuidv4(),
                                                name: intent!.clientName,
                                                phone,
                                                email: intent!.clientEmail ?? null,
                                                type: "regular",
                                                studioId: intent!.studioId,
                                                updatedAt: new Date().toISOString(),
                                            }).returning();
                                            clientId = insertedClient.id;
                                        }
                                    }

                                    // 2. Create booking
                                    const service = await tx.query.service.findFirst({
                                        where: (model, { eq }) => eq(model.id, intent!.serviceId),
                                        with: { serviceVariants: true },
                                    });
                                    const bookingId = uuidv4();
                                    await tx.insert(booking).values({
                                            id: bookingId,
                                            bookingDate: new Date(intent!.bookingDate).toISOString(),
                                            sessionCount: intent!.sessionCount,
                                            notes: intent!.notes,
                                            totalAmount: intent!.totalAmount.toString(),
                                            paymentPlan: intent!.paymentPlan,
                                            bookingStatus: "CONFIRMED",
                                            paymentStatus: intent!.paymentPlan === "FULL" ? "PAID" : "PARTIALLY_PAID",
                                            deliveryStatus: "PENDING",
                                            serviceId: intent!.serviceId,
                                            studioId: intent!.studioId,
                                            clientId: clientId!,
                                            memberId: defaultMember.id,
                                            createdBy: defaultMember.userId,
                                            serviceVariantId: intent!.serviceVariantId ?? service?.serviceVariants?.[0]?.id ?? null,
                                            updatedAt: new Date().toISOString(),
                                    });
                                    
                                    if (intent!.addonIds && intent!.addonIds.length > 0) {
                                        const uniqueAddonIds = [...new Set(intent!.addonIds.map((id: string) => id.split(":")[0]))];
                                        await tx.insert(bookingAddons).values(uniqueAddonIds.map(id => ({ a: bookingId, b: id })));
                                    }

                                    // 3. Create payment record
                                    const installmentType = intent!.paymentPlan === "FULL" ? "FULL" : "DEPOSIT";
                                    await tx.insert(payment).values({
                                            id: uuidv4(),
                                            amount: intent!.amount.toString(),
                                            method: "TRANSFER",
                                            status: "PAID",
                                            paystackReference: input.reference,
                                            paystackResponse: verification.data as any,
                                            receiptNumber: `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                                            bookingId: bookingId,
                                            recordedById: defaultMember.userId,
                                            installmentType,
                                            sequence: 1,
                                            expectedAmount: intent!.amount.toString(),
                                            paymentDate: new Date().toISOString(),
                                    });

                                    // 4. Mark intent resolved
                                    await tx.update(bookingIntent).set({
                                            status: "COMPLETED",
                                            resolvedBookingId: bookingId,
                                        }).where(eq(bookingIntent.paystackReference, input.reference));
                                });
                            } catch (txErr) {
                                console.error(`[Verify] Transaction failed for ${input.reference}:`, txErr);
                            }

                            // Re-fetch updated intent
                            intent = await db.query.bookingIntent.findFirst({
                                where: (model, { eq }) => eq(model.paystackReference, input.reference),
                            });
                        }
                    } else {
                        // Amount mismatch
                        console.error(`[Verify] Payment mismatch for ${input.reference}: expected ${expectedAmount}, got ${paidAmount}`);
                    }
                }
            } catch (err) {
                console.error(`[Verify] Paystack verification failed for ${input.reference}:`, err);
                // Continue to return current status — don't crash
            }
        }

        const serviceRow = await db.query.service.findFirst({
            where: (model, { eq }) => eq(model.id, intent!.serviceId),
            columns: { name: true },
        });

        // Check if expired
        const status = intent!.status === "PENDING" && new Date(intent!.expiresAt) < new Date()
            ? "EXPIRED" as const
            : intent!.status as "PENDING" | "COMPLETED" | "EXPIRED" | "FAILED";

        return {
            status,
            clientName: intent!.clientName,
            serviceName: serviceRow?.name ?? "Session",
            bookingDate: new Date(intent!.bookingDate).toISOString(),
            totalAmount: Number(intent!.totalAmount),
            amountPaid: Number(intent!.amount),
            paymentPlan: intent!.paymentPlan,
            reference: input.reference,
            bookingId: intent!.resolvedBookingId,
        };
    });
