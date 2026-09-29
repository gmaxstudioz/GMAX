import { db } from "@/lib/db";
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

    const members = await db.query.member.findMany({
        where: (member, { eq }) => eq(member.userId, session.user.id),
        columns: { role: true, studioId: true }
    });
    
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some(m => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
        redirect("/my-tasks");
    }

    const studioIds = members.map(m => m.studioId);

    const studios = studioIds.length > 0 ? await db.query.studio.findMany({
        where: (studio, { inArray }) => inArray(studio.id, studioIds),
        columns: {
            id: true,
            slug: true,
            name: true,
        },
        with: {
            clients: {
                with: {
                    bookings: {
                        columns: {
                            id: true,
                            bookingStatus: true,
                        }
                    }
                }
            }
        },
        orderBy: (studio, { asc }) => [asc(studio.name)]
    }) : [];

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
