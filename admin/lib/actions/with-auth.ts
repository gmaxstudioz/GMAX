"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { prisma } from "../prisma";


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
        member: NonNullable<Awaited<ReturnType<typeof prisma.member.findFirst>>>;
    } |
    { status: "error"; message: string }
> {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") return sessionResult;

    const member = await prisma.member.findFirst({
        where: {
            userId: sessionResult.session.user.id,
            studioId,
        },
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
        member: NonNullable<Awaited<ReturnType<typeof prisma.member.findFirst>>>;
        booking: NonNullable<Awaited<ReturnType<typeof prisma.booking.findUnique>>>;
    } |
    { status: "error"; message: string }
> {
    const sessionResult = await requireSession();
    if (sessionResult.status === "error") return sessionResult;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return { status: "error", message: "Booking not found" };

    const member = await prisma.member.findFirst({
        where: {
            userId: sessionResult.session.user.id,
            studioId: booking.studioId,
        },
    });

    if (!member) return { status: "error", message: "Unauthorized access to this booking" };

    return { status: "ok", session: sessionResult.session, member, booking };
}