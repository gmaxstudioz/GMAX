"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { ApiResponse } from "../type";
import { prisma } from "../prisma";
import type { MemberRole } from "../schemas/studio";

// ── List Members ────────────────────────────────────────────────────

export async function listMembers(organizationId?: string) {
    try {
        const data = await auth.api.listMembers({
            query: { organizationId: organizationId ?? "" },
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] listMembers failed:", error);
        return { status: "error" as const, data: [] };
    }
}

// ── Remove Member ───────────────────────────────────────────────────

export async function removeMember(
    memberIdOrEmail: string,
    organizationId?: string,
): Promise<ApiResponse> {
    try {
        await auth.api.removeMember({
            body: {
                memberIdOrEmail,
                organizationId,
            },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Member removed successfully",
        };
    } catch (error) {
        console.error("[Action] removeMember failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to remove member",
        };
    }
}

// ── Update Member Role ──────────────────────────────────────────────

export async function updateMemberRole(
    memberId: string,
    role: MemberRole,
    organizationId?: string,
): Promise<ApiResponse> {
    try {
        await auth.api.updateMemberRole({
            body: {
                memberId,
                role,
                organizationId,
            },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Member role updated",
        };
    } catch (error) {
        console.error("[Action] updateMemberRole failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update member role",
        };
    }
}

// ── Get Active Member ───────────────────────────────────────────────

export async function getActiveMember() {
    try {
        const data = await auth.api.getActiveMember({
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] getActiveMember failed:", error);
        return { status: "error" as const, data: null };
    }
}

// ── Leave Organization ──────────────────────────────────────────────

export async function leaveOrganization(organizationId: string): Promise<ApiResponse> {
    try {
        await auth.api.leaveOrganization({
            body: { organizationId },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "You have left the studio",
        };
    } catch (error) {
        console.error("[Action] leaveOrganization failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to leave studio",
        };
    }
}

// ── Add Member Directly (no invitation) ─────────────────────────────

export async function addMember(
    userId: string,
    role: MemberRole,
    organizationId?: string,
): Promise<ApiResponse> {
    try {
        await auth.api.addMember({
            body: {
                userId,
                role,
                organizationId,
            },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Member added successfully",
        };
    } catch (error) {
        console.error("[Action] addMember failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to add member",
        };
    }
}

export async function FetchMemberDetails(memberId: string) {
    try {
        const data = await prisma.member.findUnique({
            where: {
                id: memberId,
            },
            include: {
                user: true,
                studio: true,
                bookings: true,
            }
        });

        return { status: "success", data };
    } catch (error) {
        console.error("[Action] FetchMemberDetails failed:", error);
        return { status: "error", data: null };
    }
}

// ── Update Staff Info ───────────────────────────────────────────────

export async function updateStaffInfo(
    memberId: string, 
    userId: string, 
    studioId: string,
    data: { role: MemberRole, phoneNumber?: string, name: string }
): Promise<ApiResponse> {
    try {
        await updateMemberRole(memberId, data.role, studioId);
        
        await prisma.user.update({
            where: { id: userId },
            data: { 
                name: data.name, 
                phoneNumber: data.phoneNumber || null 
            }
        });

        return {
            status: "success",
            message: "Staff member updated successfully",
        };
    } catch (error) {
        console.error("[Action] updateStaffInfo failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update staff member",
        };
    }
}
