import { baseContract } from "./errors";
import {
    UploadBookingPhotoSchema,
    ApprovePhotoSchema,
    RejectPhotoSchema,
    DeletePhotoSchema,
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
    .input(IdParamSchema)
    .output(PhotoDownloadOutputSchema);

/** Bulk approve multiple photos at once */
export const bulkApprovePhotosContract = baseContract
    .input(z.object({
        photoIds: z.array(z.string().min(1)).min(1, "At least one photo ID is required"),
    }))
    .output(z.object({
        approved: z.number().int(),
        failed: z.number().int(),
    }));
