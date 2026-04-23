import { z } from "zod";

// ── Studio Metadata ───────────────────────────────────────────────────────────

export const StudioCategoryEnum = z.enum(
    ["recording", "mixing", "mastering", "rehearsal", "podcast", "film", "other"]
);

export type StudioCategory = z.infer<typeof StudioCategoryEnum>;

export const StudioMetadataSchema = z.object({
    description: z
        .string()
        .max(500, "Description must be at most 500 characters.")
        .optional(),

    address: z
        .string()
        .max(200, "Address must be at most 200 characters.")
        .optional(),

    state: z
        .string()
        .max(200, "Town must be at most 200 characters.")
        .optional(),

    city: z
        .string()
        .max(200, "City must be at most 200 characters.")
        .optional(),

    country: z
        .string()
        .max(200, "Country must be at most 200 characters.")
        .optional(),

    phone: z
        .string()
        .regex(
            /^\+?[0-9\s\-().]{7,20}$/,
            "Please enter a valid phone number."
        )
        .optional()
        .or(z.literal("")),

    category: StudioCategoryEnum.optional(),

    socialLinks: z
        .object({
            instagram: z.url("Must be a valid URL.").optional().or(z.literal("")),
            twitter:   z.url("Must be a valid URL.").optional().or(z.literal("")),
            facebook:  z.url("Must be a valid URL.").optional().or(z.literal("")),
            youtube:   z.url("Must be a valid URL.").optional().or(z.literal("")),
            tiktok:    z.url("Must be a valid URL.").optional().or(z.literal("")),
        })
        .optional(),
});

export type StudioMetadata = z.infer<typeof StudioMetadataSchema>;


// ─── StudioSession ────────────────────────────────────────────────────────────

export const StudioSessionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  duration: z.number().int().positive().default(45),
  studioId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateStudioSessionSchema = StudioSessionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateStudioSessionSchema = CreateStudioSessionSchema.partial();

export type StudioSession = z.infer<typeof StudioSessionSchema>;
export type CreateStudioSession = z.infer<typeof CreateStudioSessionSchema>;
export type UpdateStudioSession = z.infer<typeof UpdateStudioSessionSchema>;

// ── Shared field definitions ──────────────────────────────────────────────────

const nameField = z
    .string({ error: "Studio name is required." })
    .min(3, "Name must be at least 3 characters.")
    .max(100, "Name must be at most 100 characters.")

const slugField = z
    .string({ error: "Slug is required." })
    .min(3, "Slug must be at least 3 characters.")
    .max(60, "Slug must be at most 60 characters.")
    .toLowerCase()
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)."
    );

const logoField = z
    .string()
    .optional();

// ─── Studio ───────────────────────────────────────────────────────────────────
 
export const StudioSchema = z.object({
  id: z.string(),
  name: nameField,
  slug: slugField,
  logo: logoField,
  metadata: StudioMetadataSchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ── Create Studio ─────────────────────────────────────────────────────────────
export const CreateStudioSchema = StudioSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ── Update Studio ─────────────────────────────────────────────────────────────
export const UpdateStudioSchema = CreateStudioSchema.partial();
 
export type StudioType = z.infer<typeof StudioSchema>;
export type CreateStudioType = z.infer<typeof CreateStudioSchema>;
export type UpdateStudioType = z.infer<typeof UpdateStudioSchema>;



// ─── Role ─────────────────────────────────────────────────────────────────────
 
export const RoleSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  role: z.string().min(1),
  permission: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
 
export const CreateRoleSchema = RoleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
 
export const UpdateRoleSchema = CreateRoleSchema.partial();
 
export type RoleType = z.infer<typeof RoleSchema>;
export type CreateRoleType = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleType = z.infer<typeof UpdateRoleSchema>;



// ─── Member ───────────────────────────────────────────────────────────────────

export const MemberRoleEnum = z.enum(["owner", "manager", "photographer", "videographer", "receptionist"], {
    error: "Invalid role. Must be admin, photographer, videographer, or receptionist.",
});

export type MemberRole = z.infer<typeof MemberRoleEnum>;

export const MemberSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  userId: z.string(),
  role: MemberRoleEnum.default("photographer"),
  createdAt: z.coerce.date(),
});

export const CreateMemberSchema = MemberSchema.omit({
  id: true,
  createdAt: true,
});
 
export const UpdateMemberSchema = CreateMemberSchema.partial();
 
export type MemberType = z.infer<typeof MemberSchema>;
export type CreateMemberType = z.infer<typeof CreateMemberSchema>;
export type UpdateMemberType = z.infer<typeof UpdateMemberSchema>;




// ─── Invitation ───────────────────────────────────────────────────────────────
 
export const InvitationStatusEnum = z.enum(["pending", "accepted", "rejected", "cancelled"]);
 
export const InvitationSchema = z.object({
  id: z.string(),
  studioId: z.string(),
  email: z.email(),
  role: MemberRoleEnum,
  status: InvitationStatusEnum.default("pending"),
  expiresAt: z.coerce.date(),
  inviterId: z.string(),
  createdAt: z.coerce.date(),
});
 
export const InviteMemberSchema = InvitationSchema.omit({
  id: true,
  createdAt: true,
  status: true,
  inviterId: true,
  expiresAt: true,
}).extend({
  status: InvitationStatusEnum.default("pending").optional(),
});
 
export const UpdateInvitationSchema = InviteMemberSchema.partial();
 
export type InvitationStatusType = z.infer<typeof InvitationStatusEnum>;
export type InvitationType = z.infer<typeof InvitationSchema>;
export type CreateInvitationType = z.infer<typeof InviteMemberSchema>;
export type UpdateInvitationType = z.infer<typeof UpdateInvitationSchema>;



export const UpdateStaffSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phoneNumber: z.string().optional(),
    role: MemberRoleEnum,
});

export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
