"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getGlobalSearchData() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;

    const [user, members] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        }),
        prisma.member.findMany({
            where: { userId: session.user.id },
            select: { studioId: true, role: true }
        })
    ]);

    const isPlatformAdmin = user?.role === "admin";
    const accessibleStudioIds = isPlatformAdmin ? undefined : members.map((member) => member.studioId);
    const hasStoreAccess = isPlatformAdmin || members.some((member) => ["owner", "developer", "manager"].includes(member.role));

    // To prevent returning too much data, we'll fetch the most recent items
    // or you can limit to 50-100 per category for instant searching.

    const [clients, products, services, studios] = await Promise.all([
        prisma.client.findMany({
            where: isPlatformAdmin ? undefined : { studioId: { in: accessibleStudioIds } },
            select: { id: true, name: true, email: true },
            take: 100,
            orderBy: { createdAt: "desc" }
        }),
        hasStoreAccess
            ? prisma.product.findMany({
                select: { id: true, title: true, isPublished: true },
                take: 100,
                orderBy: { createdAt: "desc" }
            })
            : Promise.resolve([]),
        prisma.service.findMany({
            where: isPlatformAdmin ? undefined : { studioSession: { studioId: { in: accessibleStudioIds } } },
            select: { id: true, name: true },
            take: 100,
            orderBy: { createdAt: "desc" }
        }),
        prisma.studio.findMany({
            where: isPlatformAdmin ? undefined : { id: { in: accessibleStudioIds } },
            select: { id: true, name: true, slug: true },
            take: 50,
            orderBy: { createdAt: "desc" }
        })
    ]);

    return {
        clients,
        products,
        services,
        studios,
    };
}
