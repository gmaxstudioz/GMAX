"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, or, inArray, desc, gte, lte, ne } from "drizzle-orm";
import { auth } from "../auth";
import { headers } from "next/headers";
import { CreateBookingInput, PaymentPlan } from "../schemas/booking";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

import { startOfDay, endOfDay } from "date-fns";

export async function createBooking(data: CreateBookingInput, studioId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return { status: "error", message: "Unauthorized" };
        }

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, studioId))
        });
        if (!memberData) {
            return { status: "error", message: "Unauthorized access to studio" };
        }

        const allowedRoles = ["owner", "admin", "manager", "receptionist", "developer"];
        if (!allowedRoles.includes(member.role)) {
            return { status: "error", message: "Unauthorized: You do not have permission to create bookings" };
        }

        const { addonIds, ...bookingData } = data;

        // Capacity and Alternative Recommendation Logic
        const targetDate = new Date(bookingData.bookingDate);
        const start = startOfDay(targetDate);
        const end = endOfDay(targetDate);

        const targetService = await db.query.service.findFirst({
            where: eq(schema.service.id, bookingData.serviceId),
            with: { studioSession: true }
        });

        if (!targetService) return { status: "error", message: "Service not found." };
        
        const proposedDuration = (targetService.studioSession?.duration || 45) * bookingData.sessionCount;
        const proposedStart = targetDate.getTime();
        const proposedEnd = proposedStart + (proposedDuration * 60 * 1000);

        const dailyBookings = await db.query.booking.findMany({
            where: and(
                eq(schema.booking.studioId, studioId),
                gte(schema.booking.bookingDate, start.toISOString()),
                lte(schema.booking.bookingDate, end.toISOString())
            ),
            with: { service: { with: { studioSession: true } } }
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
            const currentStudio = await db.query.studio.findFirst({ where: eq(schema.studio.id, studioId) });
            const myCity = (currentStudio?.metadata as { city?: string })?.city;

            let altMessage = `The selected time slot is fully booked or outside operating hours. Please choose another time or day.`;

            if (myCity) {
                // Fetch all other studios to find a location match with capacity
                const allStudios = await db.query.studio.findMany({ 
                    with: { 
                        bookings: { 
                            where: (bookings, { and, gte, lte }) => and(
                                gte(bookings.bookingDate, start.toISOString()),
                                lte(bookings.bookingDate, end.toISOString())
                            ),
                            with: { service: { with: { studioSession: true } } } 
                        } 
                    } 
                });

                const alternative = allStudios.find((s: any) => {
                    if (s.id === studioId) return false;
                    const sCity = (s.metadata as { city?: string })?.city;
                    if (!sCity || sCity.toLowerCase() !== myCity.toLowerCase()) return false;
                    
                    const altOverlaps = s.bookings.some((b: any) => {
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

        const bookingId = uuidv4();
        const [booking] = await db.insert(schema.booking).values({
            id: bookingId,
            ...bookingData,
            bookingDate: bookingData.bookingDate.toISOString(),
            totalAmount: bookingData.totalAmount.toString(),
            studioId,
            createdBy: session.user.id,
        }).returning();

        if (addonIds && addonIds.length > 0) {
            await Promise.all(
                addonIds.map(async (id) => {
                    const addonId = id.split(":")[0];
                    await db.insert(schema.bookingAddons).values({
                        a: bookingId,
                        b: addonId
                    });
                })
            );
        }

        revalidatePath(`/studios`, "layout");
        return { status: "success", data: newBooking };
    } catch (error) {
        console.error("Failed to create booking:", error);
        return { status: "error", message: "Failed to create booking" };
    }
}

export async function reassignBooking(bookingId: string, targetMemberId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return { status: "error", message: "Unauthorized" };
        }

        const booking = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId)
        });

        if (!b) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });

        if (!memberData || !["owner", "manager", "admin", "developer"].includes(memberData.role)) {
            return { status: "error", message: "Unauthorized" };
        }

        await db.update(schema.booking)
            .set({ memberId })
            .where(eq(schema.booking.id, bookingId));

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

        const booking = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId),
            with: {
                client: true,
                studio: true,
                service: {
                    with: { studioSession: true }
                }
            }
        });

        if (!b) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        if (!member || member.role === "receptionist") {
            return { status: "error", message: "Unauthorized: Receptionists cannot reschedule bookings" };
        }

        const targetDate = new Date(newDate);
        const start = startOfDay(targetDate);
        const end = endOfDay(targetDate);

        const duration = (b.service?.studioSession?.duration || 45) * b.sessionCount;
        const proposedStart = targetDate.getTime();
        const proposedEnd = proposedStart + (duration * 60 * 1000);

        const openTime = start.getTime() + (8 * 60 * 60 * 1000);
        const closeTime = start.getTime() + (20 * 60 * 60 * 1000);

        if (proposedStart < openTime || proposedEnd > closeTime) {
            return { status: "error", message: "The selected time is outside operating hours (8am - 8pm)." };
        }

        // Check for overlaps with other bookings (exclude this booking)
        const dailyBookings = await db.query.booking.findMany({
            where: and(
                eq(schema.booking.studioId, booking.studioId),
                gte(schema.booking.bookingDate, start.toISOString()),
                lte(schema.booking.bookingDate, end.toISOString()),
                ne(schema.booking.id, bookingId)
            ),
            with: { service: { with: { studioSession: true } } }
        });

        for (const other of dailyBookings) {
            const bDur = (other.service?.studioSession?.duration || 45) * other.sessionCount;
            const bStart = new Date(other.bookingDate).getTime();
            const bEnd = bStart + (bDur * 60 * 1000);

            if (proposedStart < bEnd && proposedEnd > bStart) {
                return { status: "error", message: "This time overlaps with another booking. Please choose a different time." };
            }
        }

        await db.update(schema.booking)
            .set({ bookingDate: targetDate.toISOString() })
            .where(eq(schema.booking.id, bookingId));

        if (booking.client?.phone) {
            try {
                const { sendSMS } = await import("../termii");
                const formattedDate = new Intl.DateTimeFormat("en-NG", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                }).format(targetDate);

                const message = `Hi \${booking.client.name}, your booking for \${booking.service?.name} at \${booking.studio?.name} has been rescheduled to \${formattedDate}.`;
                await sendSMS(booking.client.phone, message);

                await db.insert(schema.notification).values({
                    id: uuidv4(),
                    clientPhone: booking.client.phone,
                    clientName: booking.client.name,
                    type: "BOOKING_CONFIRMATION",
                    message: message,
                    channel: ["SMS"],
                    status: "SENT",
                    bookingId: bookingId
                });
            } catch (smsError) {
                console.error("Failed to send reschedule SMS:", smsError);
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking rescheduled successfully" };
    } catch (e) {
        console.error("Failed to reschedule booking:", e);
        return { status: "error", message: "Failed to reschedule booking" };
    }
}

export async function updateBookingInfo(
    bookingId: string,
    data: {
        notes?: string;
        sessionCount?: number;
        bookingStatus?: any;
        paymentStatus?: any;
        deliveryStatus?: any;
    }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, bookingId) });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        const disallowedRoles = ["receptionist", "photographer", "videographer"];
        if (!member || disallowedRoles.includes(member.role)) {
            return { status: "error", message: "Unauthorized: You do not have permission to update bookings" };
        }

        const updateData: Record<string, any> = {};
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.sessionCount !== undefined) updateData.sessionCount = Math.max(1, data.sessionCount);
        if (data.bookingStatus) updateData.bookingStatus = data.bookingStatus;
        if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
        if (data.deliveryStatus) updateData.deliveryStatus = data.deliveryStatus;

        await db.update(schema.booking)
            .set(updateData)
            .where(eq(schema.booking.id, bookingId));

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking updated successfully" };
    } catch (e) {
        console.error("Failed to update booking info:", e);
        return { status: "error", message: "Failed to update booking" };
    }
}

export async function uploadBookingPhoto(data: {
    bookingId: string;
    fileName: string;
    r2Key: string;
    fileSize: number;
    mimeType: string;
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, data.bookingId) });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        // Admin, manager, owner uploads auto-approve
        const autoApproveRoles = ["admin", "manager", "owner"];
        const isAutoApproved = autoApproveRoles.includes(member.role);

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const [photo] = await db.insert(schema.photo).values({
            id: uuidv4(),
            bookingId: data.bookingId,
            r2Key: data.r2Key,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            expiresAt,
            uploadedById: session.user.id,
            approvalStatus: isAutoApproved ? "APPROVED" : "PENDING_REVIEW",
            approvedAt: isAutoApproved ? new Date().toISOString() : undefined,
            approvedById: isAutoApproved ? session.user.id : undefined,
        }).returning();

        if (["photographer", "videographer"].includes(member.role)) {
            const admins = await db.query.member.findMany({
                where: and(eq(schema.member.studioId, booking.studioId), inArray(schema.member.role, ["admin", "owner", "manager"])),
                with: { user: true }
            });

            const { sendSMS } = await import("../termii");
            for (const admin of admins) {
                await db.insert(schema.userNotification).values({
                    id: uuidv4(),
                    userId: admin.userId,
                    title: "New Photo Uploaded",
                    message: `A new photo was uploaded for a booking by \${session.user.name || "staff"}.`,
                    type: "PHOTO_UPLOAD",
                    bookingId: booking.id
                });
                if (admin.user?.phoneNumber) {
                    try {
                        await sendSMS(admin.user.phoneNumber, `GMAX Studio: A new photo was uploaded for a booking by \${session.user.name || "staff"}. Please review it.`);
                    } catch (err) {
                        console.error("SMS failed", err);
                    }
                }
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success" };
    } catch (e) {
        console.error("Failed to upload photo:", e);
        return { status: "error", message: "Failed to save photo record" };
    }
}

export async function approvePhoto(photoId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const photo = await db.query.photo.findFirst({
            where: eq(schema.photo.id, photoId),
            with: { booking: { with: { client: true, studio: true } } },
        });
        if (!p) return { status: "error", message: "Photo not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, photo.booking?.studioId!))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        await db.update(schema.photo)
            .set({
                approvalStatus: "APPROVED",
                approvedAt: new Date().toISOString(),
                approvedById: session.user.id,
            })
            .where(eq(schema.photo.id, photoId));

        // Notify client via Termii
        const client = photo.booking?.client;
        const studioName = photo.booking?.studio?.name || "Studio";
        if (client?.phone?.length > 0) {
            const { sendSMS } = await import("../termii");
            const message = `Hi \${client.name}! Your photos from \${studioName} are ready for viewing and download. Visit your booking page to access them.`;
            try {
                await sendSMS(client.phone, message);
            } catch (err) {
                console.error("[Termii] Failed to notify client:", err);
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Photo approved" };
    } catch (e) {
        return { status: "error", message: "Failed to approve photo" };
    }
}

export async function rejectPhoto(photoId: string, reason?: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const photo = await db.query.photo.findFirst({
            where: eq(schema.photo.id, photoId),
            with: { booking: true },
        });
        if (!p) return { status: "error", message: "Photo not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, photo.booking?.studioId!))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        await db.update(schema.photo)
            .set({
                approvalStatus: "REJECTED",
                rejectionReason: reason || undefined,
            })
            .where(eq(schema.photo.id, photoId));

        const uploader = await db.query.user.findFirst({ where: eq(schema.user.id, photo.uploadedById) });
        if (uploader) {
            await db.insert(schema.userNotification).values({
                id: uuidv4(),
                userId: uploader.id,
                title: "Photo Rejected",
                message: `Your photo upload for a booking was rejected. Reason: \${reason || "No reason provided"}`,
                type: "PHOTO_REJECTED",
                bookingId: photo.bookingId
            });

            if (uploader.phoneNumber) {
                const { sendSMS } = await import("../termii");
                try {
                    await sendSMS(uploader.phoneNumber, `GMAX Studio: Your photo upload was rejected. Reason: \${reason || "Please check dashboard"}`);
                } catch(e){
                    console.error("SMS failed", e);
                }
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Photo rejected" };
    } catch (e) {
        return { status: "error", message: "Failed to reject photo" };
    }
}

export async function deletePhoto(photoId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const photo = await db.query.photo.findFirst({
            where: eq(schema.photo.id, photoId),
            with: { booking: true },
        });
        if (!p) return { status: "error", message: "Photo not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, photo.booking?.studioId!))
        });
        if (!memberData || !["admin", "manager", "owner", "receptionist"].includes(memberData.role)) {
            return { status: "error", message: "Unauthorized to delete photo" };
        }

        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await fetch(`\${baseUrl}/api/s3/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: p.r2Key }),
            });
        } catch (r2Error) {
            console.error("[R2] Failed to delete file from storage:", r2Error);
        }

        // Delete from database
        await db.delete(schema.photo).where(eq(schema.photo.id, photoId));

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Photo deleted successfully" };
    } catch (e) {
        console.error("Failed to delete photo:", e);
        return { status: "error", message: "Failed to delete photo" };
    }
}

export async function deleteBooking(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId),
            with: { photos: true },
        });
        if (!b) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        if (!memberData || !["admin", "manager", "owner", "receptionist"].includes(memberData.role)) {
            return { status: "error", message: "You don't have permission to delete bookings" };
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        if (booking.photos) {
            for (const photo of booking.photos) {
                try {
                    await fetch(`\${baseUrl}/api/s3/delete`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: photo.r2Key }),
                    });
                } catch (r2Error) {
                    console.error(`[R2] Failed to delete photo \${photo.r2Key}:`, r2Error);
                }
            }
        }

        // Cascade delete handles payments, photos, addon relations
        await db.delete(schema.booking).where(eq(schema.booking.id, bookingId));

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking deleted successfully" };
    } catch (e) {
        console.error("Failed to delete booking:", e);
        return { status: "error", message: "Failed to delete booking" };
    }
}

export async function updateBookingFull(
    bookingId: string,
    data: {
        clientId?: string;
        serviceId?: string;
        serviceVariantId?: string;
        memberId?: string;
        bookingDate?: string;
        sessionCount?: number;
        notes?: string;
        bookingStatus?: any;
        paymentStatus?: any;
        deliveryStatus?: any;
        addonIds?: string[];
        totalAmount?: number;
        paymentPlan?: PaymentPlan;
        extraPicturesCount?: number;
    }
) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId),
            with: {
                service: { with: { studioSession: true } }
            },
        });
        if (!b) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        const disallowedRoles = ["receptionist", "photographer", "videographer"];
        if (!member || disallowedRoles.includes(member.role)) {
            return { status: "error", message: "Unauthorized: You do not have permission to update bookings" };
        }

        // Build update data
        const updateData: Record<string, any> = {};

        if (data.clientId) updateData.clientId = data.clientId;
        if (data.serviceId) updateData.serviceId = data.serviceId;
        if (data.serviceVariantId) updateData.serviceVariantId = data.serviceVariantId;
        if (data.memberId) updateData.memberId = data.memberId;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.sessionCount !== undefined) updateData.sessionCount = Math.max(1, data.sessionCount);
        if (data.extraPicturesCount !== undefined) updateData.extraPicturesCount = Math.max(0, data.extraPicturesCount);
        if (data.bookingStatus) updateData.bookingStatus = data.bookingStatus;
        if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
        if (data.deliveryStatus) updateData.deliveryStatus = data.deliveryStatus;
        
        let priceChangeNotificationNeeded = false;
        if (data.totalAmount !== undefined && data.totalAmount !== Number(booking.totalAmount)) {
            if (member.role === "manager") {
                updateData.pendingTotalAmount = data.totalAmount.toString();
                updateData.priceApprovalStatus = "PENDING_APPROVAL";
                updateData.priceChangedBy = member.id;
                priceChangeNotificationNeeded = true;
            } else {
                updateData.totalAmount = data.totalAmount.toString();
                updateData.priceApprovalStatus = "APPROVED";
                updateData.pendingTotalAmount = null;
            }
        }
        
        if (data.paymentPlan) updateData.paymentPlan = data.paymentPlan;

        if (data.bookingDate) {
            const targetDate = new Date(data.bookingDate);
            const serviceForDuration = data.serviceId
                ? await db.query.service.findFirst({ where: eq(schema.service.id, data.serviceId), with: { studioSession: true } })
                : booking.service;

            const sessionCount = data.sessionCount ?? b.sessionCount;
            const duration = (serviceForDuration?.studioSession?.duration || 45) * sessionCount;
            const proposedStart = targetDate.getTime();
            const proposedEnd = proposedStart + (duration * 60 * 1000);

            const start = startOfDay(targetDate);
            const end = endOfDay(targetDate);

            const openTime = start.getTime() + (8 * 60 * 60 * 1000);
            const closeTime = start.getTime() + (20 * 60 * 60 * 1000);
            if (proposedStart < openTime || proposedEnd > closeTime) {
                return { status: "error", message: "The selected time is outside operating hours (8am - 8pm)." };
            }

            // Check overlaps
            const dailyBookings = await db.query.booking.findMany({
                where: and(
                    eq(schema.booking.studioId, booking.studioId),
                    gte(schema.booking.bookingDate, start.toISOString()),
                    lte(schema.booking.bookingDate, end.toISOString()),
                    ne(schema.booking.id, bookingId)
                ),
                with: { service: { with: { studioSession: true } } },
            });

            for (const other of dailyBookings) {
                const bDur = (other.service?.studioSession?.duration || 45) * other.sessionCount;
                const bStart = new Date(other.bookingDate).getTime();
                const bEnd = bStart + (bDur * 60 * 1000);
                if (proposedStart < bEnd && proposedEnd > bStart) {
                    return { status: "error", message: "This time overlaps with another booking. Please choose a different time." };
                }
            }

            updateData.bookingDate = targetDate.toISOString();
        }

        await db.update(schema.booking)
            .set(updateData)
            .where(eq(schema.booking.id, bookingId));

        // Handle addon updates
        if (data.addonIds !== undefined) {
            await db.delete(schema.bookingAddons).where(eq(schema.bookingAddons.a, bookingId));
            if (data.addonIds.length > 0) {
                await Promise.all(
                    data.addonIds.map(async (id) => {
                        const addonId = id.split(":")[0];
                        await db.insert(schema.bookingAddons).values({
                            a: bookingId,
                            b: addonId
                        });
                    })
                );
            }
        }

        if (priceChangeNotificationNeeded) {
            const admins = await db.query.member.findMany({
                where: and(eq(schema.member.studioId, booking.studioId), inArray(schema.member.role, ["admin", "owner", "developer"])),
                with: { user: true }
            });
            for (const admin of admins) {
                await db.insert(schema.userNotification).values({
                    id: uuidv4(),
                    userId: admin.userId,
                    title: "Price Approval Required",
                    message: `Manager \${session.user.name || "staff"} requested a price change to ₦\${data.totalAmount} for a booking.`,
                    type: "SYSTEM",
                    bookingId: booking.id
                });
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking updated successfully" };
    } catch (e) {
        console.error("Failed to update booking:", e);
        return { status: "error", message: "Failed to update booking" };
    }
}

// ── Mark Task Completed (Staff) ────────────────────────────────────

export async function markTaskCompleted(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId)
        });
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        
        if (!member) {
            return { status: "error", message: "Unauthorized: You do not belong to this studio" };
        }

        // Only allow if they are assigned to this booking OR they are an admin/manager
        const isAssigned = booking.memberId === member.id;
        const isAdminOrManager = ["owner", "admin", "manager", "developer"].includes(member.role);

        if (!isAssigned && !isAdminOrManager) {
            return { status: "error", message: "Unauthorized: You can only complete tasks assigned to you" };
        }

        await db.update(schema.booking)
            .set({ bookingStatus: "COMPLETED" })
            .where(eq(schema.booking.id, bookingId));

        revalidatePath("/studios", "layout");
        revalidatePath("/my-tasks");
        return { status: "success", message: "Task marked as completed" };
    } catch (e) {
        console.error("Failed to mark task completed:", e);
        return { status: "error", message: "Internal server error" };
    }
}
