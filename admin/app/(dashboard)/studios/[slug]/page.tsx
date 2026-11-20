import type { Metadata } from "next";
import { StudioStatsCards } from "./_components/StatsCards"
import { BackButton } from "@/components/web/back-button";
import StudioData from "./_components/studioData";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface StudioDetailsProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: StudioDetailsProps): Promise<Metadata> {
    const { slug } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { title: "Studio Details", description: "View studio details" };
    }

    const studio = await db.query.studio.findFirst({
        where: eq(schema.studio.slug, slug),
        columns: { id: true, name: true },
    });
    if (!studio) {
        return { title: "Studio Details", description: "View studio details" };
    }

    const [callerUser, callerMember] = await Promise.all([
        db.query.user.findFirst({ where: eq(schema.user.id, session.user.id), columns: { role: true } }),
        db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, studio.id)),
            columns: { id: true },
        }),
    ]);

    if (callerUser?.role !== "admin" && !callerMember) {
        return { title: "Studio Details", description: "View studio details" };
    }

    return {
        title: studio.name,
        description: `View details, bookings, members, and analytics for ${studio.name}.`,
    };
}



export default async function StudioDetails({ params }: StudioDetailsProps) {
    const { slug } = await params;

    const studioData = await db.query.studio.findFirst({
        where: eq(schema.studio.slug, slug),
        with: {
            members: {
                with: { user: true }
            },
            pastMembers: {
                orderBy: (pastMembers, { desc }) => [desc(pastMembers.leftAt)],
            },
            invitations: true,
            services: {
                with: { studioSession: true, serviceVariants: { with: { serviceDeliverables: true } } },
                orderBy: (services, { asc }) => [asc(services.category), asc(services.name)],
            },
            studioSessions: true,
            clients: {
                with: { bookings: true }
            },
            bookings: {
                with: { client: true, service: { with: { serviceVariants: { with: { serviceDeliverables: true } } } }, revisionRequests: true }
            },
            bookingIntents: {
                orderBy: (intents, { desc }) => [desc(intents.createdAt)],
            },
        },
    });

    if (!studioData) {
        notFound();
    }
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const callerUser = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id),
        columns: { role: true },
    });
    const isPlatformAdmin = callerUser?.role === "admin";

    const myMembership = studioData.members.find((m: any) => m.userId === session.user.id);
    if (!myMembership) {
        redirect("/");
    }
    const userRole = myMembership.role;

    // Determine whether the caller is allowed to see former staff (management roles only)
    const managementRoles = ["owner", "admin", "manager", "developer"];
    const canViewPastMembers = managementRoles.includes(userRole);

    // Strip pastMembers entirely for non-management callers, and redact phoneNumber for non-platform-admin callers
    const filteredPastMembers = canViewPastMembers
        ? (studioData.pastMembers as any[]).map((pm: any) =>
              isPlatformAdmin ? pm : { ...pm, phoneNumber: null }
          )
        : [];

    const filteredInvitations = canViewPastMembers ? studioData.invitations : [];
    const filteredBookingIntents = canViewPastMembers ? studioData.bookingIntents : [];
    const canViewFinancials = ["owner", "admin", "manager", "developer", "receptionist"].includes(userRole);

    const filteredMembers = (studioData.members as any[]).map((m: any) => {
        if (canViewPastMembers || m.userId === session.user.id) return m;
        return {
            ...m,
            user: m.user ? { ...m.user, phoneNumber: null, email: "" } : m.user,
        };
    });

    const projectBooking = (b: any) => {
        if (canViewPastMembers) return b;
        return {
            ...b,
            accessCode: null,
            ...(canViewFinancials ? {} : { totalAmount: "0", pendingTotalAmount: null }),
        };
    };

    const filteredBookings = (studioData.bookings as any[]).map(projectBooking);
    const filteredClients = (studioData.clients as any[]).map((c: any) => ({
        ...c,
        bookings: Array.isArray(c.bookings) ? c.bookings.map(projectBooking) : c.bookings,
    }));

    // Build the serialized payload with role-filtered sensitive relations and fields
    const serialized = JSON.parse(JSON.stringify(
        {
            ...studioData,
            clients: filteredClients,
            members: filteredMembers,
            pastMembers: filteredPastMembers,
            invitations: filteredInvitations,
            bookingIntents: filteredBookingIntents,
            bookings: filteredBookings,
        },
        (_key, value) =>
            value !== null && typeof value === "object" && typeof value.toNumber === "function"
                ? value.toNumber()
                : value
    ));

    const canViewStats = ["owner", "admin", "manager", "developer"].includes(userRole);

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <div className="flex items-center justify-center gap-2 w-full">
                <BackButton href="/studios" />
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-2xl font-bold">{studioData?.name.toUpperCase()}</h1>
                </div>
            </div>
            {canViewStats && <StudioStatsCards data={serialized} />}
            <StudioData studioData={serialized} userRole={userRole} currentUserId={session.user.id} />
        </div>
    )
}
