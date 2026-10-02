"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { db } from "../db";
import * as schema from "../schema";
import { eq, and } from "drizzle-orm";


// ── Raw session fetch ────────────────────────────────────────────────────────
// Use this when you need the session object itself (e.g. to get session.user.id)

export async function getAuthSession() {
    return auth.api.getSession({ headers: await headers() });
}

// ── Require authenticated session ────────────────────────────────────────────
// Returns the session or an ApiResponse error — never throws.
// Usage:
//   const result = await requireSession();
//   if (result.status === "error") return result;
//   const { session } = result;

export async function requireSession(): Promise<
    { status: "ok"; session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>> } |
    { status: "error"; message: string }
> {
    const session = await getAuthSession();
    if (!session?.user) return { status: "error", message: "Unauthorized" };
    return { status: "ok", session };
}

// ── Require studio membership ────────────────────────────────────────────────
// Verifies the current user is an active member of the given studio.
// Returns session + member or an ApiResponse error.
// Usage:
//   const result = await requireStudioMember(studioId);
//   if (result.status === "error") return result;
//   const { session, member } = result;

export async function requireStudioMember(studioId: string): Promise<
    {
        status: "ok";
        session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
        member: any;
    } |
    { status: "error"; message: string }
> {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") return sessionResult;

    const member = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, sessionResult.session.user.id),
            eq(schema.member.studioId, studioId)
        ),
    });

    if (!member) return { status: "error", message: "Unauthorized access to studio" };

    return { status: "ok", session: sessionResult.session, member };
}

// ── Require booking ownership ────────────────────────────────────────────────
// Verifies the caller is a member of the studio that owns the booking.
// Returns session + member + booking or an error.

export async function requireBookingAccess(bookingId: string): Promise<
    {
        status: "ok";
        session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
        member: any;
        booking: any;
    } |
    { status: "error"; message: string }
> {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") return sessionResult;

    const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, bookingId) });
    if (!booking) return { status: "error", message: "Booking not found" };

    const member = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, sessionResult.session.user.id),
            eq(schema.member.studioId, booking.studioId)
        ),
    });

    if (!memberRec) return { status: "error", message: "Unauthorized access to this booking" };

    return { status: "ok", session: sessionResult.session, member, booking };
}
