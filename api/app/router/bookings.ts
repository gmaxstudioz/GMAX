import { contract } from "@/contract";
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { optionalAuthMiddleware, authMiddleware, BaseContext } from "./middleware";

const os = implement(contract).$context<BaseContext>();

const mapBookingToOutput = (data: any) => {
    const totalPaid = data.payments
        .filter((p: any) => p.status === "PAID")
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    
    const servicePrice = data.service.salePrice ?? data.service.price ?? 0;
    const addonsTotal = data.addons.reduce((sum: number, a: any) => sum + (a.salePrice ?? a.price ?? 0), 0);
    const grandTotal = (servicePrice * data.sessionCount) + addonsTotal;
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
            type: data.service.type,
            price: Number(data.service.price),
            salePrice: data.service.salePrice ? Number(data.service.salePrice) : null,
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
            type: a.type,
            price: Number(a.price),
            salePrice: a.salePrice ? Number(a.salePrice) : null,
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
    
    const servicePrice = data.service.salePrice ?? data.service.price ?? 0;
    const addonsTotal = data.addons.reduce((sum: number, a: any) => sum + (a.salePrice ?? a.price ?? 0), 0);
    const grandTotal = (servicePrice * data.sessionCount) + addonsTotal;
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
            type: data.service.type,
            price: Number(data.service.price),
            salePrice: data.service.salePrice ? Number(data.service.salePrice) : null,
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

        const data = await prisma.booking.create({
            data: {
                ...bookingData,
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
                service: true,
                member: { include: { user: true } },
                addons: true,
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    },
);

export const getBookingById = os.booking.getById.use(authMiddleware).handler(
    async ({ input, context, errors }) => {
        const data = await prisma.booking.findUnique({
            where: { id: input.bookingId },
            include: {
                client: true,
                service: true,
                member: { include: { user: true } },
                addons: true,
                payments: true,
                photos: true,
            }
        });

        if (!data) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId }});
        return mapBookingToOutput(data);
    },
);

export const updateBooking = os.booking.update.use(authMiddleware).handler(
    async ({ input, context, errors }) => {
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
                service: true,
                member: { include: { user: true } },
                addons: true,
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

export const deleteBooking = os.booking.delete.use(authMiddleware).handler(
    async ({ input, context, errors }) => {
        const existing = await prisma.booking.findUnique({ where: { id: input.bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId }});

        await prisma.booking.delete({ where: { id: input.bookingId }});
        return { id: input.bookingId, deleted: true as const };
    }
);

export const getAllBookings = os.booking.getAll.use(authMiddleware).handler(
    async ({ input, context, errors }) => {
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
                service: true,
                addons: true,
                payments: true,
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
    async ({ input, context, errors }) => {
        const { bookingId, memberId } = input;
        const existing = await prisma.booking.findUnique({ where: { id: bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const data = await prisma.booking.update({
            where: { id: bookingId },
            data: { memberId },
            include: {
                client: true,
                service: true,
                member: { include: { user: true } },
                addons: true,
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

export const rescheduleBooking = os.booking.reschedule.use(authMiddleware).handler(
    async ({ input, context, errors }) => {
        const { bookingId, newDate } = input;
        const existing = await prisma.booking.findUnique({ where: { id: bookingId }});
        if (!existing) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: bookingId }});

        const data = await prisma.booking.update({
            where: { id: bookingId },
            data: { bookingDate: newDate },
            include: {
                client: true,
                service: true,
                member: { include: { user: true } },
                addons: true,
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);

export const updateBookingStatus = os.booking.updateStatus.use(authMiddleware).handler(
    async ({ input, context, errors }) => {
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
                service: true,
                member: { include: { user: true } },
                addons: true,
                payments: true,
                photos: true,
            }
        });

        return mapBookingToOutput(data);
    }
);
