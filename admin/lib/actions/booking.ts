"use server";

import { db } from "../db";
import { eq, and, gte, lte, ne, inArray } from "drizzle-orm";
import { booking, member, service, studio, photo, bookingAddons } from "../schema";
import { auth } from "../auth";
import { headers } from "next/headers";
import { CreateBookingInput, PaymentPlan } from "../schemas/booking";
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

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, studioId))
        });
        if (!memberData) {
            return { status: "error", message: "Unauthorized access to studio" };
        }

        const { addonIds, ...bookingData } = data;

        // Capacity and Alternative Recommendation Logic
        const targetDate = new Date(bookingData.bookingDate);
        const start = startOfDay(targetDate);
        const end = endOfDay(targetDate);

        const targetService = await db.query.service.findFirst({
            where: eq(service.id, bookingData.serviceId),
            with: { studioSession: true }
        });

        if (!targetService) return { status: "error", message: "Service not found." };
        
        const proposedDuration = (targetService.studioSession?.duration || 45) * bookingData.sessionCount;
        const proposedStart = targetDate.getTime();
        const proposedEnd = proposedStart + (proposedDuration * 60 * 1000);

        const dailyBookings = await db.query.booking.findMany({
            where: and(
                eq(booking.studioId, studioId),
                gte(booking.bookingDate, start.toISOString()),
                lte(booking.bookingDate, end.toISOString())
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
            const currentStudio = await db.query.studio.findFirst({ where: eq(studio.id, studioId) });
            const myCity = (currentStudio?.metadata as { city?: string })?.city;

            let altMessage = `The selected time slot is fully booked or outside operating hours. Please choose another time or day.`;

            if (myCity) {
                // Fetch all other studios to find a location match with capacity
                const allStudios = await db.query.studio.findMany({ 
                    with: { 
                        bookings: { 
                            where: and(gte(booking.bookingDate, start.toISOString()), lte(booking.bookingDate, end.toISOString())), 
                            with: { service: { with: { studioSession: true } } } 
                        } 
                    } 
                });

                const alternative = allStudios.find(s => {
                    if (s.id === studioId) return false;
                    const sCity = (s.metadata as { city?: string })?.city;
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

        const [newBooking] = await db.insert(booking).values({
            id: crypto.randomUUID(),
            clientId: bookingData.clientId,
            serviceId: bookingData.serviceId,
            serviceVariantId: bookingData.serviceVariantId,
            bookingDate: new Date(bookingData.bookingDate).toISOString(),
            sessionCount: bookingData.sessionCount,
            notes: bookingData.notes,
            bookingStatus: bookingData.bookingStatus,
            paymentStatus: bookingData.paymentStatus,
            deliveryStatus: bookingData.deliveryStatus,
            totalAmount: bookingData.totalAmount?.toString() || '0',
            studioId,
            createdBy: session.user.id,
            memberId: bookingData.memberId || null,
        }).returning();

        if (addonIds && addonIds.length > 0) {
            const addonInserts = addonIds.map(id => ({
                a: newBooking.id,
                b: id.split(":")[0]
            }));
            await db.insert(bookingAddons).values(addonInserts);
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

        const b = await db.query.booking.findFirst({
            where: eq(booking.id, bookingId)
        });

        if (!b) return { status: "error", message: "Booking not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, b.studioId))
        });

        if (!memberData || !["owner", "manager", "admin", "developer"].includes(memberData.role)) {
            return { status: "error", message: "Unauthorized" };
        }

        await db.update(booking).set({ memberId: targetMemberId }).where(eq(booking.id, bookingId));

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

        const b = await db.query.booking.findFirst({
            where: eq(booking.id, bookingId),
            with: {
                service: {
                    with: { studioSession: true }
                }
            }
        });

        if (!b) return { status: "error", message: "Booking not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, b.studioId))
        });
        if (!memberData) {
            return { status: "error", message: "Unauthorized" };
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

        const dailyBookings = await db.query.booking.findMany({
            where: and(
                eq(booking.studioId, b.studioId),
                gte(booking.bookingDate, start.toISOString()),
                lte(booking.bookingDate, end.toISOString()),
                ne(booking.id, bookingId)
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

        await db.update(booking).set({ bookingDate: targetDate.toISOString() }).where(eq(booking.id, bookingId));

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
        paymentStatus?: string;
        deliveryStatus?: string;
        bookingStatus?: string;
    }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const b = await db.query.booking.findFirst({
            where: eq(booking.id, bookingId)
        });
        if (!b) return { status: "error", message: "Booking not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, b.studioId))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        await db.update(booking).set({
            notes: data.notes,
            paymentStatus: data.paymentStatus as any,
            deliveryStatus: data.deliveryStatus as any,
            bookingStatus: data.bookingStatus as any
        }).where(eq(booking.id, bookingId));

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

        const b = await db.query.booking.findFirst({ where: eq(booking.id, data.bookingId) });
        if (!b) return { status: "error", message: "Booking not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, b.studioId))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        await db.insert(photo).values({
            id: crypto.randomUUID(),
            bookingId: data.bookingId,
            r2Key: data.r2Key,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            uploadedById: session.user.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

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

        const p = await db.query.photo.findFirst({
            where: eq(photo.id, photoId),
            with: { booking: true }
        });
        if (!p) return { status: "error", message: "Photo not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, p.booking.studioId))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        await db.update(photo).set({
            approvalStatus: "APPROVED",
            approvedById: session.user.id,
            approvedAt: new Date().toISOString()
        }).where(eq(photo.id, photoId));

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

        const p = await db.query.photo.findFirst({
            where: eq(photo.id, photoId),
            with: { booking: true }
        });
        if (!p) return { status: "error", message: "Photo not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, p.booking.studioId))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        await db.update(photo).set({
            approvalStatus: "REJECTED",
            rejectionReason: reason || null
        }).where(eq(photo.id, photoId));

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

        const p = await db.query.photo.findFirst({
            where: eq(photo.id, photoId),
            with: { booking: true }
        });
        if (!p) return { status: "error", message: "Photo not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, p.booking.studioId))
        });
        if (!memberData || !["admin", "manager", "owner", "receptionist"].includes(memberData.role)) {
            return { status: "error", message: "Unauthorized to delete photo" };
        }

        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await fetch(`${baseUrl}/api/s3/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: p.r2Key }),
            });
        } catch (r2Error) {
            console.error("[R2] Failed to delete file from storage:", r2Error);
        }

        await db.delete(photo).where(eq(photo.id, photoId));

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

        const b = await db.query.booking.findFirst({
            where: eq(booking.id, bookingId),
            with: { photos: true }
        });
        if (!b) return { status: "error", message: "Booking not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, b.studioId))
        });
        if (!memberData || !["admin", "manager", "owner", "receptionist"].includes(memberData.role)) {
            return { status: "error", message: "You don't have permission to delete bookings" };
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        for (const p of b.photos) {
            try {
                await fetch(`${baseUrl}/api/s3/delete`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: p.r2Key }),
                });
            } catch (r2Error) {
                console.error(`[R2] Failed to delete photo ${p.r2Key}:`, r2Error);
            }
        }

        await db.delete(booking).where(eq(booking.id, bookingId));

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
        bookingStatus?: string;
        paymentStatus?: string;
        deliveryStatus?: string;
        addonIds?: string[];
        totalAmount?: number;
        paymentPlan?: PaymentPlan;
    }
) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const b = await db.query.booking.findFirst({
            where: eq(booking.id, bookingId),
            with: {
                service: { with: { studioSession: true } },
                bookingAddons: true
            }
        });
        if (!b) return { status: "error", message: "Booking not found" };

        const memberData = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, b.studioId))
        });
        if (!memberData) return { status: "error", message: "Unauthorized" };

        const updateData: Record<string, unknown> = {};
        if (data.clientId) updateData.clientId = data.clientId;
        if (data.serviceId) updateData.serviceId = data.serviceId;
        if (data.serviceVariantId) updateData.serviceVariantId = data.serviceVariantId;
        if (data.memberId) updateData.memberId = data.memberId;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.sessionCount !== undefined) updateData.sessionCount = Math.max(1, data.sessionCount);
        if (data.bookingStatus) updateData.bookingStatus = data.bookingStatus;
        if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
        if (data.deliveryStatus) updateData.deliveryStatus = data.deliveryStatus;
        if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
        if (data.paymentPlan) updateData.paymentPlan = data.paymentPlan;

        if (data.bookingDate) {
            const targetDate = new Date(data.bookingDate);
            const serviceForDuration = data.serviceId
                ? await db.query.service.findFirst({ where: eq(service.id, data.serviceId), with: { studioSession: true } })
                : b.service;

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

            const dailyBookings = await db.query.booking.findMany({
                where: and(
                    eq(booking.studioId, b.studioId),
                    gte(booking.bookingDate, start.toISOString()),
                    lte(booking.bookingDate, end.toISOString()),
                    ne(booking.id, bookingId)
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

            updateData.bookingDate = targetDate.toISOString();
        }

        if (Object.keys(updateData).length > 0) {
            await db.update(booking).set(updateData).where(eq(booking.id, bookingId));
        }

        if (data.addonIds !== undefined) {
            await db.delete(bookingAddons).where(eq(bookingAddons.a, bookingId));
            if (data.addonIds.length > 0) {
                const addonInserts = data.addonIds.map(id => ({
                    a: bookingId,
                    b: id.split(":")[0]
                }));
                await db.insert(bookingAddons).values(addonInserts);
            }
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Booking updated successfully" };
    } catch (e) {
        console.error("Failed to update booking:", e);
        return { status: "error", message: "Failed to update booking" };
    }
}
