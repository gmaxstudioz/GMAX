/* eslint-disable @typescript-eslint/no-explicit-any */
import { contract } from "@/app/contract";
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { optionalAuthMiddleware, authMiddleware, BaseContext } from "./middleware";
import { calculateGrandTotal } from "@/lib/pricing";
import { v4 as uuidv4 } from "uuid";
import { paystackFetch } from "@/lib/paystack";

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
        if (addonIds && addonIds.length > 0) {
            fetchedAddons = await prisma.service.findMany({
                where: { id: { in: addonIds } },
                include: { variants: true }
            });
        }

        // 2. Build pricing objects for the calculator 
        const servicePricingObj = {
            price: service.variants[0]?.basePrice ? Number(service.variants[0].basePrice) : 0,
            salePrice: null
        };
        const addonPricingObjs = fetchedAddons.map(a => ({
            price: a.variants[0]?.basePrice ? Number(a.variants[0].basePrice) : 0,
            salePrice: null
        }));

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

        const service = await prisma.service.findUnique({
            where: { id: input.selectedServiceId },
            include: { variants: true },
        });
        if (!service) throw errors.NOT_FOUND({
            data: { resourceType: "Service", resourceId: input.selectedServiceId },
        });

        // Construct a pricing object that satisfies calculateGrandTotal
        const servicePricingObj = {
            price: service.variants[0]?.basePrice ? Number(service.variants[0].basePrice) : 0,
            salePrice: null
        };

        const grandTotal = calculateGrandTotal(
            servicePricingObj,
            [], // addons resolved separately
            input.sessionCount,
        );

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
                addonIds:        input.selectedAddonIds ?? [],
                sessionCount:    input.sessionCount,
                bookingDate:     new Date(input.bookingDate),
                notes:           input.notes ?? null,
                paystackReference: reference,
                amount:          grandTotal,
                expiresAt:       new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            },
        });

        const clientEmail = input.clientEmail;

        if (!clientEmail) {
            return {
                bookingId:  reference,
                paymentUrl: null,
                reference,
                amount:     grandTotal,
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
                amount:   Math.round(grandTotal * 100), // kobo
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
            amount:     grandTotal,
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

