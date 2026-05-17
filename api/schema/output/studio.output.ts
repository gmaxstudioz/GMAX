import { z } from "zod";
import { UserOutputSchema } from "./auth.output";
import { PaginatedOutput } from "./common.output";

// ─── Role Output ──────────────────────────────────────────────────────────────

export const RoleOutputSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  role: z.string(),
  permission: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// ─── Studio Output ────────────────────────────────────────────────────────────

export const StudioOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Studio with member count — useful for dashboard/list views */
export const StudioSummaryOutputSchema = StudioOutputSchema.extend({
  _count: z.object({
    members: z.number().int(),
    bookings: z.number().int(),
  }),
});

export const StudioListOutputSchema = PaginatedOutput(StudioSummaryOutputSchema);

export const PublicServiceOutputSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    description: z.string(),
    features: z.array(z.string()),
    price: z.number(),
    salePrice: z.number().nullable(),
});

export const PublicCategoryOutputSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    services: z.array(PublicServiceOutputSchema),
});

export const PublicStudioSessionOutputSchema = z.object({
    id: z.string(),
    name: z.string(),
    duration: z.number(),
});

export const PublicStudioOutputSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    categories: z.array(PublicCategoryOutputSchema),
    studioSessions: z.array(PublicStudioSessionOutputSchema),
    addons: z.array(PublicServiceOutputSchema),
});

export type PublicStudioOutput = z.infer<typeof PublicStudioOutputSchema>;

// ─── Member Output ────────────────────────────────────────────────────────────

export const MemberOutputSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.iso.datetime(),

  // Resolved relation
  user: UserOutputSchema,
});

export const MemberListOutputSchema = PaginatedOutput(MemberOutputSchema);

// ─── Invitation Output ────────────────────────────────────────────────────────

export const InvitationOutputSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  email: z.email(),
  role: z.string().nullable(),
  status: z.enum(["pending", "accepted", "rejected", "cancelled"]),
  expiresAt: z.iso.datetime(),
  inviterId: z.string(),
  createdAt: z.iso.datetime(),
  
  // Resolved relations
  studio: StudioOutputSchema,
  inviter: UserOutputSchema,
});

export const InvitationListOutputSchema = PaginatedOutput(InvitationOutputSchema);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoleOutput = z.infer<typeof RoleOutputSchema>;
export type StudioOutput = z.infer<typeof StudioOutputSchema>;
export type StudioSummaryOutput = z.infer<typeof StudioSummaryOutputSchema>;
export type StudioListOutput = z.infer<typeof StudioListOutputSchema>;
export type MemberOutput = z.infer<typeof MemberOutputSchema>;
export type MemberListOutput = z.infer<typeof MemberListOutputSchema>;
export type InvitationOutput = z.infer<typeof InvitationOutputSchema>;
export type InvitationListOutput = z.infer<typeof InvitationListOutputSchema>;