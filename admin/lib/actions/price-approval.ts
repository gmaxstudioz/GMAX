"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function approvePriceChange(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, bookingId) });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({ where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId)) });
        if (!member || !["admin", "owner", "developer"].includes(member.role)) {
            return { status: "error", message: "Unauthorized: Only admins can approve price changes" };
        }

        if (booking.priceApprovalStatus !== "PENDING_APPROVAL" || !booking.pendingTotalAmount) {
            return { status: "error", message: "No price change pending approval" };
        }

        await db.update(schema.booking).set({
                totalAmount: booking.pendingTotalAmount,
                pendingTotalAmount: null,
                priceApprovalStatus: "APPROVED",
                priceApprovedBy: session.user.id,
                priceApprovedAt: new Date().toISOString()
            }).where(eq(schema.booking.id, bookingId));

        // Notify the manager who requested it
        if (booking.priceChangedBy) {
            const manager = await db.query.member.findFirst({ where: eq(schema.member.id, booking.priceChangedBy), with: { user: true } });
            if (manager) {
                await db.insert(schema.userNotification).values({ id: uuidv4(), 
                        userId: manager.userId,
                        title: "Price Change Approved",
                        message: `Your requested price change to ₦${booking.pendingTotalAmount} for a booking has been approved.`,
                        type: "SYSTEM",
                        bookingId: booking.id
                     });
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Price change approved successfully" };
    } catch (error) {
        console.error("Failed to approve price change:", error);
        return { status: "error", message: "Failed to approve price change" };
    }
}

export async function rejectPriceChange(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, bookingId) });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({ where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId)) });
        if (!member || !["admin", "owner", "developer"].includes(member.role)) {
            return { status: "error", message: "Unauthorized: Only admins can reject price changes" };
        }

        if (booking.priceApprovalStatus !== "PENDING_APPROVAL") {
            return { status: "error", message: "No price change pending approval" };
        }

        const requestedAmount = booking.pendingTotalAmount;

        await db.update(schema.booking).set({
                pendingTotalAmount: null,
                priceApprovalStatus: "REJECTED"
            }).where(eq(schema.booking.id, bookingId));

        // Notify the manager who requested it
        if (booking.priceChangedBy) {
            const manager = await db.query.member.findFirst({ where: eq(schema.member.id, booking.priceChangedBy), with: { user: true } });
            if (manager) {
                await db.insert(schema.userNotification).values({ id: uuidv4(), 
                        userId: manager.userId,
                        title: "Price Change Rejected",
                        message: `Your requested price change to ₦${requestedAmount} for a booking was rejected by admin.`,
                        type: "SYSTEM",
                        bookingId: booking.id
                     });
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Price change rejected successfully" };
    } catch (error) {
        console.error("Failed to reject price change:", error);
        return { status: "error", message: "Failed to reject price change" };
    }
}
