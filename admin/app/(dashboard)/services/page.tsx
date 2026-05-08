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
            categories: {
                include: {
                    services: {
                        include: {
                            studioSession: {
                                select: {
                                    id: true,
                                    name: true,
                                    duration: true,
                                }
                            },
                            _count: {
                                select: {
                                    bookings: true,
                                }
                            }
                        }
                    }
                },
                orderBy: { name: "asc" }
            },
        },
        orderBy: { name: "asc" }
    });

    // Shape data grouped by studio
    const studioGroups = studios.map(studio => ({
        id: studio.id,
        slug: studio.slug,
        name: studio.name,
        categories: studio.categories.map(category => ({
            ...category,
            services: category.services.map(service => ({
                ...service,
                studioId: studio.id,
                studioSlug: studio.slug,
                studioName: studio.name,
            })),
        })),
    }));

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <ServicesView studioGroups={studioGroups} />
        </div>
    );
}
