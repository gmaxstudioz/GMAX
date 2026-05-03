import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { ClientsView } from "./_components/ClientsView";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "All Clients",
};


export default async function ClientsPage() {
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

    const studios = await prisma.studio.findMany({
        where: {
            members: {
                some: {
                    userId: session.user.id
                }
            }
        },
        select: {
            id: true,
            slug: true,
            name: true,
            clients: {
                include: {
                    bookings: {
                        select: {
                            id: true,
                            bookingStatus: true,
                        }
                    }
                }
            }
        },
        orderBy: { name: "asc" }
    });

    // Shape data grouped by studio
    const studioGroups = studios.map(studio => ({
        id: studio.id,
        slug: studio.slug,
        name: studio.name,
        clients: studio.clients.map(client => ({
            ...client,
            studioId: studio.id,
            studioSlug: studio.slug,
        })),
    }));

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <ClientsView studioGroups={studioGroups} />
        </div>
    );
}