import { baseContract } from "./errors";
import {
    UploadBookingPhotoSchema,
    ApprovePhotoSchema,
    RejectPhotoSchema,
    DeletePhotoSchema,
    ClientPhotoAccessSchema,
    ClientPhotoAccessOutputSchema,
    ClientDownloadPhotoSchema,
    ClientDownloadOutputSchema,
} from "@/schema/photo.schema";
import {
    PhotoOutputSchema,
    PhotoListOutputSchema,
    PhotoDownloadOutputSchema,
} from "@/schema/output/photo.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { IdParamSchema, StudioScopedQuerySchema } from "@/schema/common.schema";
import z from "zod";

// ─── Photo Contracts ──────────────────────────────────────────────────────────

export const uploadPhotoContract = baseContract
    .input(UploadBookingPhotoSchema)
    .output(PhotoOutputSchema);

export const approvePhotoContract = baseContract
    .input(ApprovePhotoSchema)
    .output(PhotoOutputSchema);

export const rejectPhotoContract = baseContract
    .input(RejectPhotoSchema)
    .output(PhotoOutputSchema);

export const deletePhotoContract = baseContract
    .input(DeletePhotoSchema)
    .output(DeleteOutputSchema);

export const getPhotoContract = baseContract
    .input(IdParamSchema)
    .output(PhotoOutputSchema);

export const getAllPhotosContract = baseContract
    .input(StudioScopedQuerySchema.extend({
        bookingId: z.string().optional(),
        approvalStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
    }))
    .output(PhotoListOutputSchema);

/** Get a signed download URL for a specific photo */
export const downloadPhotoContract = baseContract
    .route({
        method: "GET",
        path: "/photos/{photoId}/download",
        successStatus: 200,
        summary: "Download a photo",
        description: "Download a photo",
        tags: ["Photos"], 
    })
    .input(IdParamSchema)
    .output(PhotoDownloadOutputSchema);

export const ClientPhotoAccessContract = baseContract
    .route({
        method: "POST",
        path: "/photos/{bookingId}/client-access",
        successStatus: 200,
        summary: "Client access to photos",
        description: "Client access to photos",
        tags: ["Photos"], 
    })
    .input(ClientPhotoAccessSchema)
    .output(ClientPhotoAccessOutputSchema);

export const ClientDownloadPhotoContract = baseContract
    .route({
        method: "POST",
        path: "/photos/{bookingId}/client-download",
        successStatus: 200,
        summary: "Client download of photos",
        description: "Client download of photos",
        tags: ["Photos"], 
    })
    .input(ClientDownloadPhotoSchema)
    .output(ClientDownloadOutputSchema);

/** Bulk approve multiple photos at once */
export const bulkApprovePhotosContract = baseContract
    .input(z.object({
        photoIds: z.array(z.string().min(1)).min(1, "At least one photo ID is required"),
    }))
    .output(z.object({
        approved: z.number().int(),
        failed: z.number().int(),
    }));
