"use server";

import { prisma } from "../prisma";
import { auth } from "../auth";
import { headers } from "next/headers";
import { CreateBookingInput } from "../schemas/booking";
import { revalidatePath } from "next/cache";

import { startOfDay, endOfDay } from "date-fns";

export async function createBooking(data: CreateBookingInput, studioId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return { status: "error", message: "Unauthorized" };
        }

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId }
        });
        if (!member) {
            return { status: "error", message: "Unauthorized access to studio" };
        }

        const { addonIds, ...bookingData } = data;

        // Capacity and Alternative Recommendation Logic
        const targetDate = new Date(bookingData.bookingDate);
        const start = startOfDay(targetDate);
        const end = endOfDay(targetDate);

        const targetService = await prisma.service.findUnique({
            where: { id: bookingData.serviceId },
            include: { studioSession: true }
        });

        if (!targetService) return { status: "error", message: "Service not found." };
        
        const proposedDuration = (targetService.studioSession?.duration || 45) * bookingData.sessionCount;
        const proposedStart = targetDate.getTime();
        const proposedEnd = proposedStart + (proposedDuration * 60 * 1000);

        const dailyBookings = await prisma.booking.findMany({
            where: {
                studioId,
                bookingDate: { gte: start, lte: end }
            },
            include: { service: { include: { studioSession: true } } }
        });

        let hasOverlap = false;

        for (const b of dailyBookings) {
            const bDur = b.service?.studioSession?.duration || 45;
            const bStart = new Date(b.bookingDate).getTime();
            const bEnd = bStart + (bDur * b.sessionCount * 60 * 1000);

            // Strict intersection
            if (proposedStart < bEnd && proposedEnd > bStart) {
                hasOverlap = true;
                break;
            }
        }

        // Bound to open hours (8am - 8pm)
        const openTime = start.getTime() + (8 * 60 * 60 * 1000);
        const closeTime = start.getTime() + (20 * 60 * 60 * 1000);

        if (proposedStart < openTime || proposedEnd > closeTime) {
            hasOverlap = true;
        }

        if (hasOverlap) {
            // Find an alternative studio
            const currentStudio = await prisma.studio.findUnique({ where: { id: studioId } });
            const myCity = (currentStudio?.metadata as any)?.city as string;

            let altMessage = `The selected time slot is fully booked or outside operating hours. Please choose another time or day.`;

            if (myCity) {
                // Fetch all other studios to find a location match with capacity
                const allStudios = await prisma.studio.findMany({ 
                    include: { 
                        bookings: { 
                            where: { bookingDate: { gte: start, lte: end } }, 
                            include: { service: { include: { studioSession: true } } } 
                        } 
                    } 
                });

                const alternative = allStudios.find(s => {
                    if (s.id === studioId) return false;
                    const sCity = (s.metadata as any)?.city as string;
                    if (!sCity || sCity.toLowerCase() !== myCity.toLowerCase()) return false;
                    
                    const altOverlaps = s.bookings.some(b => {
                        const bDur = b.service?.studioSession?.duration || 45;
                        const bStart = new Date(b.bookingDate).getTime();
                        const bEnd = bStart + (bDur * b.sessionCount * 60 * 1000);
                        return proposedStart < bEnd && proposedEnd > bStart;
                    });
                    
                    return !altOverlaps;
                });
                
                if (alternative) {
                    altMessage = `That time is fully booked! We recommend ${alternative.name} which is also in ${myCity} and has availability at this exact time, or choose another time slot.`;
                }
            }

            return { status: "error", message: altMessage };
        }

        const booking = await prisma.booking.create({
            data: {
                ...bookingData,
                studioId,
                createdBy: session.user.id,
                ...(addonIds && addonIds.length > 0 && {
                    addons: {
                        connect: addonIds.map(id => ({ id })),
                    },
                }),
            }
        });

        revalidatePath(`/studios`, "layout");
        return { status: "success", data: booking };
    } catch (error) {
        console.error("Failed to create booking:", error);
        return { status: "error", message: "Failed to create booking" };
    }
}

export async function reassignBooking(bookingId: string, memberId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return { status: "error", message: "Unauthorized" };
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });

        if (!member || !["owner", "manager", "admin", "developer"].includes(member.role)) {
            return { status: "error", message: "Unauthorized" };
        }


        await prisma.booking.update({
            where: { id: bookingId },
            data: { memberId }
        });

        revalidatePath("/studios", "layout");
        return { status: "success" };
    } catch (e) {
        console.error("Failed to reassign booking:", e);
        return { status: "error", message: "Internal Error" };
    }
}

export async function rescheduleBooking(bookingId: string, newDate: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return { status: "error", message: "Unauthorized" };
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                service: {
                    include: { studioSession: true }
                }
            }
        });

        if (!booking) return { status: "error", message: "Booking not found" };

        // Verify user belongs to this studio
        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member) {
            return { status: "error", message: "Unauthorized" };
        }

        const targetDate = new Date(newDate);
        const start = startOfDay(targetDate);
        const end = endOfDay(targetDate);

        const duration = (booking.service?.studioSession?.duration || 45) * booking.sessionCount;
        const proposedStart = targetDate.getTime();
        const proposedEnd = proposedStart + (duration * 60 * 1000);

        // Bound to open hours (8am - 8pm)
        const openTime = start.getTime() + (8 * 60 * 60 * 1000);
        const closeTime = start.getTime() + (20 * 60 * 60 * 1000);

        if (proposedStart < openTime || proposedEnd > closeTime) {
            return { status: "error", message: "The selected time is outside operating hours (8am - 8pm)." };
        }

        // Check for overlaps with other bookings (exclude this booking)
        const dailyBookings = await prisma.booking.findMany({
            where: {
                studioId: booking.studioId,
                bookingDate: { gte: start, lte: end },
                id: { not: bookingId }
            },
            include: { service: { include: { studioSession: true } } }
        });

        for (const b of dailyBookings) {
            const bDur = (b.service?.studioSession?.duration || 45) * b.sessionCount;
            const bStart = new Date(b.bookingDate).getTime();
            const bEnd = bStart + (bDur * 60 * 1000);

            if (proposedStart < bEnd && proposedEnd > bStart) {
                return { status: "error", message: "This time overlaps with another booking. Please choose a different time." };
            }
        }

        await prisma.booking.update({
            where: { id: bookingId },
            data: { bookingDate: targetDate }
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking rescheduled successfully" };
    } catch (e) {
        console.error("Failed to reschedule booking:", e);
        return { status: "error", message: "Failed to reschedule booking" };
    }
}

// ── Update Booking Info ────────────────────────────────────────────

export async function updateBookingInfo(
    bookingId: string,
    data: {
        notes?: string;
        sessionCount?: number;
        bookingStatus?: string;
        paymentStatus?: string;
        deliveryStatus?: string;
    }
) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member) return { status: "error", message: "Unauthorized" };

        const updateData: any = {};
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.sessionCount !== undefined) updateData.sessionCount = Math.max(1, data.sessionCount);
        if (data.bookingStatus) updateData.bookingStatus = data.bookingStatus;
        if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
        if (data.deliveryStatus) updateData.deliveryStatus = data.deliveryStatus;

        await prisma.booking.update({
            where: { id: bookingId },
            data: updateData,
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking updated successfully" };
    } catch (e) {
        console.error("Failed to update booking:", e);
        return { status: "error", message: "Failed to update booking" };
    }
}

// ── Upload Booking Photo ───────────────────────────────────────────

export async function uploadBookingPhoto(data: {
    bookingId: string;
    r2Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member) return { status: "error", message: "Unauthorized" };

        // Admin, manager, owner uploads auto-approve
        const autoApproveRoles = ["admin", "manager", "owner"];
        const isAutoApproved = autoApproveRoles.includes(member.role);

        const photo = await prisma.photo.create({
            data: {
                bookingId: data.bookingId,
                r2Key: data.r2Key,
                fileName: data.fileName,
                fileSize: data.fileSize,
                mimeType: data.mimeType,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                uploadedById: session.user.id,
                approvalStatus: isAutoApproved ? "APPROVED" : "PENDING_REVIEW",
                approvedAt: isAutoApproved ? new Date() : undefined,
                approvedById: isAutoApproved ? session.user.id : undefined,
            },
        });

        revalidatePath("/studios", "layout");
        return { status: "success", data: photo };
    } catch (e) {
        console.error("Failed to upload photo:", e);
        return { status: "error", message: "Failed to save photo record" };
    }
}

// ── Approve Photo ──────────────────────────────────────────────────

export async function approvePhoto(photoId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const photo = await prisma.photo.findUnique({
            where: { id: photoId },
            include: { booking: { include: { client: true, studio: true } } },
        });
        if (!photo) return { status: "error", message: "Photo not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: photo.booking.studioId }
        });
        if (!member || !["admin", "manager", "owner"].includes(member.role)) {
            return { status: "error", message: "Only managers can approve photos" };
        }

        await prisma.photo.update({
            where: { id: photoId },
            data: {
                approvalStatus: "APPROVED",
                approvedAt: new Date(),
                approvedById: session.user.id,
            },
        });

        // Notify client via Termii
        const client = photo.booking.client;
        const studioName = photo.booking.studio?.name || "Studio";
        if (client?.phone?.length > 0) {
            const { sendSMS } = await import("../termii");
            const message = `Hi ${client.name}! Your photos from ${studioName} are ready for viewing and download. Visit your booking page to access them.`;
            try {
                await sendSMS(client.phone[0], message);
            } catch (err) {
                console.error("[Termii] Failed to notify client:", err);
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Photo approved" };
    } catch (e) {
        console.error("Failed to approve photo:", e);
        return { status: "error", message: "Failed to approve photo" };
    }
}

// ── Reject Photo ───────────────────────────────────────────────────

export async function rejectPhoto(photoId: string, reason?: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const photo = await prisma.photo.findUnique({
            where: { id: photoId },
            include: { booking: true },
        });
        if (!photo) return { status: "error", message: "Photo not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: photo.booking.studioId }
        });
        if (!member || !["admin", "manager", "owner"].includes(member.role)) {
            return { status: "error", message: "Only managers can reject photos" };
        }

        await prisma.photo.update({
            where: { id: photoId },
            data: {
                approvalStatus: "REJECTED",
                rejectionReason: reason || undefined,
            },
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Photo rejected" };
    } catch (e) {
        console.error("Failed to reject photo:", e);
        return { status: "error", message: "Failed to reject photo" };
    }
}

// ── Delete Photo ───────────────────────────────────────────────────

export async function deletePhoto(photoId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const photo = await prisma.photo.findUnique({
            where: { id: photoId },
            include: { booking: true },
        });
        if (!photo) return { status: "error", message: "Photo not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: photo.booking.studioId }
        });
        if (!member || !["admin", "manager", "owner", "receptionist"].includes(member.role)) {
            return { status: "error", message: "You don't have permission to delete photos" };
        }

        // Delete from R2 storage
        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await fetch(`${baseUrl}/api/s3/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: photo.r2Key }),
            });
        } catch (r2Error) {
            console.error("[R2] Failed to delete file from storage:", r2Error);
            // Continue with DB deletion even if R2 fails
        }

        // Delete from database
        await prisma.photo.delete({ where: { id: photoId } });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Photo deleted successfully" };
    } catch (e) {
        console.error("Failed to delete photo:", e);
        return { status: "error", message: "Failed to delete photo" };
    }
}

// ── Delete Booking ─────────────────────────────────────────────────

export async function deleteBooking(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { photos: true },
        });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member || !["admin", "manager", "owner", "receptionist"].includes(member.role)) {
            return { status: "error", message: "You don't have permission to delete bookings" };
        }

        // Delete all associated photos from R2 storage
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        for (const photo of booking.photos) {
            try {
                await fetch(`${baseUrl}/api/s3/delete`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: photo.r2Key }),
                });
            } catch (r2Error) {
                console.error(`[R2] Failed to delete photo ${photo.r2Key}:`, r2Error);
            }
        }

        // Cascade delete handles payments, photos, addon relations
        await prisma.booking.delete({ where: { id: bookingId } });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking deleted successfully" };
    } catch (e) {
        console.error("Failed to delete booking:", e);
        return { status: "error", message: "Failed to delete booking" };
    }
}

// ── Update Booking (Full) ──────────────────────────────────────────

export async function updateBookingFull(
    bookingId: string,
    data: {
        clientId?: string;
        serviceId?: string;
        memberId?: string;
        bookingDate?: string;
        sessionCount?: number;
        notes?: string;
        bookingStatus?: string;
        paymentStatus?: string;
        deliveryStatus?: string;
        addonIds?: string[];
    }
) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                service: { include: { studioSession: true } },
                addons: true,
            },
        });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId }
        });
        if (!member) return { status: "error", message: "Unauthorized" };

        // Build update data
        const updateData: any = {};

        if (data.clientId) updateData.clientId = data.clientId;
        if (data.serviceId) updateData.serviceId = data.serviceId;
        if (data.memberId) updateData.memberId = data.memberId;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.sessionCount !== undefined) updateData.sessionCount = Math.max(1, data.sessionCount);
        if (data.bookingStatus) updateData.bookingStatus = data.bookingStatus;
        if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
        if (data.deliveryStatus) updateData.deliveryStatus = data.deliveryStatus;

        // Handle date change with overlap checking
        if (data.bookingDate) {
            const targetDate = new Date(data.bookingDate);

            // Get the service for duration calculation
            const serviceForDuration = data.serviceId
                ? await prisma.service.findUnique({ where: { id: data.serviceId }, include: { studioSession: true } })
                : booking.service;

            const sessionCount = data.sessionCount ?? booking.sessionCount;
            const duration = (serviceForDuration?.studioSession?.duration || 45) * sessionCount;
            const proposedStart = targetDate.getTime();
            const proposedEnd = proposedStart + (duration * 60 * 1000);

            const start = startOfDay(targetDate);
            const end = endOfDay(targetDate);

            // Check operating hours
            const openTime = start.getTime() + (8 * 60 * 60 * 1000);
            const closeTime = start.getTime() + (20 * 60 * 60 * 1000);
            if (proposedStart < openTime || proposedEnd > closeTime) {
                return { status: "error", message: "The selected time is outside operating hours (8am - 8pm)." };
            }

            // Check overlaps
            const dailyBookings = await prisma.booking.findMany({
                where: {
                    studioId: booking.studioId,
                    bookingDate: { gte: start, lte: end },
                    id: { not: bookingId },
                },
                include: { service: { include: { studioSession: true } } },
            });

            for (const b of dailyBookings) {
                const bDur = (b.service?.studioSession?.duration || 45) * b.sessionCount;
                const bStart = new Date(b.bookingDate).getTime();
                const bEnd = bStart + (bDur * 60 * 1000);
                if (proposedStart < bEnd && proposedEnd > bStart) {
                    return { status: "error", message: "This time overlaps with another booking. Please choose a different time." };
                }
            }

            updateData.bookingDate = targetDate;
        }

        // Handle addon updates
        if (data.addonIds !== undefined) {
            updateData.addons = {
                set: data.addonIds.map(id => ({ id })),
            };
        }

        await prisma.booking.update({
            where: { id: bookingId },
            data: updateData,
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking updated successfully" };
    } catch (e) {
        console.error("Failed to update booking:", e);
        return { status: "error", message: "Failed to update booking" };
    }
}

