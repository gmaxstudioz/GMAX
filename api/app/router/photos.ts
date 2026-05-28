import { prisma } from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/r2";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { sendReviewNotificationEmail } from "@/lib/termii";

const os = implement(contract).$context<BaseContext>();


export const clientPhotoAccess = os.photo.clientAccess
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const booking = await prisma.booking.findUnique({
            where: { id: input.bookingId },
            include: {
                client: true,
                service: true,
                photos: {
                    where: { approvalStatus: "APPROVED" },
                    orderBy: { uploadedAt: "asc" },
                },
            },
        });

        if (!booking) throw errors.NOT_FOUND({
            data: { resourceType: "Booking", resourceId: input.bookingId },
        });

        // Verify client identity by access code
        if (!booking.accessCode || booking.accessCode !== input.accessCode) {
            throw errors.FORBIDDEN({
                message: "Invalid access code.",
            });
        }

        // Generate presigned thumbnail URLs for all approved photos
        const photos = await Promise.all(
            booking.photos.map(async (photo) => ({
                id: photo.id,
                fileName: photo.fileName,
                thumbnailUrl: photo.thumbnailKey
                    ? await getPresignedUrl(photo.thumbnailKey, 3600)
                    : await getPresignedUrl(photo.r2Key, 3600),
                approvalStatus: photo.approvalStatus,
                uploadedAt: photo.uploadedAt.toISOString(),
                downloadCount: photo.downloadCount,
            }))
        );

        return {
            bookingId: booking.id,
            clientName: booking.client.name,
            serviceName: booking.service.name,
            bookingDate: booking.bookingDate.toISOString(),
            deliveredAt: booking.deliveredAt?.toISOString() ?? null,
            birthDate: booking.client.birthDate?.toISOString() ?? null,
            weddingDate: booking.client.weddingDate?.toISOString() ?? null,
            photos,
            totalPhotos: photos.length,
        };
    });

export const clientDownloadPhoto = os.photo.clientDownload
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const booking = await prisma.booking.findUnique({
            where: { id: input.bookingId },
            include: { client: true },
        });

        if (!booking) throw errors.NOT_FOUND({
            data: { resourceType: "Booking", resourceId: input.bookingId },
        });

        // Verify client identity by access code
        if (!booking.accessCode || booking.accessCode !== input.accessCode) {
            throw errors.FORBIDDEN({
                message: "Invalid access code.",
            });
        }

        const photo = await prisma.photo.findUnique({
            where: { id: input.photoId, bookingId: input.bookingId },
        });

        if (!photo || photo.approvalStatus !== "APPROVED") {
            throw errors.NOT_FOUND({
                data: { resourceType: "Photo", resourceId: input.photoId },
            });
        }

        // Track download
        await prisma.photo.update({
            where: { id: photo.id },
            data: {
                downloadCount: { increment: 1 },
                downloadedAt: new Date(),
                downloaded: true,
            },
        });

        const downloadUrl = await getPresignedUrl(photo.r2Key, 600);
        const expiresAt = new Date(Date.now() + 600 * 1000);

        return {
            downloadUrl,
            fileName: photo.fileName,
            expiresAt: expiresAt.toISOString(),
        };
    });

export const clientSubmitReview = os.photo.clientSubmitReview
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const booking = await prisma.booking.findUnique({
            where: { id: input.bookingId },
            include: {
                client: true,
                service: true,
                studio: {
                    include: { members: { include: { user: true } } },
                },
                member: { include: { user: true } },
            },
        });

        if (!booking) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId } });
        if (!booking.accessCode || booking.accessCode !== input.accessCode) {
            throw errors.FORBIDDEN({ message: "Invalid access code." });
        }

        // Save review/revision request to the database
        await prisma.revisionRequest.create({
            data: {
                bookingId: booking.id,
                description: input.description,
            },
        });

        // Try to send email and in-app notifications to manager/admin and the assigned staff
        const dashboardLink = `${process.env.PORTAL_URL || "http://localhost:3000"}/studios/${booking.studio.slug}/bookings/detail/${booking.id}`;
        const sentEmails = new Set<string>();
        const notifiedUserIds = new Set<string>();

        const sendTo = async (email: string, name: string, userId: string) => {
            if (email && !sentEmails.has(email)) {
                sentEmails.add(email);
                try {
                    await sendReviewNotificationEmail({
                        email,
                        recipientName: name,
                        clientName: booking.client.name,
                        serviceName: booking.service.name,
                        reviewContent: input.description,
                        dashboardLink,
                    });
                } catch (err) {
                    console.error(`Failed to send review notification to ${email}:`, err);
                }
            }

            if (userId && !notifiedUserIds.has(userId)) {
                notifiedUserIds.add(userId);
                try {
                    await prisma.userNotification.create({
                        data: {
                            userId,
                            title: "New Revision Request",
                            message: `Client ${booking.client.name} requested a revision for their photos.`,
                            type: "REVISION_REQUEST",
                            bookingId: booking.id,
                        }
                    });
                } catch (err) {
                    console.error(`Failed to create in-app notification for ${userId}:`, err);
                }
            }
        };

        // Notify assigned staff
        if (booking.member?.userId) {
            await sendTo(booking.member.user?.email || "", booking.member.user?.name || "Staff", booking.member.userId);
        }

        // Notify admins/owners/managers
        for (const m of booking.studio.members) {
            if (m.role === "admin" || m.role === "owner" || m.role === "manager") {
                await sendTo(m.user?.email || "", m.user?.name || "Admin", m.userId);
            }
        }

        return { success: true, message: "Review submitted successfully" };
    });

export const clientUpdateDates = os.photo.clientUpdateDates
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const booking = await prisma.booking.findUnique({
            where: { id: input.bookingId },
            include: { client: true },
        });

        if (!booking) throw errors.NOT_FOUND({ data: { resourceType: "Booking", resourceId: input.bookingId } });
        if (!booking.accessCode || booking.accessCode !== input.accessCode) {
            throw errors.FORBIDDEN({ message: "Invalid access code." });
        }

        const dataToUpdate: Record<string, unknown> = {};
        if (input.eventDate && input.eventType) {
            if (input.eventType === "birthday") dataToUpdate.birthDate = new Date(input.eventDate);
            if (input.eventType === "wedding") dataToUpdate.weddingDate = new Date(input.eventDate);
        }

        if (Object.keys(dataToUpdate).length > 0) {
            await prisma.client.update({
                where: { id: booking.clientId },
                data: dataToUpdate,
            });
        }

        return { success: true, message: "Dates updated successfully" };
    });