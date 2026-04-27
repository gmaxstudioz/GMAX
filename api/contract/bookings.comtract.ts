import { CreateBookingSchema } from "@/schema/booking.schema";
import { oc } from "@orpc/contract";
import z from "zod";

export const base = oc.errors({
    UNAUTHORIZED: {
        status: 401,
        message: "Unauthorized"
    },
    FORBIDDEN: {
        status: 403,
        message: "You don't have permission to perform this action"
    },
    NOT_FOUND: {
        status: 404,
        message: "Resource not found",
        data: z.object({
            resourceType: z.string(),
            resourceId: z.string(),
        })
    },
    VALIDATION: {
        status: 400,
        message: "Validation Error"
    },
    INTERNAL_SERVER_ERROR: {
        status: 500,
        message: "Internal Server Error"
    },
    BAD_REQUEST: {
        status: 400,
        message: "Bad Request"
    },
    DOMAIN_RULE_VIOLATION: {
        status: 400,
        message: "Domain Rule Violation",
        data: z.object({
            rule: z.string(),
            message: z.string(),
        })
    }
});

export const bookingContract = base.input(CreateBookingSchema)