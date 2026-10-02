import type { Metadata } from "next";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
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
        db.query.user.findFirst({ where: eq(schema.user.id, session.user.id) }),
        db.query.member.findMany({ where: eq(schema.member.userId, session.user.id) })
    ]);

    const isPlatformAdmin = user?.role === "admin";
    const hasAdminRole = isPlatformAdmin || members.some((m: any) => ["owner", "developer"].includes(m.role));

    // 2. Optimized Studio Query
    let studioData: any[] = [];
    if (isPlatformAdmin) {
        studioData = await db.query.studio.findMany({
            orderBy: (studios, { desc }) => [desc(studios.createdAt)],
            with: {
                members: true,
                services: { with: { serviceVariants: true } },
                studioSessions: true,
                clients: true,
                bookings: { with: { user: true, service: { with: { serviceVariants: true } } } }
            },
        });
    } else {
        const studioIds = members.map((m: any) => m.studioId);
        if (studioIds.length > 0) {
            studioData = await db.query.studio.findMany({
                where: inArray(schema.studio.id, studioIds),
                orderBy: (studios, { desc }) => [desc(studios.createdAt)],
                with: {
                    members: true,
                    services: { with: { serviceVariants: true } },
                    studioSessions: true,
                    clients: true,
                    bookings: { with: { user: true, service: { with: { serviceVariants: true } } } }
                },
            });
        }
    }

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