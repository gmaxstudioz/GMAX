import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PhotoApprovalStatusEnum = z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]);

export type PhotoApprovalStatus = z.infer<typeof PhotoApprovalStatusEnum>;

// ─── Allowed MIME types ───────────────────────────────────────────────────────

export const PhotoMimeTypeEnum = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type PhotoMimeType = z.infer<typeof PhotoMimeTypeEnum>;

// ─── Photo ────────────────────────────────────────────────────────────────────

export const PhotoSchema = z.object({
  id: z.string().cuid(),
  bookingId: z.string(),

  // R2 Storage
  r2Key: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: PhotoMimeTypeEnum,
  thumbnailKey: z.string().nullable().optional(),

  uploadedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),

  downloaded: z.boolean().default(false),
  downloadedAt: z.coerce.date().nullable().optional(),
  downloadCount: z.number().int().nonnegative().default(0),

  // Approval workflow
  approvalStatus: PhotoApprovalStatusEnum.default("PENDING_REVIEW"),
  rejectionReason: z.string().nullable().optional(),
  approvedAt: z.coerce.date().nullable().optional(),
  approvedById: z.string().nullable().optional(),

  uploadedById: z.string(),
});

export const CreatePhotoSchema = PhotoSchema.omit({
  id: true,
  uploadedAt: true,
  downloaded: true,
  downloadedAt: true,
  downloadCount: true,
  approvalStatus: true,
  approvedAt: true,
  approvedById: true,
}).extend({
  approvalStatus: PhotoApprovalStatusEnum.default("PENDING_REVIEW"),
});

export const UpdatePhotoSchema = CreatePhotoSchema.partial();

/** Approve or reject a photo */
export const PhotoReviewSchema = z.discriminatedUnion("approvalStatus", [
  z.object({
    approvalStatus: z.literal("APPROVED"),
    approvedById: z.string(),
  }),
  z.object({
    approvalStatus: z.literal("REJECTED"),
    rejectionReason: z.string().min(1, "Rejection reason is required"),
    approvedById: z.string(),
  }),
]);

// Upload Booking Photo Schema
export const UploadBookingPhotoSchema = z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
    r2Key: z.string().min(1, "R2 key is required"),
    fileName: z.string().min(1, "File name is required"),
    fileSize: z.number().min(1, "File size is required"),
    mimeType: z.string().min(1, "Mime type is required"),
});

// Approve Photo Schema
export const ApprovePhotoSchema = z.object({
  photoId: z.string().min(1, "Photo ID is required"),
});

// Reject Photo Schema
export const RejectPhotoSchema = z.object({
  photoId: z.string().min(1, "Photo ID is required"),
  reason: z.string().optional(),
});

// Delete Photo Schema
export const DeletePhotoSchema = z.object({
  photoId: z.string().min(1, "Photo ID is required"),
});

export const ClientPhotoAccessSchema = z.object({
    bookingId: z.string().min(1, "Booking reference is required"),
    clientPhone: z.string().min(1, "Phone number is required"),
});

export const ClientPhotoAccessOutputSchema = z.object({
    bookingId: z.string(),
    clientName: z.string(),
    serviceName: z.string(),
    bookingDate: z.iso.datetime(),
    photos: z.array(z.object({
        id: z.string(),
        fileName: z.string(),
        thumbnailUrl: z.string(),
        approvalStatus: z.string(),
        uploadedAt: z.iso.datetime(),
        downloadCount: z.number(),
    })),
    totalPhotos: z.number(),
});

export const ClientDownloadPhotoSchema = z.object({
    photoId: z.string().min(1),
    bookingId: z.string().min(1),
    clientPhone: z.string().min(1),
});

export const ClientDownloadOutputSchema = z.object({
    downloadUrl: z.string(),
    fileName: z.string(),
    expiresAt: z.iso.datetime(),
});


export type Photo = z.infer<typeof PhotoSchema>;
export type CreatePhotoType = z.infer<typeof CreatePhotoSchema>;
export type UpdatePhotoType = z.infer<typeof UpdatePhotoSchema>;
export type PhotoReviewType = z.infer<typeof PhotoReviewSchema>;
export type UploadBookingPhotoInput = z.infer<typeof UploadBookingPhotoSchema>;
export type ApprovePhotoInput = z.infer<typeof ApprovePhotoSchema>;
export type RejectPhotoInput = z.infer<typeof RejectPhotoSchema>;
export type DeletePhotoInput = z.infer<typeof DeletePhotoSchema>;