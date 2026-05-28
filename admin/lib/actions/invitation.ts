"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { InviteMemberSchema, InviteMemberInput } from "../schemas/studio";
import { ApiResponse } from "../type";
import { sendSMS } from "../termii";

// ── Invite Member ───────────────────────────────────────────────────

export async function inviteMember(
    values: InviteMemberInput,
    organizationId?: string,
): Promise<ApiResponse> {
    try {
        const validation = InviteMemberSchema.safeParse(values);

        if (!validation.success) {
            return {
                status: "error",
                message: validation.error.issues[0]?.message ?? "Invalid data",
            };
        }

        const invitation = await auth.api.createInvitation({
            body: {
                email: validation.data.email,
                role: validation.data.role,
                organizationId,
            },
            headers: await headers(),
        });

        if (validation.data.phone && invitation) {
            // @ts-expect-error - BetterAuth response typing might be complex
            const inviteId = invitation.id || invitation.invitation?.id;
            const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
            const inviteLink = `${BASE_URL}/auth/accept-invitation/${inviteId}`;
            const msg = `You have been invited to join the studio as a ${validation.data.role}. Click here to accept: ${inviteLink}`;
            await sendSMS(validation.data.phone, msg).catch(e => console.error("Termii invite SMS failed", e));
        }

        return {
            status: "success",
            message: `Invitation sent to ${validation.data.email}`,
        };
    } catch (error) {
        console.error("[Action] inviteMember failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to send invitation",
        };
    }
}

// ── Accept Invitation ───────────────────────────────────────────────

export async function acceptInvitation(invitationId: string): Promise<ApiResponse> {
    try {
        await auth.api.acceptInvitation({
            body: { invitationId },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Invitation accepted",
        };
    } catch (error) {
        console.error("[Action] acceptInvitation failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to accept invitation",
        };
    }
}

// ── Reject Invitation ───────────────────────────────────────────────

export async function rejectInvitation(invitationId: string): Promise<ApiResponse> {
    try {
        await auth.api.rejectInvitation({
            body: { invitationId },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Invitation rejected",
        };
    } catch (error) {
        console.error("[Action] rejectInvitation failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to reject invitation",
        };
    }
}

// ── Cancel Invitation ───────────────────────────────────────────────

export async function cancelInvitation(invitationId: string): Promise<ApiResponse> {
    try {
        await auth.api.cancelInvitation({
            body: { invitationId },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Invitation cancelled",
        };
    } catch (error) {
        console.error("[Action] cancelInvitation failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to cancel invitation",
        };
    }
}

// ── Get Invitation ──────────────────────────────────────────────────

export async function getInvitation(invitationId: string) {
    try {
        const data = await auth.api.getInvitation({
            query: { id: invitationId },
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] getInvitation failed:", error);
        return { status: "error" as const, data: null };
    }
}

// ── List Invitations (for an organization) ──────────────────────────

export async function listInvitations(organizationId?: string) {
    try {
        const data = await auth.api.listInvitations({
            query: { organizationId: organizationId ?? "" },
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] listInvitations failed:", error);
        return { status: "error" as const, data: [] };
    }
}

// ── List User Invitations (invitations this user has received) ──────

export async function listUserInvitations() {
    try {
        const data = await auth.api.listUserInvitations({
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] listUserInvitations failed:", error);
        return { status: "error" as const, data: [] };
    }
}
