import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { GlobalBookingsClient } from "./_components/GlobalBookingsClient";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarBooking } from "@/lib/schemas/calendar";

export const metadata: Metadata = {
    title: "Global Bookings",
    description: "Manage bookings across all studios.",
};

export default async function GlobalBookingsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await db.query.member.findMany({
        where: eq(schema.member.userId, session.user.id),
        columns: { role: true, studioId: true }
    });
    
    const adminRoles = ["owner", "developer", "receptionist"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
        redirect("/my-tasks");
    }

    const studioIds = members.map((m: any) => m.studioId);

    // Fetch all bookings across all studios where the user is a member
    const allBookings = studioIds.length > 0 ? await db.query.booking.findMany({
        where: inArray(schema.booking.studioId, studioIds),
        with: {
            client: true,
            service: true
        }
    }) : [];

    // Serialize Prisma Decimal objects to plain numbers for Client Components
    const serializedBookings = JSON.parse(JSON.stringify(allBookings, (_key, value) =>
        value !== null && typeof value === "object" && typeof value.toNumber === "function"
            ? value.toNumber()
            : value
    ));

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <GlobalBookingsClient bookings={serializedBookings as CalendarBooking[]} />
        </div>
    );
}
