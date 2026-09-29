import type { Metadata } from "next";
import { db } from "@/lib/db";
import { eq, and, or, inArray, asc, desc, isNull, sql } from "drizzle-orm";
import * as schema from "@/lib/schema";
import { RenderEmptyState, RenderStudios } from "./_components/RenderSate";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Studios",
  description: "Browse and manage all your studios.",
};

export default async function StudiosPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    // 1. Fetch User and Memberships
    const [user, members] = await Promise.all([
        db.query.user.findFirst({ where: eq(schema.user.id, session.user.id) }),
        db.query.member.findMany({ where: eq(schema.member.userId, session.user.id) })
    ]);

    const isPlatformAdmin = user?.role === "admin";
    const hasAdminRole = isPlatformAdmin || members.some(m => ["owner", "manager"].includes(m.role));

    // 2. Optimized Studio Query
    // Note: We use 'creator' as defined in your Booking model relation
    const studioIds = members.map(m => m.studioId);
    
    const studioData = await db.query.studio.findMany({
        where: (studio, { inArray }) => 
            isPlatformAdmin ? undefined : 
            studioIds.length > 0 ? inArray(studio.id, studioIds) : sql`1 = 0`,
        orderBy: (studio, { desc }) => [desc(studio.createdAt)],
        with: {
            members: true,
            services: { with: { serviceVariants: true } },
            studioSessions: true,
            clients: true,
            bookings: { with: { user: true, service: { with: { serviceVariants: true } } } } // Explicitly include the 'creator' and 'service' relation for revenue calculation
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
                <RenderStudios studioData={studioData} hasAdminRole={hasAdminRole} />
            )}
        </div>
    );
}