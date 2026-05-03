import { oc } from "@orpc/contract";
import z from "zod";

/**
 * Shared error catalogue — every contract inherits from this base.
 *
 * Convention:
 *   - SCREAMING_SNAKE for error codes
 *   - `data` schemas are optional; only add them when clients need structured info
 *   - status codes follow RFC 9110 semantics
 */
export const baseContract = oc.errors({
    UNAUTHORIZED: {
        status: 401,
        message: "Unauthorized",
    },
    FORBIDDEN: {
        status: 403,
        message: "You don't have permission to perform this action",
    },
    NOT_FOUND: {
        status: 404,
        message: "Resource not found",
        data: z.object({
            resourceType: z.string(),
            resourceId: z.string(),
        }),
    },
    VALIDATION: {
        status: 400,
        message: "Validation Error",
    },
    BAD_REQUEST: {
        status: 400,
        message: "Bad Request",
    },
    DOMAIN_RULE_VIOLATION: {
        status: 400,
        message: "Domain Rule Violation",
        data: z.object({
            rule: z.string(),
            message: z.string(),
        }),
    },
    CONFLICT: {
        status: 409,
        message: "Resource already exists",
        data: z.object({
            conflictField: z.string(),
            conflictValue: z.string(),
        }),
    },
    INTERNAL_SERVER_ERROR: {
        status: 500,
        message: "Internal Server Error",
    },
});
