import { baseContract } from "./errors";
import {
    CreateBookingSchema,
    DeleteBookingSchema,
    GetBookingSchema,
    UpdateBookingSchema,
    ReassignBookingSchema,
    RescheduleBookingSchema,
    UpdateBookingStatusSchema,
    PublicBookingSchema,
    PublicBookingOutputSchema,
    CheckClientSchema,
} from "@/schema/booking.schema";
import {
    BookingOutputSchema,
    BookingListOutputSchema,
    CheckClientOutputSchema,
} from "@/schema/output/booking.output";
import { DeleteOutputSchema } from "@/schema/output/common.output";
import { SearchQuerySchema } from "@/schema/common.schema";

// ─── Booking Contracts ────────────────────────────────────────────────────────
export const CreateBookingContract = baseContract
    .route({
        method: "POST",
        path: "/bookings",
        successStatus: 201,       
        summary: "Add a new booking",
        description: "Add a new booking",
        tags: ["Bookings"], 
    })
    .input(CreateBookingSchema)
    .output(BookingOutputSchema);

export const CreatePublicBookingContract = baseContract
    .route({
        method: "POST",
        path: "/bookings/public",
        successStatus: 201,       
        summary: "Add a new public booking",
        description: "Create an appointment with GMAX studioz",
        tags: ["Bookings"], 
    })
    .input(PublicBookingSchema)
    .output(PublicBookingOutputSchema);

export const UpdateBookingContract = baseContract
    .route({
        method: "PUT",
        path: "/bookings/{bookingId}",
        successStatus: 200,
        summary: "Update a booking",
        description: "Update a booking",
        tags: ["Bookings"], 
    })
    .input(UpdateBookingSchema.extend({ bookingId: GetBookingSchema.shape.bookingId }))
    .output(BookingOutputSchema);

export const DeleteBookingContract = baseContract
    .route({
        method: "DELETE",
        path: "/bookings/{bookingId}",
        successStatus: 200,
        summary: "Delete a booking",
        description: "Delete a booking",
        tags: ["Bookings"], 
    })
    .input(DeleteBookingSchema)
    .output(DeleteOutputSchema);

export const GetBookingContract = baseContract
    .route({
        method: "GET",
        path: "/bookings/{bookingId}",
        successStatus: 200,
        summary: "Get a booking by ID",
        description: "Get a booking by ID",
        tags: ["Bookings"], 
    })
    .input(GetBookingSchema)
    .output(BookingOutputSchema);

export const GetAllBookingsContract = baseContract
    .route({
        method: "GET",
        path: "/bookings",
        successStatus: 200,
        summary: "Get all bookings",
        description: "Get all bookings",
        tags: ["Bookings"], 
    })
    .input(SearchQuerySchema)
    .output(BookingListOutputSchema);

export const ReassignBookingContract = baseContract
    .route({
        method: "PUT",
        path: "/bookings/{bookingId}/reassign",
        successStatus: 200,
        summary: "Reassign a booking",
        description: "Reassign a booking",
        tags: ["Bookings"], 
    })
    .input(ReassignBookingSchema)
    .output(BookingOutputSchema);

export const RescheduleBookingContract = baseContract
    .route({
        method: "PUT",
        path: "/bookings/{bookingId}/reschedule",
        successStatus: 200,
        summary: "Reschedule a booking",
        description: "Reschedule a booking",
        tags: ["Bookings"], 
    })
    .input(RescheduleBookingSchema)
    .output(BookingOutputSchema);

export const UpdateBookingStatusContract = baseContract
    .route({
        method: "PUT",
        path: "/bookings/{bookingId}/status",
        successStatus: 200,
        summary: "Update a booking status",
        description: "Update a booking status",
        tags: ["Bookings"], 
    })
    .input(UpdateBookingStatusSchema)
    .output(BookingOutputSchema);

export const CheckClientContract = baseContract
    .route({
        method: "GET",
        path: "/bookings/check-client",
        successStatus: 200,
        summary: "Check if a client exists",
        description: "Check if a client exists",
        tags: ["Bookings"], 
    })
    .input(CheckClientSchema)
    .output(CheckClientOutputSchema);