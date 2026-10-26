"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { sendSMS } from "../termii";
import type { MemberRole } from "../schemas/studio";

const UpdateProfileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    image: z.string().optional(),
    phoneNumber: z.string().optional(),
});

export async function updateUserProfile(data: z.infer<typeof UpdateProfileSchema>) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        throw new Error("Unauthorized");
    }

    const validatedData = UpdateProfileSchema.parse(data);

    await db.update(schema.user)
        .set({
            name: validatedData.name,
            image: validatedData.image || null,
            phoneNumber: validatedData.phoneNumber || null,
        })
        .where(eq(schema.user.id, session.user.id));

    const user = await db.query.user.findFirst({
        where: eq(schema.user.id, session.user.id)
    });

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    
    return { success: true, user };
}

// ── Types for User Management ──────────────────────────────────────

export interface UserForManagement {
    id: string;
    name: string;
    email: string;
    image: string | null;
    phoneNumber: string | null;
    role: string;
    createdAt: string;
    emailVerified: boolean;
    members: {
        id: string;
        role: string;
        studioId: string;
        studio: {
            id: string;
            name: string;
            slug: string;
        };
    }[];
}

export interface ManagedStudio {
    id: string;
    name: string;
    slug: string;
}

export interface PendingInvitation {
    id: string;
    email: string;
    role: string | null;
    status: string;
    expiresAt: string;
    studioId: string;
    studio: {
        id: string;
        name: string;
    } | null;
}

// ── Get Users for Management ───────────────────────────────────────

export async function getUsersForManagement() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return { status: "error" as const, message: "Unauthorized", data: null };
        }

        const callerUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true }
        });
        const isPlatformAdmin = callerUser?.role === "admin";

        const callerMemberships = await db.query.member.findMany({
            where: eq(schema.member.userId, session.user.id),
            columns: { role: true, studioId: true }
        });

        const managementRoles = ["owner", "manager", "developer"];
        const managedStudioIds = callerMemberships
            .filter((m: { role: string }) => managementRoles.includes(m.role))
            .map((m: { studioId: string }) => m.studioId);

        if (!isPlatformAdmin && managedStudioIds.length === 0) {
            return {
                status: "error" as const,
                message: "Unauthorized: You must be an owner or manager to view user management.",
                data: null
            };
        }

        // Load studios caller has authority to manage
        const managedStudios = isPlatformAdmin
            ? await db.query.studio.findMany({
                columns: { id: true, name: true, slug: true },
                orderBy: (s, { asc }) => [asc(s.name)]
            })
            : await db.query.studio.findMany({
                where: inArray(schema.studio.id, managedStudioIds),
                columns: { id: true, name: true, slug: true },
                orderBy: (s, { asc }) => [asc(s.name)]
            });

        // Load all users with studio membership info
        const users = await db.query.user.findMany({
            orderBy: (u, { desc }) => [desc(u.createdAt)],
            columns: {
                id: true,
                name: true,
                email: true,
                image: true,
                phoneNumber: true,
                role: true,
                createdAt: true,
                emailVerified: true
            },
            with: {
                members: {
                    columns: {
                        id: true,
                        role: true,
                        studioId: true
                    },
                    with: {
                        studio: {
                            columns: {
                                id: true,
                                name: true,
                                slug: true
                            }
                        }
                    }
                }
            }
        });

        // Load pending invitations
        const invitations = await db.query.invitation.findMany({
            where: eq(schema.invitation.status, "pending"),
            columns: {
                id: true,
                email: true,
                role: true,
                status: true,
                expiresAt: true,
                studioId: true
            },
            with: {
                studio: {
                    columns: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        return {
            status: "success" as const,
            data: {
                users: users as unknown as UserForManagement[],
                managedStudios: managedStudios as ManagedStudio[],
                pendingInvitations: invitations as unknown as PendingInvitation[],
                isPlatformAdmin
            }
        };
    } catch (error) {
        console.error("[UserManagement] getUsersForManagement error:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to load users",
            data: null
        };
    }
}

// ── Assign User Directly to Studio ─────────────────────────────────

export async function assignUserToStudio(data: {
    userId: string;
    studioId: string;
    role: MemberRole;
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return { status: "error" as const, message: "Unauthorized" };
        }

        const callerUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true }
        });
        const isPlatformAdmin = callerUser?.role === "admin";

        const callerMembership = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, session.user.id),
                eq(schema.member.studioId, data.studioId)
            )
        });

        const allowedRoles = ["owner", "manager", "developer"];
        const canManageStudio = isPlatformAdmin || (callerMembership && allowedRoles.includes(callerMembership.role));

        if (!canManageStudio) {
            return {
                status: "error" as const,
                message: "Unauthorized: You do not have permission to assign members to this studio."
            };
        }

        // Only studio owners or platform admins can assign the Owner role
        if (data.role === "owner" && !isPlatformAdmin && callerMembership?.role !== "owner") {
            return {
                status: "error" as const,
                message: "Only studio owners or platform admins can assign the Owner role."
            };
        }

        // Verify target user exists
        const targetUser = await db.query.user.findFirst({
            where: eq(schema.user.id, data.userId)
        });
        if (!targetUser) {
            return { status: "error" as const, message: "User not found." };
        }

        // Check if user is already a member of this studio
        const existingMember = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, data.userId),
                eq(schema.member.studioId, data.studioId)
            )
        });
        if (existingMember) {
            return { status: "error" as const, message: "User is already a member of this studio." };
        }

        // Verify studio exists
        const studio = await db.query.studio.findFirst({
            where: eq(schema.studio.id, data.studioId),
            columns: { id: true, name: true, slug: true }
        });
        if (!studio) {
            return { status: "error" as const, message: "Studio not found." };
        }

        // Insert new member record
        const memberId = uuidv4();
        await db.insert(schema.member).values({
            id: memberId,
            userId: data.userId,
            studioId: data.studioId,
            role: data.role,
        });

        // Mark any pending invitation for this email and studio as accepted
        await db.update(schema.invitation)
            .set({ status: "accepted" })
            .where(
                and(
                    eq(schema.invitation.email, targetUser.email.toLowerCase()),
                    eq(schema.invitation.studioId, data.studioId),
                    eq(schema.invitation.status, "pending")
                )
            );

        // Send SMS notification if phone number is present
        if (targetUser.phoneNumber) {
            const roleName = data.role.charAt(0).toUpperCase() + data.role.slice(1);
            const smsMessage = `Welcome to GMAX! You have been granted access to ${studio.name} as a ${roleName}. You can now access your dashboard.`;
            await sendSMS(targetUser.phoneNumber, smsMessage).catch(err => {
                console.error("[UserManagement] Failed to send assignment SMS:", err);
            });
        }

        revalidatePath("/users");
        revalidatePath(`/studios/${studio.slug}`);
        revalidatePath("/", "layout");

        return {
            status: "success" as const,
            message: `Successfully assigned ${targetUser.name} as ${data.role} to ${studio.name}.`
        };
    } catch (error) {
        console.error("[UserManagement] assignUserToStudio error:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to assign user to studio."
        };
    }
}

// ── Remove User Membership ─────────────────────────────────────────

export async function removeUserMembership(memberId: string, studioId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return { status: "error" as const, message: "Unauthorized" };
        }

        const callerUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true }
        });
        const isPlatformAdmin = callerUser?.role === "admin";

        const callerMembership = await db.query.member.findFirst({
            where: and(
                eq(schema.member.userId, session.user.id),
                eq(schema.member.studioId, studioId)
            )
        });

        const allowedRoles = ["owner", "manager", "developer"];
        const canManageStudio = isPlatformAdmin || (callerMembership && allowedRoles.includes(callerMembership.role));

        if (!canManageStudio) {
            return {
                status: "error" as const,
                message: "Unauthorized: You do not have permission to manage this studio's members."
            };
        }

        const targetMember = await db.query.member.findFirst({
            where: eq(schema.member.id, memberId),
            with: { user: true }
        });

        if (!targetMember) {
            return { status: "error" as const, message: "Member not found." };
        }

        if (targetMember.role === "owner" && !isPlatformAdmin && callerMembership?.role !== "owner") {
            return { status: "error" as const, message: "Only studio owners or platform admins can remove an Owner." };
        }

        await db.delete(schema.member).where(eq(schema.member.id, memberId));

        revalidatePath("/users");
        revalidatePath("/", "layout");

        return {
            status: "success" as const,
            message: `Removed ${targetMember.user?.name || "member"} from the studio.`
        };
    } catch (error) {
        console.error("[UserManagement] removeUserMembership error:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to remove member."
        };
    }
}
