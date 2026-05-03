import { z } from "zod";
import { ServiceSchema } from "./service.schema";
import { MemberSchema, StudioSchema } from "./studio.schema";
import { ClientSchema } from "./client.schema";
import { PaymentSchema } from "./payment.schema";
import { PhotoSchema } from "./photo.schema";

// ─── Enums ────────────────────────────────────────────────────────────────────
 
export const BookingStatusEnum = z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]);
export const PaymentStatusEnum = z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"]);
export const DeliveryStatusEnum = z.enum(["PENDING", "DELIVERED", "CANCELLED"]);
 
export type BookingStatus = z.infer<typeof BookingStatusEnum>;
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;
export type DeliveryStatus = z.infer<typeof DeliveryStatusEnum>;



// ─── Booking ──────────────────────────────────────────────────────────────────
 
export const BookingSchema = z.object({
  id: z.string(),
  bookingDate: z.coerce.date(),
  sessionCount: z.number().int().positive().default(1),
  notes: z.string().nullable().optional(),
  bookingStatus: BookingStatusEnum.default("PENDING"),
  paymentStatus: PaymentStatusEnum.default("PENDING"),
  deliveryStatus: DeliveryStatusEnum.default("PENDING"),
  serviceId: z.string(),
  studioId: z.string(),
  clientId: z.string(),
  createdBy: z.string(),
  memberId: z.string(),
 
  /** IDs of addon services attached to this booking */
  addonIds: z.array(z.string()).optional(),
 
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
 
export const CreateBookingSchema = BookingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  bookingStatus: true,
  paymentStatus: true,
  deliveryStatus: true,
}).extend({
  bookingStatus: BookingStatusEnum.default("PENDING").optional(),
  paymentStatus: PaymentStatusEnum.default("PENDING").optional(),
  deliveryStatus: DeliveryStatusEnum.default("PENDING").optional(),

  // Optional for public bookings — resolved server-side to the studio owner/default member
  createdBy: z.string().optional(),
  memberId: z.string().optional(),
});
 
export const UpdateBookingSchema = CreateBookingSchema.partial();
 
/** Used for status-only transitions (e.g., confirm, cancel, deliver) */
export const BookingStatusUpdateSchema = z.object({
  bookingStatus: BookingStatusEnum.optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  deliveryStatus: DeliveryStatusEnum.optional(),
});
 
export type BookingType = z.infer<typeof BookingSchema>;
export type CreateBookingType = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingType = z.infer<typeof UpdateBookingSchema>;
export type BookingStatusUpdate = z.infer<typeof BookingStatusUpdateSchema>;

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

// Public Booking Schema

export const PublicBookingSchema = BookingSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
}).extend({
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
export type PendingMove     = z.infer<typeof PendingMoveSchema>;
export type BookingPerDay   = z.infer<typeof BookingPerDaySchema>;

// Reassign booking schema
export const ReassignBookingSchema = z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
    memberId:  z.string().min(1, "Member ID is required"),
});
export type ReassignBookingInput = z.infer<typeof ReassignBookingSchema>;

// Reschedule booking schema
export const RescheduleBookingSchema = z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
    newDate:   z.date().min(1, "New date is required"),
});
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingSchema>;

// Updating booking status schema
export const UpdateBookingStatusSchema = z.object({
    bookingId:      z.string().min(1, "Booking ID is required"),
    clientId:       z.string().min(1, "Client ID is required"),
    serviceId:      z.string().min(1, "Service ID is required"),
    memberId:       z.string().min(1, "Member ID is required"),
    bookingDate:    z.date().min(1, "Booking date is required"),
    sessionCount:   z.number().min(1, "At least 1 session must be booked"),
    notes:          z.string().optional(),
    
    bookingStatus:  BookingStatusEnum,
    paymentStatus:  PaymentStatusEnum,
    deliveryStatus: DeliveryStatusEnum,

    studioId:       z.string().min(1, "Studio ID is required"),
});
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>;

// Delete booking schema
export const DeleteBookingSchema = z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
});
export type DeleteBookingInput = z.infer<typeof DeleteBookingSchema>;

export const GetBookingSchema = z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
});
export type GetBookingInput = z.infer<typeof GetBookingSchema>;