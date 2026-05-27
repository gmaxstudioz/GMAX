import { prisma } from "@/lib/prisma";
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
            services: {
                include: {
                    studioSession: {
                        select: {
                            id: true,
                            name: true,
                            duration: true,
                        }
                    },
                    variants: true,
                    _count: {
                        select: {
                            bookings: true,
                        }
                    }
                }
            }
        },
        orderBy: { name: "asc" }
    });

    const studioGroups = studios.map(studio => {
        const groupedServices = {
            PHOTOGRAPHY: studio.services.filter(s => s.category === "PHOTOGRAPHY"),
            VIDEOGRAPHY: studio.services.filter(s => s.category === "VIDEOGRAPHY"),
            OTHERS: studio.services.filter(s => s.category === "OTHERS"),
        };
        
        return {
            id: studio.id,
            slug: studio.slug,
            name: studio.name,
            categories: ["PHOTOGRAPHY", "VIDEOGRAPHY", "OTHERS"].map(cat => ({
                id: cat,
                name: cat,
                type: cat,
                services: groupedServices[cat as keyof typeof groupedServices].map(service => ({
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
