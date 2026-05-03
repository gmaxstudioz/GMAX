import { z } from "zod";

export const BookingStatusEnum = z.enum([
    "PENDING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED"
], {message: "Invalid booking status"});


export const PaymentStatusEnum = z.enum([
    "PENDING",
    "CANCELLED",
    "PAID",
    "PARTIALLY_PAID",
], {message: "Invalid payment status"});


export const DeliveryStatusEnum = z.enum([
    "PENDING",
    "DELIVERED",
    "CANCELLED"
], {message: "Invalid delivery status"});


export const BookingSchema = z.object({
    bookingDate:    z.date(),
    sessionCount:   z.number().min(1, "At least 1 session must be booked"),
    notes:          z.string().optional(),
    
    bookingStatus:  BookingStatusEnum,
    paymentStatus:  PaymentStatusEnum,
    deliveryStatus: DeliveryStatusEnum,

    serviceId:      z.string(),
    studioId:       z.string(),
    clientId:       z.string(),
    memberId:       z.string(),
    createdBy:      z.string(),
});

export const CreateBookingSchema = BookingSchema.omit({
    createdBy: true,
    studioId: true,
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
    date:       z.coerce.date(),
    key:        z.string(),
    isCurrentMonth: z.boolean(),
});

export const UpdateBookingSchema = BookingSchema.partial().extend({
    addonIds: z.array(z.string()).optional(),
});
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;

export const PublicBookingSchema = z.object({
    clientName: z.string().min(2, "Name must be at least 2 characters"),
    clientPhone: z.string().optional(),
    clientEmail: z.email("Invalid email address").optional(),
    useExisting: z.boolean(),
    existingClientId: z.string().optional(),
    
    selectedServiceId: z.string().min(1, "Please select a service"),
    selectedAddonIds: z.array(z.string()),
    sessionCount: z.number().min(1, "Must be at least 1"),
    
    bookingDate: z.string().min(1, "Please select a date"),
    bookingTime: z.string().min(1, "Please select a time"),
    notes: z.string().optional(),
});
export type PublicBookingInput = z.infer<typeof PublicBookingSchema>;

export type Booking         = z.infer<typeof BookingSchema>;
export type BookingStatus   = z.infer<typeof BookingStatusEnum>;
export type PaymentStatus   = z.infer<typeof PaymentStatusEnum>;
export type DeliveryStatus  = z.infer<typeof DeliveryStatusEnum>;
export type PendingMove     = z.infer<typeof PendingMoveSchema>;
export type BookingPerDay   = z.infer<typeof BookingPerDaySchema>;
