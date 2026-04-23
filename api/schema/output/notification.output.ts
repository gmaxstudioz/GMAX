import { z } from "zod";
import { PaginatedOutput } from "./common.output";

// ─── Notification Output ──────────────────────────────────────────────────────

export const NotificationOutputSchema = z.object({
  id: z.uuid(),
  clientPhone: z.string(),
  clientEmail: z.email(),
  clientName: z.string(),
  type: z.enum([
    "BOOKING_CONFIRMATION",
    "PAYMENT_REMINDER",
    "PHOTOS_READY",
    "PHOTOS_EXPIRING",
    "STAFF_INVITATION",
  ]),
  message: z.string(),
  channel: z.array(z.enum(["SMS", "WHATSAPP", "EMAIL"])),
  status: z.enum(["PENDING", "SENT", "FAILED"]),
  sentAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  errorMessage: z.string().nullable(),
  bookingId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export const NotificationListOutputSchema = PaginatedOutput(NotificationOutputSchema);

/** Summary of dispatch results after a bulk send (e.g. expiry reminders) */
export const NotificationDispatchOutputSchema = z.object({
  sent: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
  failures: z.array(
    z.object({
      notificationId: z.uuid(),
      channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]),
      reason: z.string(),
    })
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationOutput = z.infer<typeof NotificationOutputSchema>;
export type NotificationListOutput = z.infer<typeof NotificationListOutputSchema>;
export type NotificationDispatchOutput = z.infer<typeof NotificationDispatchOutputSchema>;