import { db } from "@/lib/db";
import { getPresignedUrl } from "@/lib/r2";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { eq, sql } from "drizzle-orm";
import { photo } from "@/lib/schema";

const os = implement(contract).$context<BaseContext>();


export const clientPhotoAccess = os.photo.clientAccess
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const booking = await db.query.booking.findFirst({
            where: (booking, { eq }) => eq(booking.id, input.bookingId),
            with: {
                client: true,
                service: true,
                photos: {
                    where: (photo, { eq }) => eq(photo.approvalStatus, "APPROVED"),
                    orderBy: (photo, { asc }) => [asc(photo.uploadedAt)],
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
            booking.photos.map(async (p) => ({
                id: p.id,
                fileName: p.fileName,
                thumbnailUrl: p.thumbnailKey
                    ? await getPresignedUrl(p.thumbnailKey, 3600)
                    : await getPresignedUrl(p.r2Key, 3600),
                approvalStatus: p.approvalStatus,
                uploadedAt: new Date(p.uploadedAt).toISOString(),
                downloadCount: p.downloadCount,
            }))
        );

        return {
            bookingId: booking.id,
            clientName: booking.client.name,
            serviceName: booking.service.name,
            bookingDate: new Date(booking.bookingDate).toISOString(),
            photos,
            totalPhotos: photos.length,
        };
    });

export const clientDownloadPhoto = os.photo.clientDownload
    .use(optionalAuthMiddleware)
    .handler(async ({ input, errors }) => {
        const booking = await db.query.booking.findFirst({
            where: (booking, { eq }) => eq(booking.id, input.bookingId),
            with: { client: true },
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

        const foundPhoto = await db.query.photo.findFirst({
            where: (photo, { and, eq }) => and(eq(photo.id, input.photoId), eq(photo.bookingId, input.bookingId)),
        });

        if (!foundPhoto || foundPhoto.approvalStatus !== "APPROVED") {
            throw errors.NOT_FOUND({
                data: { resourceType: "Photo", resourceId: input.photoId },
            });
        }

        // Track download
        await db.update(photo).set({
            downloadCount: sql`${photo.downloadCount} + 1`,
            downloadedAt: sql`CURRENT_TIMESTAMP`,
            downloaded: true,
        }).where(eq(photo.id, foundPhoto.id));

        const downloadUrl = await getPresignedUrl(foundPhoto.r2Key, 600);
        const expiresAt = new Date(Date.now() + 600 * 1000);

        return {
            downloadUrl,
            fileName: foundPhoto.fileName,
            expiresAt: expiresAt.toISOString(),
        };
    });