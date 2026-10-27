"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, or, inArray, desc, gte, lte } from "drizzle-orm";
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
        if (!member) {
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

        const selectedVariant = bookingData.serviceVariantId
            ? await db.query.serviceVariant.findFirst({
                where: and(
                    eq(schema.serviceVariant.id, bookingData.serviceVariantId),
                    eq(schema.serviceVariant.serviceId, bookingData.serviceId),
                ),
                columns: { basePrice: true },
            })
            : null;
        if (bookingData.serviceVariantId && !selectedVariant) {
            return { status: "error", message: "Select a valid service variant." };
        }

        const addonVariantRefs = (addonIds ?? []).map((value) => value.split(":"));
        if (addonVariantRefs.some(([serviceId, variantId]) => !serviceId || !variantId)) {
            return { status: "error", message: "One or more selected add-ons are invalid." };
        }
        const addonServiceIds = addonVariantRefs.map(([serviceId]) => serviceId);
        if (new Set(addonServiceIds).size !== addonServiceIds.length) {
            return { status: "error", message: "A service can only be selected once as an add-on." };
        }
        const addonServices = addonServiceIds.length > 0
            ? await db.query.service.findMany({
                where: and(
                    inArray(schema.service.id, addonServiceIds),
                    eq(schema.service.studioId, studioId),
                    eq(schema.service.isAddon, true),
                ),
                columns: { id: true },
            })
            : [];
        if (addonServices.length !== addonServiceIds.length) {
            return { status: "error", message: "One or more selected add-ons are invalid." };
        }
        const addonVariantIds = addonVariantRefs.map(([, variantId]) => variantId);
        const addonVariants = addonVariantIds.length > 0
            ? await db.query.serviceVariant.findMany({
                where: inArray(schema.serviceVariant.id, addonVariantIds),
                columns: { id: true, serviceId: true, basePrice: true },
            })
            : [];
        if (addonVariants.length !== addonVariantRefs.length || addonVariantRefs.some(([serviceId, variantId]) =>
            !addonVariants.some((variant) => variant.id === variantId && variant.serviceId === serviceId)
        )) {
            return { status: "error", message: "One or more selected add-ons are invalid." };
        }

        const expectedTotalCents = Math.round(Number(selectedVariant?.basePrice ?? 0) * 100) * bookingData.sessionCount
            + addonVariants.reduce((total, variant) => total + Math.round(Number(variant.basePrice) * 100), 0);
        if (!Number.isFinite(bookingData.totalAmount) || bookingData.totalAmount <= 0) {
            return { status: "error", message: "Enter a valid booking total." };
        }
        const isCustomTotal = Math.round(bookingData.totalAmount * 100) !== expectedTotalCents;
        if (isCustomTotal && member.role === "receptionist") {
            return { status: "error", message: "Receptionists cannot set a custom booking total." };
        }
        const managerPriceApprovalRequired = isCustomTotal && member.role === "manager";

        const proposedDuration = (targetService.studioSession?.duration || 45) * bookingData.sessionCount;
        const proposedStart = targetDate.getTime();
        const proposedEnd = proposedStart + (proposedDuration * 60 * 1000);

        // Broaden the query window to catch overlapping bookings from adjacent days
        const queryStart = new Date(start.getTime() - (24 * 60 * 60 * 1000));
        const queryEnd = new Date(end.getTime() + (24 * 60 * 60 * 1000));

        const dailyBookings = await db.query.booking.findMany({
            where: and(
                eq(schema.booking.studioId, studioId),
                gte(schema.booking.bookingDate, queryStart.toISOString()),
                lte(schema.booking.bookingDate, queryEnd.toISOString())
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

        // Staff and owners are not limited by operating hours or time overlap when adding bookings
        if (hasOverlap) {
            console.log(`[createBooking] Info: Staff created booking overlapping with existing booking on ${targetDate.toISOString()}`);
        }

        const bookingId = uuidv4();
        const booking = await db.transaction(async (tx) => {
            const [createdBooking] = await tx.insert(schema.booking).values({
                id: bookingId,
                ...bookingData,
                bookingDate: bookingData.bookingDate.toISOString(),
                totalAmount: managerPriceApprovalRequired
                    ? (expectedTotalCents / 100).toFixed(2)
                    : bookingData.totalAmount.toFixed(2),
                ...(managerPriceApprovalRequired
                    ? {
                        pendingTotalAmount: bookingData.totalAmount.toFixed(2),
                        priceApprovalStatus: "PENDING_APPROVAL" as const,
                        priceChangedBy: member.id,
                    }
                    : {}),
                studioId,
                createdBy: session.user.id,
            }).returning();

            if (addonIds && addonIds.length > 0) {
                await Promise.all(
                    addonIds.map((id) => tx.insert(schema.bookingAddons).values({
                        a: bookingId,
                        b: id.split(":")[0],
                    }))
                );
            }

            if (managerPriceApprovalRequired) {
                const approvers = await tx.query.member.findMany({
                    where: and(
                        eq(schema.member.studioId, studioId),
                        inArray(schema.member.role, ["admin", "owner", "developer"]),
                    ),
                });
                await Promise.all(approvers.map((approver) => tx.insert(schema.userNotification).values({
                    id: uuidv4(),
                    userId: approver.userId,
                    title: "Price Approval Required",
                    message: `Manager ${session.user.name || "staff"} requested a custom price of ₦${bookingData.totalAmount} for a new booking.`,
                    type: "SYSTEM",
                    bookingId,
                })));
            }
            return createdBooking;
        });

        revalidatePath(`/studios`, "layout");
        return { status: "success", data: booking };
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

        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });

        if (!member || !["owner", "manager", "admin", "developer"].includes(member.role)) {
            return { status: "error", message: "Unauthorized" };
        }

        const targetMember = await db.query.member.findFirst({
            where: and(eq(schema.member.id, targetMemberId), eq(schema.member.studioId, booking.studioId))
        });
        
        if (!targetMember) {
            return { status: "error", message: "Target member not found in this studio" };
        }

        await db.update(schema.booking)
            .set({ memberId: targetMemberId })
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

        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        if (!member || member.role === "receptionist") {
            return { status: "error", message: "Unauthorized: Receptionists cannot reschedule bookings" };
        }

        const targetDate = new Date(newDate);
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

                const message = `Hi ${booking.client.name}, your booking for ${booking.service?.name} at ${booking.studio?.name} has been rescheduled to ${formattedDate}.`;
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
        if (!member) return { status: "error", message: "Unauthorized" };

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
                    message: `A new photo was uploaded for a booking by ${session.user.name || "staff"}.`,
                    type: "PHOTO_UPLOAD",
                    bookingId: booking.id
                });
                if (admin.user?.phoneNumber) {
                    try {
                        await sendSMS(admin.user.phoneNumber, `GMAX Studio: A new photo was uploaded for a booking by ${session.user.name || "staff"}. Please review it.`);
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
        if (!photo) return { status: "error", message: "Photo not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, photo.booking?.studioId!))
        });
        if (!member) return { status: "error", message: "Unauthorized" };

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
            const message = `Hi ${client.name}! Your photos from ${studioName} are ready for viewing and download. Visit your booking page to access them.`;
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
        if (!photo) return { status: "error", message: "Photo not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, photo.booking?.studioId!))
        });
        if (!member) return { status: "error", message: "Unauthorized" };

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
                message: `Your photo upload for a booking was rejected. Reason: ${reason || "No reason provided"}`,
                type: "PHOTO_REJECTED",
                bookingId: photo.bookingId
            });

            if (uploader.phoneNumber) {
                const { sendSMS } = await import("../termii");
                try {
                    await sendSMS(uploader.phoneNumber, `GMAX Studio: Your photo upload was rejected. Reason: ${reason || "Please check dashboard"}`);
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
        if (!photo) return { status: "error", message: "Photo not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, photo.booking?.studioId!))
        });
        if (!member || !["admin", "manager", "owner", "receptionist"].includes(member.role)) {
            return { status: "error", message: "Unauthorized to delete photo" };
        }

        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await fetch(`${baseUrl}/api/s3/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: photo.r2Key }),
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
        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({
            where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
        });
        if (!member || !["admin", "manager", "owner", "receptionist"].includes(member.role)) {
            return { status: "error", message: "You don't have permission to delete bookings" };
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        if (booking.photos) {
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
        if (!booking) return { status: "error", message: "Booking not found" };

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
                    message: `Manager ${session.user.name || "staff"} requested a price change to ₦${data.totalAmount} for a booking.`,
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

// ── Get Studios For Booking (Lazy Header / Global Loading) ─────────

export async function getStudiosForBooking() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) return [];

        const members = await db.query.member.findMany({
            where: eq(schema.member.userId, session.user.id),
            columns: { role: true, studioId: true }
        });

        const bookingRoles = ["owner", "admin", "manager", "receptionist", "developer"];
        const eligibleStudioIds = members
            .filter((m: { role: string }) => bookingRoles.includes(m.role))
            .map((m: { studioId: string }) => m.studioId);

        if (eligibleStudioIds.length === 0) return [];

        const studios = await db.query.studio.findMany({
            where: inArray(schema.studio.id, eligibleStudioIds),
            with: {
                clients: {
                    columns: { id: true, name: true, phone: true, email: true, image: true, type: true }
                },
                services: {
                    with: {
                        studioSession: true,
                        serviceVariants: {
                            with: { serviceDeliverables: true }
                        }
                    },
                    orderBy: (services, { asc }) => [asc(services.category), asc(services.name)],
                },
                members: {
                    with: {
                        user: {
                            columns: { id: true, name: true, email: true, image: true }
                        }
                    }
                },
                bookings: {
                    where: (b, { gte }) => gte(b.bookingDate, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
                    columns: {
                        id: true,
                        bookingDate: true,
                        sessionCount: true,
                        serviceId: true,
                        bookingStatus: true,
                        studioId: true
                    },
                    with: {
                        service: {
                            with: {
                                studioSession: {
                                    columns: { duration: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        return JSON.parse(JSON.stringify(studios, (_key, value) =>
            value !== null && typeof value === "object" && typeof value.toNumber === "function"
                ? value.toNumber()
                : value
        ));
    } catch (e) {
        console.error("Failed to get studios for booking:", e);
        return [];
    }
}
