import { baseContract } from "./errors";
import {
    CreateStudioSchema,
    UpdateStudioSchema,
    CreateMemberSchema,
    UpdateMemberSchema,
    InviteMemberSchema,
    UpdateInvitationSchema,
    UpdateStaffSchema,
} from "@/schema/studio.schema";
import {
    StudioOutputSchema,
    StudioSummaryOutputSchema,
    StudioListOutputSchema,
    MemberOutputSchema,
    MemberListOutputSchema,
    InvitationOutputSchema,
    InvitationListOutputSchema,
    PublicStudioOutputSchema,
} from "@/schema/output/studio.output";
import { DeleteOutputSchema, SuccessOutputSchema } from "@/schema/output/common.output";
import { IdParamSchema, PaginationQuerySchema, StudioScopedQuerySchema } from "@/schema/common.schema";
import z from "zod";

// ─── Studio CRUD ──────────────────────────────────────────────────────────────

export const createStudioContract = baseContract
    .input(CreateStudioSchema)
    .output(StudioOutputSchema);

export const updateStudioContract = baseContract
    .input(UpdateStudioSchema.extend({ id: IdParamSchema.shape.id }))
    .output(StudioOutputSchema);

export const deleteStudioContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getStudioContract = baseContract
    .route({
        method: "POST",
        path: "/studio/get/{slug}",
        successStatus: 200,
        summary: "Get a studio by slug",
        description: "Get a studio by slug",
        tags: ["Studio"],
    })
    .input(z.object({ slug: z.string().min(1) }))
    .output(PublicStudioOutputSchema);

export const getStudioByIdContract = baseContract
    .input(IdParamSchema)
    .output(StudioSummaryOutputSchema);

export const getAllStudiosContract = baseContract
    .route({
        method: "GET",
        path: "/studio/getAll",
        successStatus: 200,
        summary: "Get all studios",
        description: "Get a paginated list of all studios",
        tags: ["Studio"],
    })
    .input(PaginationQuerySchema)
    .output(StudioListOutputSchema);

// ─── Member Contracts ─────────────────────────────────────────────────────────

export const addMemberContract = baseContract
    .input(CreateMemberSchema)
    .output(MemberOutputSchema);

export const updateMemberContract = baseContract
    .input(UpdateMemberSchema.extend({ id: IdParamSchema.shape.id }))
    .output(MemberOutputSchema);

export const removeMemberContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const getMemberContract = baseContract
    .input(IdParamSchema)
    .output(MemberOutputSchema);

export const getAllMembersContract = baseContract
    .input(StudioScopedQuerySchema)
    .output(MemberListOutputSchema);

export const updateStaffContract = baseContract
    .input(UpdateStaffSchema.extend({ memberId: z.string().min(1) }))
    .output(MemberOutputSchema);

// ─── Invitation Contracts ─────────────────────────────────────────────────────

export const inviteMemberContract = baseContract
    .input(InviteMemberSchema)
    .output(InvitationOutputSchema);

export const updateInvitationContract = baseContract
    .input(UpdateInvitationSchema.extend({ id: IdParamSchema.shape.id }))
    .output(InvitationOutputSchema);

export const cancelInvitationContract = baseContract
    .input(IdParamSchema)
    .output(DeleteOutputSchema);

export const acceptInvitationContract = baseContract
    .input(IdParamSchema)
    .output(SuccessOutputSchema);

export const getAllInvitationsContract = baseContract
    .input(StudioScopedQuerySchema)
    .output(InvitationListOutputSchema);
