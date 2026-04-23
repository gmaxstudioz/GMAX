import { z } from "zod";

export const ClientTypeEnum = z.enum(["vvip", "vip", "regular"], {message: "Invalid client type"});
export type ClientType = z.infer<typeof ClientTypeEnum>;

// ─── Client ───────────────────────────────────────────────────────────────────
 
export const ClientSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  phone: z.array(z.string().min(1)).min(1, "At least one phone number is required"),
  email: z.string().optional(),
  address: z.string().optional(),
  image: z.string().optional(),
  notes: z.string().optional(),
  type: z.string().min(1),
  studioId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
 
export const CreateClientSchema = ClientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
 
export const UpdateClientSchema = CreateClientSchema.partial();
 
export type Client = z.infer<typeof ClientSchema>;
export type CreateClient = z.infer<typeof CreateClientSchema>;
export type UpdateClient = z.infer<typeof UpdateClientSchema>;