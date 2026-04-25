import { string, z } from "zod";

// ── Studio Metadata ───────────────────────────────────────────────────────────
// Better Auth stores metadata as a JSON object — it is serialised to/from a
// JSON string in the DB automatically. Define the structure here so the rest
// of the app has full type-safety.

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

// ── Shared field definitions ──────────────────────────────────────────────────

const nameField = z
    .string({ error: "Studio name is required." })
    .min(3, "Name must be at least 3 characters.")
    .max(100, "Name must be at most 100 characters.")
    .trim();

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

// ── Create Studio ─────────────────────────────────────────────────────────────

/** Used when creating a new studio (organization). */
export const CreateStudioSchema = z.object({
    name: nameField,
    slug: slugField,
    logo: logoField,
    metadata: StudioMetadataSchema.optional(),
});

export type CreateStudioSchemaType = z.infer<typeof CreateStudioSchema>;

// ── Update Studio ─────────────────────────────────────────────────────────────

export const UpdateStudioSchema = CreateStudioSchema.partial();

export type UpdateStudioInput = z.infer<typeof UpdateStudioSchema>;

// ── Invite Member ─────────────────────────────────────────────────────────────

export const MemberRoleEnum = z.enum(["owner", "manager", "photographer", "videographer", "receptionist"], {
    error: "Invalid role. Must be admin, photographer, videographer, or receptionist.",
});

export type MemberRole = z.infer<typeof MemberRoleEnum>;

/** Used when inviting a user to a studio. */
export const InviteMemberSchema = z.object({
    email: z
        .email("Please enter a valid email address.")
        .toLowerCase()
        .trim(),
    role: MemberRoleEnum,
    studio: z.string()
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateStaffSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phoneNumber: z.string().optional(),
    role: MemberRoleEnum,
});

export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
