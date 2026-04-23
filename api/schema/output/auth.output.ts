import { z } from "zod";
import { PaginatedOutput } from "./common.output";

// ─── User Output ──────────────────────────────────────────────────────────────

/**
 * The server NEVER returns password, tokens, or raw account credentials.
 * Dates are serialized as ISO strings over the wire.
 */
export const UserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  image: z.url().nullable(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const UserListOutputSchema = PaginatedOutput(UserOutputSchema);

// ─── Session Output ───────────────────────────────────────────────────────────

export const SessionOutputSchema = z.object({
  id: z.string(),
  expiresAt: z.iso.datetime(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  userId: z.string(),
  activeOrganizationId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  
  // Resolved relation
  user: UserOutputSchema,
});

export const SessionListOutputSchema = PaginatedOutput(SessionOutputSchema);

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserOutput = z.infer<typeof UserOutputSchema>;
export type UserListOutput = z.infer<typeof UserListOutputSchema>;
export type SessionOutput = z.infer<typeof SessionOutputSchema>;
export type SessionListOutput = z.infer<typeof SessionListOutputSchema>;