import type { Metadata } from "next";
import { StudioStatsCards } from "./_components/StatsCards"
import { BackButton } from "@/components/web/back-button";
import StudioData from "./_components/studioData";
import { db } from "@/lib/db";
import { eq, and, or, inArray, asc, desc, isNull, sql } from "drizzle-orm";
import * as schema from "@/lib/schema";
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
                with: { client: true, service: { with: { serviceVariants: { with: { serviceDeliverables: true } } } } }
            },
            bookingIntents: {
                orderBy: [desc(schema.bookingIntent.createdAt)],
            },
        },
    });

    if (studioData) {
        // Group services by category to mimic Prisma's 'categories' array
        const categoryMap = new Map();
        studioData.services.forEach(s => {
            s.serviceVariants = s.serviceVariants;
            if (s.serviceVariants) {
                s.serviceVariants.forEach(v => (v as any).deliverables = v.serviceDeliverables);
            }
            if (!categoryMap.has(s.category)) {
                categoryMap.set(s.category, { id: s.category, name: s.category, type: 'standard', services: [] });
            }
            categoryMap.get(s.category).services.push(s);
        });
        (studioData as any).categories = Array.from(categoryMap.values());
        
        studioData.bookings.forEach(b => {
            if (b.service) {
                b.service.serviceVariants = b.service.serviceVariants;
                if (b.service.serviceVariants) {
                    b.service.serviceVariants.forEach(v => (v as any).deliverables = v.serviceDeliverables);
                }
            }
        });
    }


    if (!studioData) {
        notFound();
    }
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const myMembership = studioData.members.find(m => m.userId === session.user.id);
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

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <div className="flex items-center justify-center gap-2 w-full">
                <BackButton href="/studios" />
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-2xl font-bold">{studioData?.name.toUpperCase()}</h1>
                </div>
            </div>
            <StudioStatsCards data={serialized} />
            <StudioData studioData={serialized} userRole={userRole} />
        </div>
    )
}