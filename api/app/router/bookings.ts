/* eslint-disable @typescript-eslint/no-explicit-any */
import { contract } from "@/app/contract";
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { optionalAuthMiddleware, authMiddleware, BaseContext } from "./middleware";
import { calculateGrandTotal } from "@/lib/pricing";
import { v4 as uuidv4 } from "uuid";
import { paystackFetch } from "@/lib/paystack";
import { notifyAdminsOfPayment } from "@/lib/notifications";

const os = implement(contract).$context<BaseContext>();

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
            variants: data.service.variants ? data.service.variants.map((v: any) => ({
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
        addons: data.addons.map((a: any) => ({
            id: a.id,
            name: a.name,
            isAddon: a.isAddon,
            variants: a.variants ? a.variants.map((v: any) => ({
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
            variants: data.service.variants ? data.service.variants.map((v: any) => ({
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

        const studio = await prisma.studio.findUnique({
            where: { id: bookingData.studioId },
            include: { members: true },
        });

        if (!studio) {
            throw errors.NOT_FOUND({
                data: { resourceType: "Studio", resourceId: bookingData.studioId },
            });
        }

        // 1. Fetch Service & Add-ons to calculate the total amount securely
        const service = await prisma.service.findUnique({
            where: { id: bookingData.serviceId },
            include: { variants: true }
        });
        
        if (!service) throw errors.NOT_FOUND({
            data: { resourceType: "Service", resourceId: bookingData.serviceId }
        });

        let fetchedAddons: any[] = [];
        let addonMapById: Record<string, any> = {};
        if (addonIds && addonIds.length > 0) {
            fetchedAddons = await prisma.service.findMany({
                where: { id: { in: addonIds } },
                include: { variants: true }
            });
            // Create a map from addon ID to addon object for consistent lookup
            addonMapById = Object.fromEntries(fetchedAddons.map(addon => [addon.id, addon]));
        }

        // 2. Build pricing objects for the calculator
        // Use the first available variant (default/primary variant) for pricing calculation
        const servicePricingObj = {
            price: service.variants?.[0]?.basePrice ? Number(service.variants[0].basePrice) : 0,
            salePrice: null
        };
        // Map addon IDs to their pricing in the order they were selected, using the first variant of each addon
        const addonPricingObjs = (addonIds || []).map(addonId => {
            const addon = addonMapById[addonId];
            return {
                price: addon?.variants?.[0]?.basePrice ? Number(addon.variants[0].basePrice) : 0,
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
        const data = await prisma.booking.create({
            data: {
                ...bookingData,
                totalAmount: grandTotal,
                createdBy: resolvedCreatedBy,
                memberId: resolvedMemberId,
                ...(addonIds && addonIds.length > 0 && {
                    addons: {
                        connect: addonIds.map(id => ({ id })),
                    },
                }),
            },
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    },
);

export const getBookingById = os.booking.getById.use(optionalAuthMiddleware).handler(
    async ({ input, errors }) => {
        const data = await prisma.booking.findUnique({
            where: { id: input.bookingId },
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
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
        
        const existing = await prisma.booking.findUnique({ where: { id: bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const data = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                ...updateData,
                ...(addonIds !== undefined && {
                    addons: { set: addonIds.map(id => ({ id })) }
                })
            },
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

export const deleteBooking = os.booking.delete.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const existing = await prisma.booking.findUnique({ where: { id: input.bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId }});

        await prisma.booking.delete({ where: { id: input.bookingId }});
        return { id: input.bookingId, deleted: true as const };
    }
);

export const getAllBookings = os.booking.getAll.use(authMiddleware).handler(
    async ({ input }) => {
        const { page, perPage, sortBy, sortOrder, studioId, search } = input;
        
        const whereClause: any = { studioId };
        if (search) {
            whereClause.OR = [
                { client: { name: { contains: search, mode: 'insensitive' } } },
                { service: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const total = await prisma.booking.count({ where: whereClause });
        
        const data = await prisma.booking.findMany({
            where: whereClause,
            skip: (page - 1) * perPage,
            take: perPage,
            orderBy: { [sortBy || 'createdAt']: sortOrder },
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
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
        const existing = await prisma.booking.findUnique({ where: { id: bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const data = await prisma.booking.update({
            where: { id: bookingId },
            data: { memberId },
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

export const rescheduleBooking = os.booking.reschedule.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const { bookingId, newDate } = input;
        const existing = await prisma.booking.findUnique({ where: { id: bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const data = await prisma.booking.update({
            where: { id: bookingId },
            data: { bookingDate: newDate },
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

export const updateBookingStatus = os.booking.updateStatus.use(authMiddleware).handler(
    async ({ input, errors }) => {
        const { bookingId, bookingStatus, paymentStatus, deliveryStatus } = input;
        const existing = await prisma.booking.findUnique({ where: { id: bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const updateData: any = {};
        if (bookingStatus) updateData.bookingStatus = bookingStatus;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;

        const data = await prisma.booking.update({
            where: { id: bookingId },
            data: updateData,
            include: {
                client: true,
                service: { include: { variants: true } },
                member: { include: { user: true } },
                addons: { include: { variants: true } },
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

const PORTAL_URL = process.env.PORTAL_URL!;

export const createPublicBooking = os.booking.createPublic
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const studio = await prisma.studio.findUnique({
            where: { id: input.studioId },
            include: { members: true },
        });
        if (!studio) throw errors.NOT_FOUND({
            data: { resourceType: "Studio", resourceId: input.studioId },
        });

        const service = await prisma.service.findFirst({
            where: { id: input.selectedServiceId, studioId: input.studioId },
            include: { variants: true },
        });
        if (!service) throw errors.NOT_FOUND({
            data: { resourceType: "Service", resourceId: input.selectedServiceId },
        });

        const selectedVariant = service.variants.find(v => v.id === input.selectedVariantId);
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
            const selectedAddons = await prisma.service.findMany({
                where: { id: { in: uniqueAddonIds }, studioId: input.studioId, isAddon: true },
                include: { variants: true },
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
            
            const variant = variantId ? addon.variants?.find((v: any) => v.id === variantId) : addon.variants?.[0];
            if (!variant) {
                throw errors.BAD_REQUEST({ message: `Variant for addon ${addon.name} not found.` });
            }

            return {
                price: Number(variant.basePrice),
                salePrice: null
            };
        });

        // Calculate extra pictures cost based on the 'BOTH' variant of the selected service
        const bothVariant = service.variants.find(v => v.locationType === "BOTH");
        const extraPicturesCost = bothVariant && input.extraPicturesCount
            ? Number(bothVariant.basePrice) * input.extraPicturesCount
            : 0;

        const grandTotal = calculateGrandTotal(
            servicePricingObj,
            addonPricingObjs,
            input.sessionCount,
        ) + extraPicturesCost;

        // Calculate the amount to charge based on payment plan
        const paymentPlan = input.paymentPlan ?? "FULL";
        const planMultiplier = paymentPlan === "QUARTER" ? 0.25 : paymentPlan === "HALF" ? 0.5 : 1;
        const chargeAmount = Math.round(grandTotal * planMultiplier * 100) / 100; // round to 2 decimal places

        const reference = `gmax-pub-${uuidv4().slice(0, 8)}`;

        // Store intent — nothing else goes to DB yet
        await prisma.bookingIntent.create({
            data: {
                studioId:        input.studioId,
                clientName:      input.clientName,
                clientEmail:     input.clientEmail ?? null,
                clientPhone:     input.clientPhone ?? null,
                existingClientId: input.existingClientId ?? null,
                serviceId:       input.selectedServiceId,
                serviceVariantId: input.selectedVariantId,
                addonIds:        input.selectedAddonIds ?? [],
                sessionCount:    input.sessionCount,
                extraPicturesCount: input.extraPicturesCount ?? 0,
                bookingDate:     new Date(input.bookingDate),
                notes:           input.notes ?? null,
                paystackReference: reference,
                totalAmount:     grandTotal,
                amount:          chargeAmount,
                paymentPlan,
                expiresAt:       new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            },
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

        return {
            bookingId:  reference,
            paymentUrl: null,
            reference,
            amount:     chargeAmount,
        };
    });

export const checkClient = os.booking.checkClient
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const existing = await prisma.client.findFirst({
            where: {
                studioId: input.studioId,
                name: { equals: input.name, mode: "insensitive" },
                email: { equals: input.email, mode: "insensitive" },
            },
            select: { id: true, name: true, phone: true },
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
        let intent = await prisma.bookingIntent.findUnique({
            where: { paystackReference: input.reference },
        });

        if (!intent && input.reference.includes("_bal_")) {
            const bookingId = input.reference.split("_bal_")[0];
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { client: true, service: true, studio: { include: { members: true } }, payments: true }
            });

            if (!booking) {
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

            try {
                const verification = await paystackFetch<{
                    status: boolean;
                    data?: { status?: string; amount?: number; currency?: string; reference?: string };
                }>(`/transaction/verify/${encodeURIComponent(input.reference)}`);

                if (verification.status && verification.data?.status === "success") {
                    const paidAmount = Number(verification.data.amount ?? 0) / 100;
                    const paidCurrency = String(verification.data.currency ?? "").toUpperCase();

                    if (paidCurrency === "NGN") {
                        let isNewPayment = false;
                        // Create payment if it doesn't exist
                        await prisma.$transaction(async (tx) => {
                            const existingPayment = await tx.payment.findUnique({
                                where: { paystackReference: input.reference }
                            });

                            if (!existingPayment) {
                                isNewPayment = true;
                                const defaultMember = booking.studio?.members.find((m: any) => m.role === "owner") ?? booking.studio?.members[0];
                                
                                await tx.payment.create({
                                    data: {
                                        amount: paidAmount,
                                        method: "TRANSFER",
                                        status: "PAID",
                                        paystackReference: input.reference,
                                        paystackResponse: verification.data as any,
                                        receiptNumber: `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                                        bookingId: booking.id,
                                        recordedById: defaultMember?.userId || booking.createdBy,
                                        installmentType: "BALANCE",
                                        sequence: booking.payments.length + 1,
                                        expectedAmount: paidAmount,
                                        paymentDate: new Date(),
                                    },
                                });

                                const totalPaid = booking.payments
                                    .filter((p: any) => p.status === "PAID")
                                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0) + paidAmount;
                                
                                await tx.booking.update({
                                    where: { id: booking.id },
                                    data: {
                                        paymentStatus: totalPaid >= Number(booking.totalAmount) ? "PAID" : "PARTIALLY_PAID"
                                    }
                                });
                            }
                        });

                        if (isNewPayment) {
                            await notifyAdminsOfPayment(
                                booking.studioId,
                                booking.id,
                                paidAmount,
                                booking.client.name,
                                booking.service?.name ?? "Session"
                            ).catch(console.error);
                        }
                    }
                }
            } catch (err) {
                console.error(`[Verify] Paystack balance verification failed for ${input.reference}:`, err);
            }

            return {
                status: "COMPLETED" as const,
                clientName: booking.client.name,
                serviceName: booking.service?.name ?? "Session",
                bookingDate: booking.bookingDate.toISOString(),
                totalAmount: Number(booking.totalAmount),
                amountPaid: 0, // This will be updated if verification succeeds? Actually just return the balance logic
                paymentPlan: "FULL" as const,
                reference: input.reference,
                bookingId: booking.id,
            };
        }

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
                        const studio = await prisma.studio.findUnique({
                            where: { id: intent.studioId },
                            include: { members: true },
                        });

                        const defaultMember = studio?.members.find(m => m.role === "owner") ?? studio?.members[0];

                        if (studio && defaultMember) {
                            let newBookingId: string | null = null;
                            try {
                                await prisma.$transaction(async (tx) => {
                                    // 0. Atomically claim the intent
                                    const claimResult = await tx.bookingIntent.updateMany({
                                        where: { 
                                            paystackReference: input.reference,
                                            status: "PENDING" 
                                        },
                                        data: { status: "COMPLETED" }
                                    });

                                    if (claimResult.count === 0) {
                                        // Already processed or being processed by another request
                                        return;
                                    }

                                    // Defensively check for existing payment
                                    const existingPayment = await tx.payment.findUnique({
                                        where: { paystackReference: input.reference }
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
                                            existing = await tx.client.findFirst({
                                                where: { studioId: intent!.studioId, email: intent!.clientEmail },
                                            });
                                        }
                                        if (!existing && phone) {
                                            existing = await tx.client.findFirst({
                                                where: { studioId: intent!.studioId, phone },
                                            });
                                        }
                                        if (existing) {
                                            clientId = existing.id;
                                        } else {
                                            const client = await tx.client.create({
                                                data: {
                                                    name: intent!.clientName,
                                                    phone,
                                                    email: intent!.clientEmail ?? null,
                                                    type: "regular",
                                                    studioId: intent!.studioId,
                                                },
                                            });
                                            clientId = client.id;
                                        }
                                    }

                                    // 2. Create booking
                                    const service = await tx.service.findUnique({
                                        where: { id: intent!.serviceId },
                                        include: { variants: true },
                                    });
                                    const booking = await tx.booking.create({
                                        data: {
                                            bookingDate: intent!.bookingDate,
                                            sessionCount: intent!.sessionCount,
                                            extraPicturesCount: intent!.extraPicturesCount,
                                            notes: intent!.notes,
                                            totalAmount: intent!.totalAmount,
                                            paymentPlan: intent!.paymentPlan,
                                            bookingStatus: "CONFIRMED",
                                            paymentStatus: intent!.paymentPlan === "FULL" ? "PAID" : "PARTIALLY_PAID",
                                            deliveryStatus: "PENDING",
                                            serviceId: intent!.serviceId,
                                            studioId: intent!.studioId,
                                            clientId: clientId!,
                                            memberId: defaultMember.id,
                                            createdBy: defaultMember.userId,
                                            serviceVariantId: intent!.serviceVariantId ?? service?.variants?.[0]?.id ?? null,
                                            ...(intent!.addonIds.length > 0 && {
                                                addons: { connect: [...new Set(intent!.addonIds.map((id: string) => id.split(":")[0]))].map(id => ({ id })) },
                                            }),
                                        },
                                    });
                                    
                                    newBookingId = booking.id;

                                    // 3. Create payment record
                                    const installmentType = intent!.paymentPlan === "FULL" ? "FULL" : "DEPOSIT";
                                    await tx.payment.create({
                                        data: {
                                            amount: intent!.amount,
                                            method: "TRANSFER",
                                            status: "PAID",
                                            paystackReference: input.reference,
                                            paystackResponse: verification.data as any,
                                            receiptNumber: `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`,
                                            bookingId: booking.id,
                                            recordedById: defaultMember.userId,
                                            installmentType,
                                            sequence: 1,
                                            expectedAmount: intent!.amount,
                                            paymentDate: new Date(),
                                        },
                                    });

                                    // 4. Mark intent resolved
                                    await tx.bookingIntent.update({
                                        where: { paystackReference: input.reference },
                                        data: {
                                            status: "COMPLETED",
                                            resolvedBookingId: booking.id,
                                        },
                                    });
                                });
                            } catch (txErr) {
                                console.error(`[Verify] Transaction failed for ${input.reference}:`, txErr);
                            }

                            if (newBookingId) {
                                const service = await prisma.service.findUnique({
                                    where: { id: intent!.serviceId },
                                    select: { name: true }
                                });
                                await notifyAdminsOfPayment(
                                    intent!.studioId,
                                    newBookingId,
                                    Number(intent!.amount),
                                    intent!.clientName,
                                    service?.name ?? "Session"
                                ).catch(console.error);
                            }

                            // Re-fetch updated intent
                            intent = await prisma.bookingIntent.findUnique({
                                where: { paystackReference: input.reference },
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

        const service = await prisma.service.findUnique({
            where: { id: intent!.serviceId },
            select: { name: true },
        });

        // Check if expired
        const status = intent!.status === "PENDING" && intent!.expiresAt < new Date()
            ? "EXPIRED" as const
            : intent!.status as "PENDING" | "COMPLETED" | "EXPIRED" | "FAILED";

        return {
            status,
            clientName: intent!.clientName,
            serviceName: service?.name ?? "Session",
            bookingDate: intent!.bookingDate.toISOString(),
            totalAmount: Number(intent!.totalAmount),
            amountPaid: Number(intent!.amount),
            paymentPlan: intent!.paymentPlan,
            reference: input.reference,
            bookingId: intent!.resolvedBookingId,
        };
    });
