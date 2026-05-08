import { prisma } from "@/lib/prisma";
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

    const members = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: { role: true }
    });
    
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some(m => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
        redirect("/my-tasks");
    }

    // Fetch all bookings across all studios where the user is a member
    const allBookings = await prisma.booking.findMany({
        where: {
            studio: {
                members: {
                    some: {
                        userId: session.user.id
                    }
                }
            }
        },
        include: {
            client: true,
            service: true
        }
    });

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <GlobalBookingsClient bookings={allBookings as CalendarBooking[]} />
        </div>
    );
}
