"use server";

import { prisma } from "../prisma";
import { auth } from "../auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function approvePriceChange(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member || !["admin", "owner", "developer"].includes(member.role)) {
            return { status: "error", message: "Unauthorized: Only admins can approve price changes" };
        }

        if (booking.priceApprovalStatus !== "PENDING_APPROVAL" || !booking.pendingTotalAmount) {
            return { status: "error", message: "No price change pending approval" };
        }

        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                totalAmount: booking.pendingTotalAmount,
                pendingTotalAmount: null,
                priceApprovalStatus: "APPROVED",
                priceApprovedBy: session.user.id,
                priceApprovedAt: new Date()
            }
        });

        // Notify the manager who requested it
        if (booking.priceChangedBy) {
            const manager = await prisma.member.findUnique({
                where: { id: booking.priceChangedBy },
                include: { user: true }
            });
            if (manager) {
                await prisma.userNotification.create({
                    data: {
                        userId: manager.userId,
                        title: "Price Change Approved",
                        message: `Your requested price change to ₦${booking.pendingTotalAmount} for a booking has been approved.`,
                        type: "SYSTEM",
                        bookingId: booking.id
                    }
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

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member || !["admin", "owner", "developer"].includes(member.role)) {
            return { status: "error", message: "Unauthorized: Only admins can reject price changes" };
        }

        if (booking.priceApprovalStatus !== "PENDING_APPROVAL") {
            return { status: "error", message: "No price change pending approval" };
        }

        const requestedAmount = booking.pendingTotalAmount;

        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                pendingTotalAmount: null,
                priceApprovalStatus: "REJECTED"
            }
        });

        // Notify the manager who requested it
        if (booking.priceChangedBy) {
            const manager = await prisma.member.findUnique({
                where: { id: booking.priceChangedBy },
                include: { user: true }
            });
            if (manager) {
                await prisma.userNotification.create({
                    data: {
                        userId: manager.userId,
                        title: "Price Change Rejected",
                        message: `Your requested price change to ₦${requestedAmount} for a booking was rejected by admin.`,
                        type: "SYSTEM",
                        bookingId: booking.id
                    }
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
