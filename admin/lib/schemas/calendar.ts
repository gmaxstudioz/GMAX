import z from "zod";
import { BookingPerDay, BookingSchema } from "./booking";

// ── CalendarBookingSchema ────────────────────────────────────────────────────

export const CalendarBookingSchema = BookingSchema.pick({
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
}).extend({
    id: z.string(),
    memberId: z.string().nullable().optional(),
    client: z.object({ name: z.string() }),
    service: z.object({ name: z.string() }),
});

export function toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function groupBookingsByDate(
    bookings: CalendarBooking[],
): Record<string, CalendarBooking[]> {
    return bookings.reduce(
        (acc, booking) => {
            const key = toDateKey(booking.bookingDate);
            if (!acc[key]) acc[key] = [];
            acc[key].push(booking);
            return acc;
        },
        {} as Record<string, CalendarBooking[]>,
    );
}

// ── getDaysInMonth ───────────────────────────────────────────────────────────

export function getDaysInMonth(year: number, month: number): BookingPerDay[] {
    const GRID_SIZE = 42; // 6 rows × 7 columns — handles all month/weekday combinations

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0 = Sunday

    const days: BookingPerDay[] = [];

    // Pad from previous month
    for (let i = startOffset; i > 0; i--) {
        const date = new Date(year, month, 1 - i);
        days.push({ date, key: toDateKey(date), isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        days.push({ date, key: toDateKey(date), isCurrentMonth: true });
    }

    // Pad to next month to fill the grid
    const remainingDays = GRID_SIZE - days.length;
    for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, key: toDateKey(date), isCurrentMonth: false });
    }

    return days;
}

export type CalendarBooking = z.infer<typeof CalendarBookingSchema>;