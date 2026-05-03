import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { RenderEmptyState, RenderStudios } from "./_components/RenderSate";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Studios",
  description:
    "Browse and manage all your studios. View members, bookings, and session details.",
};

export default async function StudiosPage() {    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: { role: true }
    });
    
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some(m => adminRoles.includes(m.role));

    const studioData = await prisma.studio.findMany({
        where: {
            members: {
                some: {
                    userId: session.user.id
                }
            }
        },
        orderBy: {
            createdAt: "desc",
        },
        include: {
            members: true,
            invitations: true,
            categories: true,
            studioSessions: true,
            clients: true,
            bookings: {
                include: { service: true }
            },
        },
    });

    const isSuperAdmin = members.some(m => ["owner", "developer"].includes(m.role));
    if (!isSuperAdmin && studioData.length > 0) {
        redirect(`/studios/${studioData[0].slug}`);
    }

    function RenderContent() {
        if (studioData.length === 0) {
            return <RenderEmptyState hasAdminRole={hasAdminRole} />
        } else {
            return (
                <RenderStudios studioData={studioData} hasAdminRole={hasAdminRole} />
            )
        }
    }

    return (
        <div className="flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6 md:px-6">
            {RenderContent()}
        </div>
    )
}