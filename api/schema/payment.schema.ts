import { z } from "zod";
import { PaymentStatusEnum } from "./booking.schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PaymentMethodEnum = z.enum(["CASH", "TRANSFER", "POS"]);

export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

// ─── Payment ──────────────────────────────────────────────────────────────────

export const PaymentSchema = z.object({
  id: z.string(),

  /** Stored as Decimal(10,2) in DB — use string to avoid float precision loss */
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places"),

  method: PaymentMethodEnum.default("CASH"),
  status: PaymentStatusEnum.default("PENDING"),

  // Paystack integration
  paystackReference: z.string().nullable().optional(),
  paystackResponse: z.record(z.string(), z.unknown()).optional(),

  // Receipt
  receiptNumber: z.string().min(1),
  receiptUrl: z.string().url().nullable().optional(),

  bookingId: z.string(),
  recordedById: z.string(),

  paymentDate: z.coerce.date().default(() => new Date()),
  createdAt: z.coerce.date(),
});

export const CreatePaymentSchema = PaymentSchema.omit({
  id: true,
  createdAt: true,
  status: true,
  paystackResponse: true,
}).extend({
  status: PaymentStatusEnum.default("PENDING").optional(),
});

export const UpdatePaymentSchema = CreatePaymentSchema.partial();

/** Thin schema for recording a Paystack webhook callback */
export const PaystackCallbackSchema = z.object({
  paystackReference: z.string().min(1),
  paystackResponse: z.record(z.string(), z.string()),
  status: PaymentStatusEnum,
});


export const InitPaystackPaymentSchema = z.object({
    bookingId: z.string().min(1),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    email: z.email(),
    callbackUrl: z.url().optional(),
});

export const PaystackWebhookRequestSchema = z.object({
    event: z.string(),
    data: z.object({
        reference: z.string(),
        status: z.string(),
        amount: z.number(),
        metadata: z.record(z.string(), z.unknown()).optional(),
    }),
})

export type Payment = z.infer<typeof PaymentSchema>;
export type CreatePayment = z.infer<typeof CreatePaymentSchema>;
export type UpdatePayment = z.infer<typeof UpdatePaymentSchema>;
export type PaystackCallback = z.infer<typeof PaystackCallbackSchema>;
export type InitPaystackPayment = z.infer<typeof InitPaystackPaymentSchema>;