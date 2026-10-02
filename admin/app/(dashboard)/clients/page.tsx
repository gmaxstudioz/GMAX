import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
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
        where: eq(schema.member.userId, session.user.id),
        columns: { role: true, studioId: true }
    });
    
    const adminRoles = ["owner", "developer", "receptionist"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
        redirect("/my-tasks");
    }

    const canEdit = members.some((m: any) => ["owner", "developer", "admin"].includes(m.role));

    const studioIds = members.map((m: any) => m.studioId);

    const studios = studioIds.length > 0 ? await db.query.studio.findMany({
        where: inArray(schema.studio.id, studioIds),
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
        orderBy: (studios, { asc }) => [asc(studios.name)]
    }) : [];

    // Shape data grouped by studio
    const studioGroups = studios.map((studio: any) => ({
        id: studio.id,
        slug: studio.slug,
        name: studio.name,
        clients: studio.clients.map((client: any) => ({
            ...client,
            studioId: studio.id,
            studioSlug: studio.slug,
        })),
    }));

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <ClientsView studioGroups={studioGroups} canEdit={canEdit} />
        </div>
    );
}
