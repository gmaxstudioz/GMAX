// portal/lib/schemas/photo.schema.ts
import { z } from "zod";

export const clientPhotoAccessSchema = z.object({
    bookingId: z.string().min(1, "Booking reference is required"),
    clientPhone: z.string().min(1, "Phone number is required"),
});

export const clientDownloadPhotoSchema = z.object({
    photoId: z.string().min(1),
    bookingId: z.string().min(1),
    clientPhone: z.string().min(1),
});

export type ClientPhotoAccessInput = z.infer<typeof clientPhotoAccessSchema>;
export type ClientDownloadPhotoInput = z.infer<typeof clientDownloadPhotoSchema>;