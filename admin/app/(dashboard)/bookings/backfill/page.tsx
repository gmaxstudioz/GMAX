import { and, eq, gt, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { headers } from "next/headers";
import { BookingBackfillClient } from "./_components/BookingBackfillClient";

export default async function BookingBackfillPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const now = new Date().toISOString();
    const [memberships, grants] = await Promise.all([
        db.query.member.findMany({
            where: eq(schema.member.userId, session.user.id),
            columns: { studioId: true, role: true },
        }),
        db.query.bookingBackfillAccess.findMany({
            where: and(
                eq(schema.bookingBackfillAccess.userId, session.user.id),
                gt(schema.bookingBackfillAccess.expiresAt, now),
            ),
            columns: { studioId: true },
        }),
    ]);

    const ownerStudioIds = [...new Set(
        memberships.filter((membership) => membership.role === "owner").map((membership) => membership.studioId),
    )];
    const accessibleStudioIds = [...new Set([
        ...ownerStudioIds,
        ...grants
            .filter((grant) => memberships.some((membership) =>
                membership.studioId === grant.studioId && membership.role !== "owner",
            ))
            .map((grant) => grant.studioId),
    ])];
    if (accessibleStudioIds.length === 0) redirect("/");

    const [studios, services, studioMembers, accessGrants] = await Promise.all([
        db.query.studio.findMany({
            where: inArray(schema.studio.id, accessibleStudioIds),
            columns: { id: true, name: true },
            orderBy: (studio, { asc }) => [asc(studio.name)],
        }),
        db.query.service.findMany({
            where: inArray(schema.service.studioId, accessibleStudioIds),
            columns: { id: true, name: true, studioId: true, isActive: true },
            orderBy: (service, { asc }) => [asc(service.name)],
        }),
        ownerStudioIds.length > 0
            ? db.query.member.findMany({
                where: inArray(schema.member.studioId, ownerStudioIds),
                with: { user: { columns: { id: true, name: true, email: true } } },
            })
            : Promise.resolve([]),
        ownerStudioIds.length > 0
            ? db.query.bookingBackfillAccess.findMany({
                where: inArray(schema.bookingBackfillAccess.studioId, ownerStudioIds),
            })
            : Promise.resolve([]),
    ]);

    const grantUserIds = [...new Set(accessGrants.map((grant) => grant.userId))].filter(Boolean);
    const grantsByUser = grantUserIds.length > 0
        ? await db.query.user.findMany({
            where: inArray(schema.user.id, grantUserIds),
            columns: { id: true, name: true, email: true },
        })
        : [];
    const userById = new Map(grantsByUser.map((user) => [user.id, user]));

    return (
        <div className="px-4 py-6 lg:px-6">
            <BookingBackfillClient
                now={now}
                studios={studios}
                services={services}
                ownerStudioIds={ownerStudioIds}
                currentUserId={session.user.id}
                members={studioMembers.map((membership) => ({
                    studioId: membership.studioId,
                    userId: membership.userId,
                    role: membership.role,
                    name: membership.user.name,
                    email: membership.user.email,
                }))}
                grants={accessGrants.map((grant) => ({
                    studioId: grant.studioId,
                    userId: grant.userId,
                    expiresAt: grant.expiresAt,
                    name: userById.get(grant.userId)?.name ?? "Unknown member",
                    email: userById.get(grant.userId)?.email ?? "",
                }))}
            />
        </div>
    );
}
