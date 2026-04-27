import { z } from "zod";
import { PaginatedOutput } from "./common.output";
import { BookingSummaryOutputSchema } from "./booking.output";

// ─── Payment Output ───────────────────────────────────────────────────────────

export const PaymentOutputSchema = z.object({
  id: z.string(),
  amount: z.string(), // Decimal serialized as string — preserves precision
  method: z.enum(["CASH", "TRANSFER", "POS"]),
  status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]),
  paystackReference: z.string().nullable(),
  receiptNumber: z.string(),
  receiptUrl: z.url().nullable(),
  bookingId: z.string(),
  recordedById: z.string(),
  paymentDate: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  // Resolved relation
  booking: BookingSummaryOutputSchema,
});

export const PaymentListOutputSchema = PaginatedOutput(PaymentOutputSchema);

/** Returned after initiating a Paystack transaction */
export const PaystackInitOutputSchema = z.object({
  authorizationUrl: z.url(),
  accessCode: z.string(),
  reference: z.string(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentOutput = z.infer<typeof PaymentOutputSchema>;
export type PaymentListOutput = z.infer<typeof PaymentListOutputSchema>;
export type PaystackInitOutput = z.infer<typeof PaystackInitOutputSchema>;