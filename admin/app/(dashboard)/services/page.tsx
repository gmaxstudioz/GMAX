import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { service } from "@/lib/schema";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ServicesView } from "./_components/ServicesView";

export const metadata: Metadata = {
    title: "All Services",
};

export default async function ServicesPage() {
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

    const myStudioIds = members.map(m => m.studioId);

    let studiosRaw: any[] = [];
    if (myStudioIds.length > 0) {
        studiosRaw = await db.query.studio.findMany({
            where: (studio, { inArray }) => inArray(studio.id, myStudioIds),
            columns: {
                id: true,
                slug: true,
                name: true,
            },
                with: {
                services: {
                    extras: {
                        bookingsCount: sql<number>`(select count(*)::int from "booking" where "booking"."serviceId" = ${service.id})`.as('bookingsCount')
                    },
                    with: {
                        studioSession: {
                            columns: {
                                id: true,
                                name: true,
                                duration: true,
                            }
                        },
                        serviceVariants: true,
                    }
                },
            },
            orderBy: (studio, { asc }) => [asc(studio.name)]
        });
    }

    const studios = studiosRaw.map(s => {
        const categoryMap = new Map();
        (s.services || []).forEach((sv: any) => {
            const { bookingsCount, ...rest } = sv;
            const mappedService = {
                ...rest,
                _count: { bookings: bookingsCount || 0 }
            };
            const cat = sv.category || 'UNCATEGORIZED';
            if (!categoryMap.has(cat)) {
                categoryMap.set(cat, { id: cat, name: cat, type: 'standard', services: [] });
            }
            categoryMap.get(cat).services.push(mappedService);
        });
        return {
            ...s,
            categories: Array.from(categoryMap.values())
        };
    });

    // Shape data grouped by studio
    const studioGroups = studios.map(studio => ({
        id: studio.id,
        slug: studio.slug,
        name: studio.name,
        categories: studio.categories.map((category: any) => ({
            ...category,
            services: category.services.map((service: any) => ({
                ...service,
                studioId: studio.id,
                studioSlug: studio.slug,
                studioName: studio.name,
            })),
        })),
    }));

    // Serialize Prisma Decimal objects to plain numbers for Client Components
    const serialized = JSON.parse(JSON.stringify(studioGroups, (_key, value) =>
        value !== null && typeof value === "object" && typeof value.toNumber === "function"
            ? value.toNumber()
            : value
    ));

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <ServicesView studioGroups={serialized} />
        </div>
    );
}
