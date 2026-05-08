import { prisma } from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/r2";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";

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

        // Verify client identity by phone
        const phoneMatch = booking.client.phone.some(
            (p) => p.replace(/\D/g, "") === input.clientPhone.replace(/\D/g, "")
        );
        if (!phoneMatch) throw errors.FORBIDDEN({
            message: "Phone number does not match this booking.",
        });

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

        const phoneMatch = booking.client.phone.some(
            (p) => p.replace(/\D/g, "") === input.clientPhone.replace(/\D/g, "")
        );
        if (!phoneMatch) throw errors.FORBIDDEN({
            message: "Phone number does not match this booking.",
        });

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