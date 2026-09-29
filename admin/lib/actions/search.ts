"use server";

import { db } from "@/lib/db";
import { user as userSchema, member as memberSchema, client as clientSchema, product as productSchema, service as serviceSchema, studio as studioSchema } from "@/lib/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getGlobalSearchData() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;

    const [user, members] = await Promise.all([
        db.query.user.findFirst({
            where: eq(userSchema.id, session.user.id),
            columns: { role: true }
        }),
        db.query.member.findMany({
            where: eq(memberSchema.userId, session.user.id),
            columns: { studioId: true, role: true }
        })
    ]);

    const isPlatformAdmin = user?.role === "admin";
    const accessibleStudioIds = isPlatformAdmin ? [] : members.map((member) => member.studioId);
    const hasStoreAccess = isPlatformAdmin || members.some((member) => ["owner", "developer", "manager"].includes(member.role));

    const inAccessibleStudios = (col: any) => accessibleStudioIds.length > 0 ? inArray(col, accessibleStudioIds) : sql`false`;

    const [clients, products, services, studios] = await Promise.all([
        db.query.client.findMany({
            where: isPlatformAdmin ? undefined : inAccessibleStudios(clientSchema.studioId),
            columns: { id: true, name: true, email: true },
            limit: 100,
            orderBy: desc(clientSchema.createdAt)
        }),
        hasStoreAccess
            ? db.query.product.findMany({
                columns: { id: true, title: true, isPublished: true },
                limit: 100,
                orderBy: desc(productSchema.createdAt)
            })
            : Promise.resolve([]),
        db.query.service.findMany({
            where: isPlatformAdmin ? undefined : inAccessibleStudios(serviceSchema.studioId),
            columns: { id: true, name: true },
            limit: 100,
            orderBy: desc(serviceSchema.createdAt)
        }),
        db.query.studio.findMany({
            where: isPlatformAdmin ? undefined : inAccessibleStudios(studioSchema.id),
            columns: { id: true, name: true, slug: true },
            limit: 50,
            orderBy: desc(studioSchema.createdAt)
        })
    ]);

    return {
        clients,
        products,
        services,
        studios,
    };
}
