import { baseContract } from "./errors";
import {
    CreatePaymentSchema,
    UpdatePaymentSchema,
    PaystackCallbackSchema,
} from "@/schema/payment.schema";
import {
    PaymentOutputSchema,
    PaymentListOutputSchema,
    PaystackInitOutputSchema,
} from "@/schema/output/payment.output";
import { DeleteOutputSchema, SuccessOutputSchema } from "@/schema/output/common.output";
import { IdParamSchema, StudioScopedQuerySchema } from "@/schema/common.schema";
import z from "zod";

// ─── Payment CRUD ─────────────────────────────────────────────────────────────

export const createPaymentContract = baseContract
    .input(CreatePaymentSchema)
    .output(PaymentOutputSchema);

export const updatePaymentContract = baseContract
    .input(UpdatePaymentSchema.extend({ id: IdParamSchema.shape.id }))
    .output(PaymentOutputSchema);

export const deletePaymentContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getPaymentContract = baseContract
    .input(IdParamSchema)
    .output(PaymentOutputSchema);

export const getAllPaymentsContract = baseContract
    .input(StudioScopedQuerySchema.extend({
        bookingId: z.string().optional(),
        status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]).optional(),
    }))
    .output(PaymentListOutputSchema);

// ─── Paystack Integration ─────────────────────────────────────────────────────

/** Initiate a Paystack transaction for a booking */
export const initPaystackPaymentContract = baseContract
    .input(z.object({
        bookingId: z.string().min(1),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        email: z.string().email(),
        callbackUrl: z.string().url().optional(),
    }))
    .output(PaystackInitOutputSchema);

/** Handle Paystack webhook callback */
export const paystackWebhookContract = baseContract
    .input(PaystackCallbackSchema)
    .output(SuccessOutputSchema);
