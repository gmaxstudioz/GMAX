"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getGlobalSearchData() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;

    // To prevent returning too much data, we'll fetch the most recent items
    // or you can limit to 50-100 per category for instant searching.

    const [clients, products, services, studios] = await Promise.all([
        prisma.client.findMany({
            select: { id: true, name: true, email: true },
            take: 100,
            orderBy: { createdAt: "desc" }
        }),
        prisma.product.findMany({
            select: { id: true, title: true, isPublished: true },
            take: 100,
            orderBy: { createdAt: "desc" }
        }),
        prisma.service.findMany({
            select: { id: true, name: true },
            take: 100,
            orderBy: { createdAt: "desc" }
        }),
        prisma.studio.findMany({
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
