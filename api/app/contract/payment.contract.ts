import { baseContract } from "./errors";
import {
    CreatePaymentSchema,
    UpdatePaymentSchema,
    InitPaystackPaymentSchema,
} from "@/schema/payment.schema";
import {
    PaymentOutputSchema,
    PaymentListOutputSchema,
    PaystackInitOutputSchema,
} from "@/schema/output/payment.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { IdParamSchema, StudioScopedQuerySchema } from "@/schema/common.schema";
import z from "zod";

// ─── Payment CRUD ─────────────────────────────────────────────────────────────

export const createPaymentContract = baseContract
    .route({
        method: "POST",
        path: "/payments",
        successStatus: 200,
        summary: "Create a new payment",
        description: "Create a new payment",
        tags: ["Payments"], 
    })
    .input(CreatePaymentSchema)
    .output(PaymentOutputSchema);

export const updatePaymentContract = baseContract
    .route({
        method: "PUT",
        path: "/payments/{id}",
        successStatus: 200,
        summary: "Update a payment",
        description: "Update a payment",
        tags: ["Payments"], 
    })
    .input(UpdatePaymentSchema.extend({ id: IdParamSchema.shape.id }))
    .output(PaymentOutputSchema);

export const deletePaymentContract = baseContract
    .route({
        method: "DELETE",
        path: "/payments/{id}",
        successStatus: 200,
        summary: "Delete a payment",
        description: "Delete a payment",
        tags: ["Payments"], 
    })
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getPaymentContract = baseContract
    .route({
        method: "GET",
        path: "/payments/{id}",
        successStatus: 200,
        summary: "Get a payment",
        description: "Get a payment",
        tags: ["Payments"], 
    })
    .input(IdParamSchema)
    .output(PaymentOutputSchema);

export const getAllPaymentsContract = baseContract
    .route({
        method: "GET",
        path: "/payments",
        successStatus: 200,
        summary: "Get all payments",
        description: "Get all payments",
        tags: ["Payments"], 
    })
    .input(StudioScopedQuerySchema.extend({
        bookingId: z.string().optional(),
        status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]).optional(),
    }))
    .output(PaymentListOutputSchema);

// ─── Paystack Integration ─────────────────────────────────────────────────────

export const initPaystackPaymentContract = baseContract
    .route({
        method: "POST",
        path: "/payments/init-paystack",
        successStatus: 200,
        summary: "Initiate a Paystack transaction for a booking",
        description: "Initiate a Paystack transaction for a booking",
        tags: ["Payments"], 
    })
    .input(InitPaystackPaymentSchema)
    .output(PaystackInitOutputSchema);

export const verifyPurchaseContract = baseContract
    .route({
        method: "GET",
        path: "/payments/verify-purchase",
        successStatus: 200,
        summary: "Verify a product purchase by reference",
        tags: ["Payments"],
    })
    .input(z.object({ reference: z.string().min(1) }))
    .output(z.object({
        verified: z.boolean(),
        buyerId: z.string().optional(),
    }));