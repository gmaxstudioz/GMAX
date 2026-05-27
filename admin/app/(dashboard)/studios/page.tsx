import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { RenderEmptyState, RenderStudios } from "./_components/RenderSate";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Studios",
  description: "Browse and manage all your studios.",
};

export default async function StudiosPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const searchParams = await props.searchParams;
    const isListView = searchParams.view === "list";
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    // 1. Fetch User and Memberships
    const [user, members] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.user.id } }),
        prisma.member.findMany({ where: { userId: session.user.id } })
    ]);

    const isPlatformAdmin = user?.role === "admin";
    const hasAdminRole = isPlatformAdmin || members.some(m => ["owner", "manager"].includes(m.role));

    // 2. Optimized Studio Query
    // Note: We use 'creator' as defined in your Booking model relation
    const studioData = await prisma.studio.findMany({
        where: isPlatformAdmin ? {} : {
            members: { some: { userId: session.user.id } }
        },
        orderBy: { createdAt: "desc" },
        include: {
            members: true,
            services: { include: { variants: true } },
            studioSessions: true,
            clients: true,
            bookings: { include: { creator: true, service: { include: { variants: true } } } } // Explicitly include the 'creator' and 'service' relation for revenue calculation
        },
    });

    // 3. Logic: Redirect non-admins to their specific studio dashboard
    if (!hasAdminRole && studioData.length > 0) {
        redirect(`/studios/${studioData[0].slug}`);
    }

    return (
        <div className="flex flex-col gap-4 py-4 px-4">
            {studioData.length === 0 ? (
                <RenderEmptyState hasAdminRole={hasAdminRole} />
            ) : (
                <RenderStudios studioData={studioData} hasAdminRole={hasAdminRole} isListView={isListView} />
            )}
        </div>
    );
}