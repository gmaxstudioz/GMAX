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

export const PaystackWebhookOutputSchema = z.object({ received: z.boolean() });

export const PublicPaymentDetailsOutputSchema = z.object({
  amount: z.string(),
  status: z.string(),
  isAlreadyPaid: z.boolean(),
  booking: z.object({
    sessionCount: z.number(),
    bookingDate: z.string(),
    client: z.object({
      name: z.string(),
      email: z.string().nullable(),
    }).nullable(),
    service: z.object({
      name: z.string(),
      duration: z.number(),
    }).nullable(),
    studio: z.object({
      name: z.string(),
      logo: z.string().nullable(),
    }).nullable(),
    addons: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })),
  }).nullable(),
  productAccess: z.object({
    product: z.object({
      title: z.string(),
    }),
    buyer: z.object({
      name: z.string(),
      email: z.string(),
    }),
  }).nullable(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentOutput = z.infer<typeof PaymentOutputSchema>;
export type PaymentListOutput = z.infer<typeof PaymentListOutputSchema>;
export type PaystackInitOutput = z.infer<typeof PaystackInitOutputSchema>;
export type PaystackWebhookOutput = z.infer<typeof PaystackWebhookOutputSchema>;
export type PublicPaymentDetailsOutput = z.infer<typeof PublicPaymentDetailsOutputSchema>;