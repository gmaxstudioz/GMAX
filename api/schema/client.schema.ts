import { z } from "zod";

export const ClientTypeEnum = z.enum([
    "vvip",
    "vip",
    "regular"
], {message: "Invalid client type"});

export const ClientSchema = z.object({
    name:           z.string(),
    email:          z.email().optional(),
    phone:          z.array(z.string()),
    address:        z.string().optional(),
    notes:          z.string().optional(),
    clientType:     ClientTypeEnum,
});

export type Client = z.infer<typeof ClientSchema>;
export type ClientType = z.infer<typeof ClientTypeEnum>;