import { z } from "zod";
import { PaginatedOutput } from "./common.output";

// ─── Photo Output ─────────────────────────────────────────────────────────────

export const PhotoOutputSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  fileName: z.string(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  uploadedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  downloaded: z.boolean(),
  downloadedAt: z.iso.datetime().nullable(),
  downloadCount: z.number().int(),
  approvalStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]),
  rejectionReason: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  approvedById: z.string().nullable(),
  uploadedById: z.string(),

  /**
   * Signed URL — generated at request time, not stored in DB.
   * Short-lived (typically 15 min). Absent on list views for performance.
   */
  signedUrl: z.url().optional(),
  thumbnailSignedUrl: z.url().optional(),
});

/** Lightweight variant for gallery/list views — no signed URLs */
export const PhotoSummaryOutputSchema = PhotoOutputSchema.omit({
  signedUrl: true,
  thumbnailSignedUrl: true,
}).extend({
  thumbnailSignedUrl: z.string().url().optional(),
});

export const PhotoListOutputSchema = PaginatedOutput(PhotoSummaryOutputSchema);

/** Returned when the client requests a download link */
export const PhotoDownloadOutputSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  signedUrl: z.url(),
  expiresAt: z.iso.datetime(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhotoOutput = z.infer<typeof PhotoOutputSchema>;
export type PhotoSummaryOutput = z.infer<typeof PhotoSummaryOutputSchema>;
export type PhotoListOutput = z.infer<typeof PhotoListOutputSchema>;
export type PhotoDownloadOutput = z.infer<typeof PhotoDownloadOutputSchema>;