"use server";

import z from "zod";
import { prisma } from "../prisma";
import { revalidatePath } from "next/cache";
import { CalendarBookingSchema } from "../schemas/calendar";

export async function getBookingsPerMonth(studioId: string, year: number, month: number) {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59)

    const rawBookings = await prisma.booking.findMany({
        where: {
            studioId,
            bookingDate: {
                gte: firstDay,
                lte: lastDay
            }
        },
        select: {
            id: true,
            bookingDate: true,
            bookingStatus: true,
            paymentStatus: true,
            clientId: true,
            client: {
                select: {
                    name: true
                }
            }
        }
    });

    return z.array(CalendarBookingSchema).parse(rawBookings);
}

export async function moveBooking(bookingId: string, newDateKey: string) {
    const [y, m, d] = newDateKey.split('-').map(Number);
    const newDate = new Date(y, m - 1, d);

    await prisma.booking.update({
        where: { id: bookingId },
        data: { bookingDate: newDate }
    });

    revalidatePath("/dashboard/studios", "layout");
}