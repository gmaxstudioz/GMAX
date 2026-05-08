import { z } from "zod";
import { BookingSchema } from "./booking";
 
export const ClientTypeEnum = z.enum([
    "vvip",
    "vip",
    "regular"
], {message: "Invalid client type"});

export const ClientSchema = z.object({
    name:           z.string(),
    email:          z.email().nullable().optional(),
    phone:          z.array(z.string()),
    address:        z.string().nullable().optional(),
    notes:          z.string().nullable().optional(),
    clientType:     ClientTypeEnum,
});

export const ClientSchemaOutput = z.object({
    id:         z.string(),
    image:      z.string().optional(),
    name:       z.string(),
    email:      z.email().nullable().optional(),
    phone:      z.array(z.string()),
    clientType: ClientTypeEnum,
});

export const ClientWithBookings = z.object({
    ...ClientSchemaOutput.shape,
    address:    z.string().nullable().optional(),
    notes:      z.string().nullable().optional(),
    bookings:   z.array(BookingSchema),
});

export type Client = z.infer<typeof ClientSchema>;
export type ClientType = z.infer<typeof ClientTypeEnum>;
export type ClientOutput = z.infer<typeof ClientSchemaOutput>;
export type ClientWithBookings = z.infer<typeof ClientWithBookings>;