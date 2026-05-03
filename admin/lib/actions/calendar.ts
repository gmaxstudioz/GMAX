"use server";

import z from "zod";
import { prisma } from "../prisma";
import { revalidatePath } from "next/cache";
import { CalendarBookingSchema } from "../schemas/calendar";
import { requireStudioMember, requireBookingAccess } from "./with-auth";

// ── Get Bookings Per Month ───────────────────────────────────────────────────

export async function getBookingsPerMonth(studioId: string, year: number, month: number) {
    const auth = await requireStudioMember(studioId);
    if (auth.status === "error") throw new Error(auth.message);

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59);

    const rawBookings = await prisma.booking.findMany({
        where: {
            studioId,
            bookingDate: { gte: firstDay, lte: lastDay },
        },
        select: {
            id: true,
            bookingDate: true,
            sessionCount: true,
            notes: true,
            bookingStatus: true,
            paymentStatus: true,
            deliveryStatus: true,
            serviceId: true,
            studioId: true,
            clientId: true,
            createdBy: true,
            memberId: true,
            client: { select: { name: true } },
            service: { select: { name: true } },
        },
    });

    return z.array(CalendarBookingSchema).parse(rawBookings);
}

// ── Move Booking ─────────────────────────────────────────────────────────────

export async function moveBooking(bookingId: string, newDateKey: string) {
    const auth = await requireBookingAccess(bookingId);
    if (auth.status === "error") throw new Error(auth.message);

    const [y, m, d] = newDateKey.split("-").map(Number);

    const newDate = new Date(Date.UTC(y, m - 1, d));

    await prisma.booking.update({
        where: { id: bookingId },
        data: { bookingDate: newDate },
    });

    revalidatePath("/studios", "layout");
}