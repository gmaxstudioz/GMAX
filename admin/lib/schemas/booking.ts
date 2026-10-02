import { z } from "zod";

export const BookingStatusEnum = z.enum([
    "PENDING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED"
], { message: "Invalid booking status" });

export const PaymentStatusEnum = z.enum([
    "PENDING",
    "CANCELLED",
    "PAID",
    "PARTIALLY_PAID",
], { message: "Invalid payment status" });

export const DeliveryStatusEnum = z.enum([
    "PENDING",
    "DELIVERED",
    "CANCELLED"
], { message: "Invalid delivery status" });

// Mirrors the Prisma PaymentPlan enum (QUARTER = 25%, HALF = 50%, FULL = 100%)
export const PaymentPlanEnum = z.enum([
    "QUARTER",
    "HALF",
    "FULL",
], { message: "Invalid payment plan" });

export const BookingSchema = z.object({
    bookingDate:        z.date(),
    sessionCount:       z.number().min(1, "At least 1 session must be booked"),
    extraPicturesCount: z.number().min(0).optional(),
    notes:              z.string().optional(),

    totalAmount:        z.number().positive("Total amount must be greater than 0"),
    paymentPlan:        PaymentPlanEnum,

    bookingStatus:      BookingStatusEnum,
    paymentStatus:      PaymentStatusEnum,
    deliveryStatus:     DeliveryStatusEnum,

    serviceId:          z.string(),
    serviceVariantId:   z.string().optional(), // links to ServiceVariant; optional in Prisma
    studioId:           z.string(),
    clientId:           z.string(),
    memberId:           z.string().optional(), // String? in Prisma — was incorrectly required before
    createdBy:          z.string(),
});

export const CreateBookingSchema = BookingSchema.omit({
    createdBy: true,
    studioId:  true,
}).extend({
    addonIds: z.array(z.string()).optional(),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const PendingMoveSchema = z.object({
    bookingId: z.string(),
    fromKey:   z.string(),
    toKey:     z.string(),
});

export const BookingPerDaySchema = z.object({
    date:           z.coerce.date(),
    key:            z.string(),
    isCurrentMonth: z.boolean(),
});

export const UpdateBookingSchema = BookingSchema.partial().extend({
    addonIds: z.array(z.string()).optional(),
});
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;

// Used for public-facing booking flow — maps to BookingIntent in Prisma
export const PublicBookingSchema = z.object({
    clientName:               z.string().min(2, "Name must be at least 2 characters"),
    clientPhone:              z.string().optional(),
    clientEmail:              z.email("Invalid email address").optional(),
    useExisting:              z.boolean(),
    existingClientId:         z.string().optional(),

    selectedServiceId:        z.string().min(1, "Please select a service"),
    selectedVariantId:        z.string().min(1, "Please select a service option"),
    selectedAddonIds:         z.array(z.string()),
    sessionCount:             z.number().min(1, "Must be at least 1"),
    extraPicturesCount:       z.number().min(0).optional(),

    bookingDate:              z.string().min(1, "Please select a date"),
    bookingTime:              z.string().min(1, "Please select a time"),
    notes:                    z.string().optional(),
    paymentPlan:              PaymentPlanEnum,
});
export type PublicBookingInput = z.infer<typeof PublicBookingSchema>;

export type Booking         = z.infer<typeof BookingSchema>;
export type BookingStatus   = z.infer<typeof BookingStatusEnum>;
export type PaymentStatus   = z.infer<typeof PaymentStatusEnum>;
export type DeliveryStatus  = z.infer<typeof DeliveryStatusEnum>;
export type PaymentPlan     = z.infer<typeof PaymentPlanEnum>;
export type PendingMove     = z.infer<typeof PendingMoveSchema>;
export type BookingPerDay   = z.infer<typeof BookingPerDaySchema>;