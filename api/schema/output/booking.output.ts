import { z } from "zod";
import { PaginatedOutput } from "./common.output";
import { ServiceOptionOutputSchema } from "./service.output";
import { MemberOutputSchema } from "./studio.output";

// ─── Client Output ────────────────────────────────────────────────────────────

export const ClientOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.array(z.string()),
  email: z.email().nullable(),
  address: z.string().nullable(),
  image: z.url().nullable(),
  notes: z.string().nullable(),
  type: z.string(),
  studioId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Lightweight variant — for embedding inside Booking without nesting bloat */
export const ClientSummaryOutputSchema = ClientOutputSchema.pick({
  id: true,
  name: true,
  phone: true,
  email: true,
  type: true,
});

export const ClientListOutputSchema = PaginatedOutput(ClientOutputSchema);

// ─── Payment Output (partial — avoid circular import with payment.output.ts) ──

/**
 * Inline payment summary embedded in Booking.
 * The full PaymentOutputSchema lives in payment.output.ts.
 */
const InlinePaymentSchema = z.object({
  id: z.string(),
  amount: z.string(),
  method: z.enum(["CASH", "TRANSFER", "POS"]),
  status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]),
  receiptNumber: z.string(),
  paymentDate: z.iso.datetime(),
});

// ─── Photo Output (partial — avoid circular import with photo.output.ts) ──────

const InlinePhotoSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  approvalStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]),
  uploadedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  downloadCount: z.number().int(),
});

// ─── Booking Output ───────────────────────────────────────────────────────────

export const BookingOutputSchema = z.object({
  id: z.string(),
  bookingDate: z.iso.datetime(),
  sessionCount: z.number().int(),
  notes: z.string().nullable(),
  bookingStatus: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]),
  deliveryStatus: z.enum(["PENDING", "DELIVERED", "CANCELLED"]),
  serviceId: z.string(),
  studioId: z.string(),
  clientId: z.string(),
  createdBy: z.string(),
  memberId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  
  // Resolved relations
  client: ClientSummaryOutputSchema,
  service: ServiceOptionOutputSchema,
  member: MemberOutputSchema,
  addons: z.array(ServiceOptionOutputSchema),
  payments: z.array(InlinePaymentSchema),
  photos: z.array(InlinePhotoSchema),

  // Computed fields
  totalPaid: z.string(),       // sum of PAID payments, Decimal as string
  balanceDue: z.string(),      // service.price - totalPaid
  photoCount: z.number().int(),
});

/** Lightweight variant for list/table views — no nested arrays */
export const BookingSummaryOutputSchema = z.object({
  id: z.string(),
  bookingDate: z.iso.datetime(),
  sessionCount: z.number().int(),
  bookingStatus: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]),
  deliveryStatus: z.enum(["PENDING", "DELIVERED", "CANCELLED"]),
  createdAt: z.iso.datetime(),
  client: ClientSummaryOutputSchema,
  service: ServiceOptionOutputSchema,
  totalPaid: z.string(),
  balanceDue: z.string(),
});

export const BookingListOutputSchema = PaginatedOutput(BookingSummaryOutputSchema);

export const CheckClientOutputSchema = z.discriminatedUnion("exists", [
    z.object({
        exists: z.literal(true),
        client: z.object({
            id: z.string(),
            name: z.string(),
            maskedPhone: z.string().nullable(),
        }),
    }),
    z.object({ exists: z.literal(false) }),
]);
// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientOutput = z.infer<typeof ClientOutputSchema>;
export type ClientSummaryOutput = z.infer<typeof ClientSummaryOutputSchema>;
export type ClientListOutput = z.infer<typeof ClientListOutputSchema>;
export type BookingOutput = z.infer<typeof BookingOutputSchema>;
export type BookingSummaryOutput = z.infer<typeof BookingSummaryOutputSchema>;
export type BookingListOutput = z.infer<typeof BookingListOutputSchema>;