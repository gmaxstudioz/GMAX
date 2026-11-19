import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./schema";

export const ALL_STUDIO_ROLES = [
    "owner",
    "developer",
    "manager",
    "receptionist",
    "photographer",
    "videographer",
] as const;

export const MANAGEMENT_ROLES = ["owner", "developer", "manager"] as const;
export const BOOKING_CREATOR_ROLES = ["owner", "developer", "manager", "receptionist"] as const;
export const RESCHEDULE_ROLES = ["owner", "developer", "manager", "photographer", "videographer"] as const;

export async function requireStudioRole(
    userId: string,
    studioId: string,
    allowedRoles?: readonly string[],
) {
    const dbUser = await db.query.user.findFirst({
        where: eq(schema.user.id, userId),
        columns: { id: true, role: true },
    });

    if (!dbUser || dbUser.role === "deleted") {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required." });
    }

    if (dbUser.role === "admin") {
        return { isAdmin: true as const, member: null };
    }

    const memberRecord = await db.query.member.findFirst({
        where: and(eq(schema.member.userId, userId), eq(schema.member.studioId, studioId)),
    });

    if (!memberRecord) {
        throw new ORPCError("FORBIDDEN", { message: "Not a member of this studio." });
    }

    if (allowedRoles && !allowedRoles.includes(memberRecord.role)) {
        throw new ORPCError("FORBIDDEN", { message: "Insufficient studio permissions." });
    }

    return { isAdmin: false as const, member: memberRecord };
}

export async function requireBookingStudioRole(
    userId: string,
    bookingId: string,
    allowedRoles?: readonly string[],
) {
    const existing = await db.query.booking.findFirst({
        where: eq(schema.booking.id, bookingId),
    });

    if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Booking not found." });
    }

    const authz = await requireStudioRole(userId, existing.studioId, allowedRoles);
    return { booking: existing, ...authz };
}

export async function requireGlobalOwnerOrAdmin(userId: string) {
    const dbUser = await db.query.user.findFirst({
        where: eq(schema.user.id, userId),
        columns: { id: true, role: true },
    });

    if (!dbUser || dbUser.role === "deleted") {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required." });
    }

    if (dbUser.role === "admin") {
        return { isAdmin: true as const };
    }

    const ownerOrDev = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, userId),
            inArray(schema.member.role, ["owner", "developer"]),
        ),
    });

    if (!ownerOrDev) {
        throw new ORPCError("FORBIDDEN", {
            message: "Requires platform admin, owner, or developer privileges.",
        });
    }

    return { isAdmin: false as const };
}
