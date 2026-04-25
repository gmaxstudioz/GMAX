"use server";

import { prisma } from "@/lib/prisma";
import { BookingStatus, PaymentStatus, DeliveryStatus } from "@/lib/generated/prisma/client";

const validBookingStatuses = Object.values(BookingStatus);
const validPaymentStatuses = Object.values(PaymentStatus);
const validDeliveryStatuses = Object.values(DeliveryStatus);

export async function getMemberTasks(
    memberId: string, 
    page: number, 
    search: string = "", 
    filtersJson: string = '{"booking":"ALL","payment":"ALL","delivery":"ALL"}'
) {
    const ITEMS_PER_PAGE = 12;
    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skip = validatedPage * ITEMS_PER_PAGE;

    const whereClause: any = {
        memberId: memberId,
    };

    if (search.trim() !== "") {
        whereClause.OR = [
            { client: { name: { contains: search, mode: 'insensitive' } } },
            { service: { name: { contains: search, mode: 'insensitive' } } }
        ];
    }

    try {
        const filters = JSON.parse(filtersJson);
        if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking)) {
            whereClause.bookingStatus = filters.booking;
        }
        if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment)) {
            whereClause.paymentStatus = filters.payment;
        }
        if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery)) {
            whereClause.deliveryStatus = filters.delivery;
        }
    } catch(e) {
        // fallback ignored
    }

    const tasks = await prisma.booking.findMany({
        where: whereClause,
        include: {
            client: true,
            service: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
        skip,
        take: ITEMS_PER_PAGE,
    });

    return tasks;
}

// ── Get Client Tasks ───────────────────────────────────────────────

export async function getClientTasks(
    clientId: string,
    page: number, 
    search: string = "", 
    filtersJson: string = '{"booking":"ALL","payment":"ALL","delivery":"ALL"}'
) {
    const ITEMS_PER_PAGE = 12;
    const validatedPage = Math.max(0, Math.floor(Number(page) || 0));
    const skip = validatedPage * ITEMS_PER_PAGE;

    const whereClause: any = {
        clientId: clientId,
    };

    if (search.trim() !== "") {
        whereClause.service = { name: { contains: search, mode: 'insensitive' } };
    }

    try {
        const filters = JSON.parse(filtersJson);
        if (filters.booking && filters.booking !== "ALL" && validBookingStatuses.includes(filters.booking)) {
            whereClause.bookingStatus = filters.booking;
        }
        if (filters.payment && filters.payment !== "ALL" && validPaymentStatuses.includes(filters.payment)) {
            whereClause.paymentStatus = filters.payment;
        }
        if (filters.delivery && filters.delivery !== "ALL" && validDeliveryStatuses.includes(filters.delivery)) {
            whereClause.deliveryStatus = filters.delivery;
        }
    } catch(e) {
        // fallback ignored
    }

    const tasks = await prisma.booking.findMany({
        where: whereClause,
        include: {
            service: true,
            member: {
                include: {
                    user: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        skip,
        take: ITEMS_PER_PAGE,
    });

    return tasks;
}
