import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
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
        where: eq(schema.member.userId, session.user.id),
        columns: { role: true, studioId: true }
    });
    
    const adminRoles = ["owner", "developer"];
    const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
    if (members.length > 0 && !hasAdminRole) {
        redirect("/my-tasks");
    }

    const studioIds = members.map((m: any) => m.studioId);

    const studios = studioIds.length > 0 ? await db.query.studio.findMany({
        where: inArray(schema.studio.id, studioIds),
        columns: {
            id: true,
            slug: true,
            name: true,
        },
        with: {
            services: {
                with: {
                    studioSession: {
                        columns: {
                            id: true,
                            name: true,
                            duration: true,
                        }
                    },
                    serviceVariants: {
                        with: {
                            serviceDeliverables: true
                        }
                    },
                    bookings: {
                        columns: { id: true }
                    }
                }
            }
        },
        orderBy: (studios, { asc }) => [asc(studios.name)]
    }) : [];

    const studioGroups = studios.map((studio: any) => {
        const mappedServices = studio.services.map((s: any) => ({
            ...s,
            variants: s.serviceVariants.map((v: any) => ({
                ...v,
                deliverables: v.serviceDeliverables || []
            })),
            _count: { bookings: s.bookings?.length || 0 }
        }));
        
        const groupedServices = {
            PHOTOGRAPHY: mappedServices.filter((s: any) => s.category === "PHOTOGRAPHY"),
            VIDEOGRAPHY: mappedServices.filter((s: any) => s.category === "VIDEOGRAPHY"),
            OTHERS: mappedServices.filter((s: any) => s.category === "OTHERS"),
        };
        
        return {
            id: studio.id,
            slug: studio.slug,
            name: studio.name,
            categories: ["PHOTOGRAPHY", "VIDEOGRAPHY", "OTHERS"].map(cat => ({
                id: cat,
                name: cat,
                type: cat,
                services: groupedServices[cat as keyof typeof groupedServices].map((service: any) => ({
                    ...service,
                    studioId: studio.id,
                    studioSlug: studio.slug,
                    studioName: studio.name,
                })),
            })).filter(c => c.services.length > 0)
        };
    });

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
