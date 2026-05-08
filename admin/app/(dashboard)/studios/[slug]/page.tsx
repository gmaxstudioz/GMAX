import type { Metadata } from "next";
import { StudioStatsCards } from "./_components/StatsCards"
import { BackButton } from "@/components/web/back-button";
import StudioData from "./_components/studioData";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface StudioDetailsProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: StudioDetailsProps): Promise<Metadata> {
    const { slug } = await params;
    const studio = await prisma.studio.findUnique({
        where: { slug },
        select: { name: true, metadata: true },
    });

    const studioName = studio?.name ?? "Studio Details";

    return {
        title: studioName,
        description: `View details, bookings, members, and analytics for ${studioName}.`,
    };
}



export default async function StudioDetails({ params }: StudioDetailsProps) {
    const { slug } = await params;

    const studioData = await prisma.studio.findUnique({
        where: {
            slug: slug
        },
        include: {
            members: {
                include: { user: true }
            },
            invitations: true,
            categories: {
                include: { services: { include: { studioSession: true } } }
            },
            studioSessions: true,
            clients: {
                include: { bookings: true }
            },
            bookings: {
                include: { client: true, service: true }
            },
        },
    });

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

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            <div className="flex items-center justify-center gap-2 w-full">
                <BackButton href="/studios" />
                <div className="flex items-center justify-between w-full">
                    <h1 className="text-2xl font-bold">{studioData?.name.toUpperCase()}</h1>
                </div>
            </div>
            <StudioStatsCards data={studioData} />
            <StudioData studioData={studioData} userRole={userRole} />
        </div>
    )
}