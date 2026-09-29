"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { db } from "../db";


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
        member: NonNullable<Awaited<ReturnType<typeof db.query.member.findFirst>>>;
    } |
    { status: "error"; message: string }
> {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") return sessionResult;

    const member = await db.query.member.findFirst({
        where: (m, { and, eq }) => and(
            eq(m.userId, sessionResult.session.user.id),
            eq(m.studioId, studioId)
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
        member: NonNullable<Awaited<ReturnType<typeof db.query.member.findFirst>>>;
        booking: NonNullable<Awaited<ReturnType<typeof db.query.booking.findFirst>>>;
    } |
    { status: "error"; message: string }
> {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") return sessionResult;

    const bookingRec = await db.query.booking.findFirst({
        where: (b, { eq }) => eq(b.id, bookingId)
    });
    if (!bookingRec) return { status: "error", message: "Booking not found" };

    const memberRec = await db.query.member.findFirst({
        where: (m, { and, eq }) => and(
            eq(m.userId, sessionResult.session.user.id),
            eq(m.studioId, bookingRec.studioId)
        ),
    });

    if (!memberRec) return { status: "error", message: "Unauthorized access to this booking" };

    return { status: "ok", session: sessionResult.session, member: memberRec, booking: bookingRec };
}