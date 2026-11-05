"use server";

import { and, eq, gt, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

const bookingEntrySchema = z.object({
    bookingDate: z.string().min(1).max(40),
    clientName: z.string().trim().min(2).max(120),
    clientPhone: z.string().trim().min(3).max(40),
    clientEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
    serviceId: z.string().min(1).max(100),
    totalAmount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
    bookingStatus: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]),
    paymentStatus: z.enum(["PENDING", "CANCELLED", "PAID", "PARTIALLY_PAID"]),
    notes: z.string().max(2000).optional(),
});

const batchSchema = z.object({
    studioId: z.string().min(1).max(100),
    entries: z.array(bookingEntrySchema).min(1).max(100),
});

const grantInputSchema = z.object({
    studioId: z.string().min(1).max(100),
    userId: z.string().min(1).max(100),
    duration: z.number().int().min(1).max(365),
    unit: z.enum(["hours", "days"]),
});

const revokeInputSchema = z.object({
    studioId: z.string().min(1).max(100),
    userId: z.string().min(1).max(100),
});

class BackfillValidationError extends Error {}

async function getBackfillAccess(studioId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { ok: false as const, error: "You must be signed in." };

    const membership = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, session.user.id),
            eq(schema.member.studioId, studioId),
        ),
        columns: { role: true },
    });

    if (membership?.role === "owner") {
        return { ok: true as const, session, isOwner: true };
    }

    if (!membership) {
        return { ok: false as const, error: "You are not a member of this studio." };
    }

    const grant = await db.query.bookingBackfillAccess.findFirst({
        where: and(
            eq(schema.bookingBackfillAccess.studioId, studioId),
            eq(schema.bookingBackfillAccess.userId, session.user.id),
            gt(schema.bookingBackfillAccess.expiresAt, new Date().toISOString()),
        ),
        columns: { id: true },
    });

    if (!grant) {
        return { ok: false as const, error: "You do not have active access to backfill bookings for this studio." };
    }

    return { ok: true as const, session, isOwner: false };
}

async function requireStudioOwner(studioId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { ok: false as const, error: "You must be signed in." };

    const membership = await db.query.member.findFirst({
        where: and(
            eq(schema.member.userId, session.user.id),
            eq(schema.member.studioId, studioId),
            eq(schema.member.role, "owner"),
        ),
        columns: { id: true },
    });

    if (!membership) return { ok: false as const, error: "Only a studio owner can manage backfill access." };
    return { ok: true as const, session };
}

export async function grantBookingBackfillAccess(input: unknown) {
    const parsed = grantInputSchema.safeParse(input);
    if (!parsed.success) {
        return { status: "error" as const, message: "Enter a valid member and access duration." };
    }
    const grantInput = parsed.data;

    const owner = await requireStudioOwner(grantInput.studioId);
    if (!owner.ok) return { status: "error" as const, message: owner.error };
    if (grantInput.userId === owner.session.user.id) {
        return { status: "error" as const, message: "You already have owner access." };
    }

    const targetMembership = await db.query.member.findFirst({
        where: and(
            eq(schema.member.studioId, grantInput.studioId),
            eq(schema.member.userId, grantInput.userId),
        ),
        columns: { id: true },
    });
    if (!targetMembership) {
        return { status: "error" as const, message: "The selected user is not a member of this studio." };
    }

    const durationMs = grantInput.duration * (grantInput.unit === "days" ? 24 : 1) * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs).toISOString();
    await db.insert(schema.bookingBackfillAccess)
        .values({
            id: uuidv4(),
            studioId: grantInput.studioId,
            userId: grantInput.userId,
            grantedById: owner.session.user.id,
            expiresAt,
        })
        .onConflictDoUpdate({
            target: [schema.bookingBackfillAccess.studioId, schema.bookingBackfillAccess.userId],
            set: {
                grantedById: owner.session.user.id,
                expiresAt,
                createdAt: new Date().toISOString(),
            },
        });

    revalidatePath("/bookings/backfill");
    return { status: "success" as const, message: "Temporary backfill access granted." };
}

export async function revokeBookingBackfillAccess(input: unknown) {
    const parsed = revokeInputSchema.safeParse(input);
    if (!parsed.success) return { status: "error" as const, message: "Select a valid studio member." };
    const { studioId, userId } = parsed.data;
    const owner = await requireStudioOwner(studioId);
    if (!owner.ok) return { status: "error" as const, message: owner.error };

    await db.delete(schema.bookingBackfillAccess).where(and(
        eq(schema.bookingBackfillAccess.studioId, studioId),
        eq(schema.bookingBackfillAccess.userId, userId),
    ));

    revalidatePath("/bookings/backfill");
    return { status: "success" as const, message: "Temporary backfill access revoked." };
}

export async function createHistoricalBookings(input: unknown) {
    const parsed = batchSchema.safeParse(input);
    if (!parsed.success) {
        return { status: "error" as const, message: parsed.error.issues[0]?.message ?? "Check the booking details." };
    }

    const { studioId, entries } = parsed.data;
    const access = await getBackfillAccess(studioId);
    if (!access.ok) return { status: "error" as const, message: access.error };

    for (const [index, entry] of entries.entries()) {
        const bookingDate = new Date(entry.bookingDate);
        const amount = Number(entry.totalAmount);
        if (
            !Number.isFinite(bookingDate.getTime()) ||
            bookingDate.toISOString() !== entry.bookingDate ||
            bookingDate.getTime() >= Date.now()
        ) {
            return { status: "error" as const, message: `Row ${index + 1}: booking date must be in the past.` };
        }
        if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) {
            return { status: "error" as const, message: `Row ${index + 1}: enter an amount greater than zero.` };
        }
    }

    try {
        const createdCount = await db.transaction(async (tx) => {
            let count = 0;
            for (const entry of entries) {
                const bookingDate = new Date(entry.bookingDate);
                const amount = Number(entry.totalAmount);
                const service = await tx.query.service.findFirst({
                    where: and(
                        eq(schema.service.id, entry.serviceId),
                        eq(schema.service.studioId, studioId),
                    ),
                    columns: { id: true },
                });
                if (!service) throw new BackfillValidationError(`The selected service on row ${count + 1} does not belong to this studio.`);

                const phone = entry.clientPhone.trim();
                const email = entry.clientEmail?.trim().toLowerCase() || undefined;
                const contactConditions = [eq(schema.client.phone, phone)];
                if (email) contactConditions.push(ilike(schema.client.email, email.replace(/[%_\\]/g, "\\$&")));
                const matchedClients = await tx.query.client.findMany({
                    where: and(
                        eq(schema.client.studioId, studioId),
                        or(...contactConditions),
                    ),
                    limit: 2,
                });
                if (matchedClients.length > 1) {
                    throw new BackfillValidationError(`Row ${count + 1}: phone and email match different clients; reconcile the client records first.`);
                }

                const client = matchedClients[0] ?? (await tx.insert(schema.client).values({
                    id: uuidv4(),
                    name: entry.clientName,
                    phone,
                    email: email ?? null,
                    type: "regular",
                    studioId,
                }).returning({ id: schema.client.id }))[0];

                await tx.insert(schema.booking).values({
                    id: uuidv4(),
                    bookingDate: bookingDate.toISOString(),
                    sessionCount: 1,
                    extraPicturesCount: 0,
                    notes: entry.notes?.trim() || null,
                    totalAmount: amount.toFixed(2),
                    paymentPlan: "FULL",
                    bookingStatus: entry.bookingStatus,
                    paymentStatus: entry.paymentStatus,
                    deliveryStatus: "PENDING",
                    serviceId: service.id,
                    studioId,
                    clientId: client.id,
                    createdBy: access.session.user.id,
                });
                count += 1;
            }
            return count;
        });

        revalidatePath("/");
        revalidatePath("/bookings");
        revalidatePath("/finances");
        return { status: "success" as const, message: `${createdCount} historical booking${createdCount === 1 ? "" : "s"} added.` };
    } catch (error) {
        if (error instanceof BackfillValidationError) {
            return { status: "error" as const, message: error.message };
        }
        console.error("[Booking Backfill] Failed to create historical bookings:", error);
        return {
            status: "error" as const,
            message: "Bookings could not be added. Please try again.",
        };
    }
}
