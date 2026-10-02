import type { Metadata } from "next";
import { StudioStatsCards } from "./_components/StatsCards"
import { BackButton } from "@/components/web/back-button";
import StudioData from "./_components/studioData";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface StudioDetailsProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: StudioDetailsProps): Promise<Metadata> {
    const { slug } = await params;
    const studio = await db.query.studio.findFirst({
        where: eq(schema.studio.slug, slug),
        columns: { name: true, metadata: true },
    });

    const studioName = studio?.name ?? "Studio Details";

    return {
        title: studioName,
        description: `View details, bookings, members, and analytics for ${studioName}.`,
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
            invitations: true,
            services: {
                with: { studioSession: true, serviceVariants: { with: { serviceDeliverables: true } } }
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

    const myMembership = studioData.members.find((m: any) => m.userId === session.user.id);
    if (!myMembership) {
        redirect("/");
    }
    const userRole = myMembership.role;

    // Serialize Prisma Decimal/Date objects to plain values for Client Components
    const serialized = JSON.parse(JSON.stringify(studioData, (_key, value) =>
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
            <StudioData studioData={serialized} userRole={userRole} />
        </div>
    )
}
