// portal/lib/schemas/booking.schema.ts
import { z } from "zod";

export const publicBookingSchema = z.object({
    studioId: z.string().min(1),
    clientName: z.string().min(2, "Name must be at least 2 characters"),
    clientEmail: z.email("Invalid email address").optional(),
    useExisting: z.boolean(),
    existingClientId: z.string().optional(),
    clientPhone: z.string().optional(),
    selectedServiceId: z.string().min(1, "Please select a service"),
    selectedAddonIds: z.array(z.string()),
    sessionCount: z.number().min(1, "Must be at least 1"),
    bookingDate: z.string().min(1, "Please select a date"),
    notes: z.string().optional(),
}).superRefine((val, ctx) => {
    if (!val.useExisting && !val.clientPhone) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Phone number is required for new clients",
            path: ["clientPhone"],
        });
    }
    if (val.useExisting && !val.existingClientId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select your existing profile",
            path: ["existingClientId"],
        });
    }
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;