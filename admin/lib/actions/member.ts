"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { ApiResponse } from "../type";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and } from "drizzle-orm";
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
            body: { memberIdOrEmail, organizationId },
            headers: await headers(),
        });

        return { status: "success", message: "Member removed successfully" };
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
            body: { memberId, role, organizationId },
            headers: await headers(),
        });

        return { status: "success", message: "Member role updated" };
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
        const data = await auth.api.getActiveMember({ headers: await headers() });
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

        return { status: "success", message: "You have left the studio" };
    } catch (error) {
        console.error("[Action] leaveOrganization failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to leave studio",
        };
    }
}

// ── Add Member Directly ─────────────────────────────────────────────

export async function addMember(
    userId: string,
    role: MemberRole,
    organizationId?: string,
): Promise<ApiResponse> {
    try {
        await auth.api.addMember({
            body: { userId, role, organizationId },
            headers: await headers(),
        });

        return { status: "success", message: "Member added successfully" };
    } catch (error) {
        console.error("[Action] addMember failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to add member",
        };
    }
}

// ── Fetch Member Details ────────────────────────────────────────────

export async function FetchMemberDetails(memberId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return { status: "error", data: null, message: "Unauthorized" };
        }

        const data = await db.query.member.findFirst({
            where: eq(schema.member.id, memberId),
            with: { user: true, studio: true, bookings: true },
        });
        if (!data) {
            return { status: "error", data: null, message: "Member not found" };
        }

        const dbUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true },
        });
        const isPlatformAdmin = dbUser?.role === "admin";
        const isSelf = data.userId === session.user.id;

        if (!isPlatformAdmin && !isSelf) {
            const callerMember = await db.query.member.findFirst({
                where: and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.studioId, data.studioId),
                ),
                columns: { role: true },
            });
            if (!callerMember || !["owner", "developer", "manager"].includes(callerMember.role)) {
                return { status: "error", data: null, message: "Unauthorized" };
            }
        }

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
    data: { role: MemberRole; phoneNumber?: string; name: string },
): Promise<ApiResponse> {
    try {
        const reqHeaders = await headers();
        const session = await auth.api.getSession({ headers: reqHeaders });
        if (!session?.user) {
            return { status: "error", message: "Unauthorized" };
        }

        const [callerUser, callerMember, targetMember] = await Promise.all([
            db.query.user.findFirst({
                where: eq(schema.user.id, session.user.id),
                columns: { role: true },
            }),
            db.query.member.findFirst({
                where: and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.studioId, studioId),
                ),
                columns: { role: true },
            }),
            db.query.member.findFirst({
                where: and(
                    eq(schema.member.id, memberId),
                    eq(schema.member.studioId, studioId),
                    eq(schema.member.userId, userId),
                ),
                columns: { id: true, role: true },
            }),
        ]);

        if (!targetMember) {
            return { status: "error", message: "Staff member not found in this studio" };
        }

        const isPlatformAdmin = callerUser?.role === "admin";
        if (!isPlatformAdmin) {
            if (!callerMember || !["owner", "developer", "manager"].includes(callerMember.role)) {
                return { status: "error", message: "Unauthorized: insufficient permissions" };
            }
            if ((targetMember.role === "owner" || data.role === "owner") && callerMember.role !== "owner") {
                return { status: "error", message: "Unauthorized: only a studio owner can manage owner roles" };
            }
        }

        const roleResult = await updateMemberRole(memberId, data.role, studioId);
        if (roleResult.status === "error") {
            return {
                status: "error",
                message: roleResult.message || "Failed to update member role",
            };
        }

        await db.update(schema.user)
            .set({
                name: data.name,
                phoneNumber: data.phoneNumber || null,
            })
            .where(eq(schema.user.id, userId));

        return { status: "success", message: "Staff member updated successfully" };
    } catch (error) {
        console.error("[Action] updateStaffInfo failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update staff member",
        };
    }
}