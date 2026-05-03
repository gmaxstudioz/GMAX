import { baseContract } from "./errors";
import {
    CreateBookingSchema,
    DeleteBookingSchema,
    GetBookingSchema,
    UpdateBookingSchema,
    ReassignBookingSchema,
    RescheduleBookingSchema,
    UpdateBookingStatusSchema,
} from "@/schema/booking.schema";
import {
    BookingOutputSchema,
    BookingListOutputSchema,
} from "@/schema/output/booking.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { SearchQuerySchema } from "@/schema/common.schema";

// ─── Booking Contracts ────────────────────────────────────────────────────────

export const CreateBookingContract = baseContract
    .input(CreateBookingSchema)
    .output(BookingOutputSchema);

export const UpdateBookingContract = baseContract
    .input(UpdateBookingSchema.extend({ bookingId: GetBookingSchema.shape.bookingId }))
    .output(BookingOutputSchema);

export const DeleteBookingContract = baseContract
    .input(DeleteBookingSchema)
    .output(DeleteOutputSchema);

export const GetBookingContract = baseContract
    .input(GetBookingSchema)
    .output(BookingOutputSchema);

export const GetAllBookingsContract = baseContract
    .input(SearchQuerySchema)
    .output(BookingListOutputSchema);

export const ReassignBookingContract = baseContract
    .input(ReassignBookingSchema)
    .output(BookingOutputSchema);

export const RescheduleBookingContract = baseContract
    .input(RescheduleBookingSchema)
    .output(BookingOutputSchema);

export const UpdateBookingStatusContract = baseContract
    .input(UpdateBookingStatusSchema)
    .output(BookingOutputSchema);
