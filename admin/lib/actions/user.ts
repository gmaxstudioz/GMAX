"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, inArray, notExists, or, not, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { sendSMS } from "../termii";
import { MemberRoleEnum, type MemberRole } from "../schemas/studio";

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
    phoneNumber?: string | null;
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
    role: string | null;
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

export interface PastMemberRecord {
    id: string;
    userId: string | null;
    studioId: string | null;
    name: string;
    email: string;
    phoneNumber: string | null;
    image: string | null;
    role: string;
    joinedAt: string;
    leftAt: string;
    removedById: string | null;
    removedByName: string | null;
    reason: string;
    totalBookings: number;
    createdAt: string;
    studio?: {
        id: string;
        name: string;
        slug: string;
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

        const isOwner = callerMemberships.some((m: { role: string }) => m.role === "owner");
        const canDeleteAccounts = isPlatformAdmin || isOwner;

        // Load studios caller has authority to manage
        const studios = isPlatformAdmin
            ? await db.query.studio.findMany({
                columns: { id: true, name: true, slug: true },
                orderBy: (s, { asc }) => [asc(s.name)]
            })
            : await db.query.studio.findMany({
                where: inArray(schema.studio.id, managedStudioIds),
                columns: { id: true, name: true, slug: true },
                orderBy: (s, { asc }) => [asc(s.name)]
            });
        const managedStudios: ManagedStudio[] = studios.map((studio) => ({
            ...studio,
            role: callerMemberships.find((membership) => membership.studioId === studio.id)?.role ?? null,
        }));

        // Load users with studio membership info for studios the caller can manage (excluding deleted accounts)
        const users = await db.query.user.findMany({
            where: and(
                not(eq(schema.user.role, "deleted")),
                isPlatformAdmin
                    ? undefined
                    : or(
                        inArray(
                            schema.user.id,
                            db.select({ userId: schema.member.userId })
                                .from(schema.member)
                                .where(inArray(schema.member.studioId, managedStudioIds)),
                        ),
                        notExists(
                            db.select({ id: schema.member.id })
                                .from(schema.member)
                                .where(eq(schema.member.userId, schema.user.id)),
                        ),
                    ),
            ),
            orderBy: (u, { desc }) => [desc(u.createdAt)],
            columns: {
                id: true,
                name: true,
                email: true,
                image: true,
                phoneNumber: isPlatformAdmin,
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
                    ...(isPlatformAdmin
                        ? {}
                        : {
                            where: (member, { inArray }) => inArray(member.studioId, managedStudioIds),
                        }),
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
            where: isPlatformAdmin
                ? eq(schema.invitation.status, "pending")
                : and(
                    eq(schema.invitation.status, "pending"),
                    inArray(schema.invitation.studioId, managedStudioIds),
                ),
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

        // Load past staff records for studios the caller manages
        const pastMembers = await db.query.pastMember.findMany({
            where: isPlatformAdmin
                ? undefined
                : or(
                    inArray(schema.pastMember.studioId, managedStudioIds),
                    isOwner ? and(
                        eq(schema.pastMember.removedById, session.user.id),
                        isNull(schema.pastMember.studioId),
                    ) : undefined
                ),
            with: {
                studio: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true
                    }
                }
            },
            orderBy: (pm, { desc }) => [desc(pm.leftAt)],
        });

        // Redact phoneNumber for non-platform-admin callers
        const sanitizedPastMembers = isPlatformAdmin
            ? pastMembers
            : pastMembers.map((pm) => ({ ...pm, phoneNumber: null }));

        return {
            status: "success" as const,
            data: {
                users: users as unknown as UserForManagement[],
                managedStudios: managedStudios as ManagedStudio[],
                pendingInvitations: invitations as unknown as PendingInvitation[],
                pastStaff: sanitizedPastMembers as unknown as PastMemberRecord[],
                isPlatformAdmin,
                canDeleteAccounts,
                currentUserId: session.user.id,
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
        const parsedRole = MemberRoleEnum.safeParse(data.role);
        if (!parsedRole.success) {
            return { status: "error" as const, message: "Invalid member role." };
        }
        const role = parsedRole.data;

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
        if (role === "owner" && !isPlatformAdmin && callerMembership?.role !== "owner") {
            return {
                status: "error" as const,
                message: "Only studio owners or platform admins can assign the Owner role."
            };
        }

        // Verify target user exists and is not deleted
        const targetUser = await db.query.user.findFirst({
            where: eq(schema.user.id, data.userId)
        });
        if (!targetUser) {
            return { status: "error" as const, message: "User not found." };
        }
        if (targetUser.role === "deleted") {
            return { status: "error" as const, message: "Cannot assign a deleted account to a studio." };
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
            role,
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
            const roleName = role.charAt(0).toUpperCase() + role.slice(1);
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
            message: `Successfully assigned ${targetUser.name} as ${role} to ${studio.name}.`
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
            columns: { id: true, name: true, role: true }
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
            where: and(eq(schema.member.id, memberId), eq(schema.member.studioId, studioId)),
            with: {
                user: true,
                studio: true,
                bookings: true,
            }
        });

        if (!targetMember) {
            return { status: "error" as const, message: "Member not found." };
        }

        if (targetMember.role === "owner") {
            if (!isPlatformAdmin && callerMembership?.role !== "owner") {
                return { status: "error" as const, message: "Only studio owners or platform admins can remove an Owner." };
            }
        }

        // Record who worked with us before and delete membership in one transaction
        await db.transaction(async (tx) => {
            if (targetMember.role === "owner") {
                const ownerRows = await tx
                    .select({ id: schema.member.id })
                    .from(schema.member)
                    .where(
                        and(
                            eq(schema.member.studioId, studioId),
                            eq(schema.member.role, "owner")
                        )
                    )
                    .for("update");

                const otherOwners = ownerRows.filter((r) => r.id !== memberId);
                if (otherOwners.length === 0) {
                    throw new Error("Cannot remove the only owner of this studio. Please assign another owner first.");
                }
            }

            await tx.insert(schema.pastMember).values({
                id: uuidv4(),
                userId: targetMember.userId,
                studioId: studioId,
                name: targetMember.user?.name || "Staff Member",
                email: targetMember.user?.email || "",
                phoneNumber: targetMember.user?.phoneNumber || null,
                image: targetMember.user?.image || null,
                role: targetMember.role,
                joinedAt: targetMember.createdAt,
                leftAt: new Date().toISOString(),
                removedById: session.user.id,
                removedByName: callerUser?.name || "Admin",
                reason: "REMOVED_FROM_STUDIO",
                totalBookings: targetMember.bookings?.length || 0,
            });

            await tx.delete(schema.member).where(
                and(eq(schema.member.id, memberId), eq(schema.member.studioId, studioId))
            );
        });

        if (targetMember.studio?.slug) {
            revalidatePath(`/studios/${targetMember.studio.slug}`);
        }
        revalidatePath("/users");
        revalidatePath("/studios");
        revalidatePath("/", "layout");

        return {
            status: "success" as const,
            message: `Removed ${targetMember.user?.name || "member"} from ${targetMember.studio?.name || "the studio"}. Work history preserved in Past Staff.`
        };
    } catch (error) {
        console.error("[UserManagement] removeUserMembership error:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to remove member."
        };
    }
}

// ── Delete User Account (Owner / Platform Admin Only) ───────────────

export async function deleteUserAccount(targetUserId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return { status: "error" as const, message: "Unauthorized" };
        }

        if (session.user.id === targetUserId) {
            return { status: "error" as const, message: "You cannot delete your own account." };
        }

        const callerUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { id: true, name: true, role: true }
        });
        const isPlatformAdmin = callerUser?.role === "admin";

        const callerMemberships = await db.query.member.findMany({
            where: eq(schema.member.userId, session.user.id),
            columns: { role: true, studioId: true }
        });

        const isOwner = callerMemberships.some((m) => m.role === "owner");
        const ownedStudioIds = callerMemberships
            .filter((m) => m.role === "owner")
            .map((m) => m.studioId);

        if (!isPlatformAdmin && !isOwner) {
            return {
                status: "error" as const,
                message: "Unauthorized: Only studio owners or platform admins can delete accounts."
            };
        }

        const targetUser = await db.query.user.findFirst({
            where: eq(schema.user.id, targetUserId),
            with: {
                members: {
                    with: {
                        studio: true,
                        bookings: true,
                    }
                }
            }
        });

        if (!targetUser) {
            return { status: "error" as const, message: "User not found." };
        }

        if (targetUser.role === "deleted") {
            return { status: "error" as const, message: "Account is already deleted." };
        }

        if (targetUser.role === "admin" && !isPlatformAdmin) {
            return {
                status: "error" as const,
                message: "Only platform administrators can delete another administrator account."
            };
        }

        const targetIsOwner = targetUser.members.some((m) => m.role === "owner");
        if (targetIsOwner && !isPlatformAdmin && !isOwner) {
            return {
                status: "error" as const,
                message: "Only studio owners or platform admins can delete an Owner's account."
            };
        }

        // If caller is an owner (not platform admin), ensure target belongs to their owned studio or is unassigned
        if (!isPlatformAdmin) {
            const hasForeignStudio = targetUser.members.some((m) => !ownedStudioIds.includes(m.studioId));
            if (hasForeignStudio) {
                return {
                    status: "error" as const,
                    message: "You can only delete accounts of staff in studios you own or unassigned users."
                };
            }
        }

        // Execute archive inserts, credential/session cleanup, and user update within one transaction
        await db.transaction(async (tx) => {
            // Verify each affected studio will retain another owner under row lock
            const ownerMemberships = targetUser.members.filter((m) => m.role === "owner");
            const sortedOwnerMemberships = [...ownerMemberships].sort((a, b) => a.studioId.localeCompare(b.studioId));
            for (const om of sortedOwnerMemberships) {
                const ownerRows = await tx
                    .select({ id: schema.member.id, userId: schema.member.userId })
                    .from(schema.member)
                    .where(
                        and(
                            eq(schema.member.studioId, om.studioId),
                            eq(schema.member.role, "owner")
                        )
                    )
                    .for("update");

                const otherOwners = ownerRows.filter((r) => r.userId !== targetUserId);
                if (otherOwners.length === 0) {
                    throw new Error(
                        `Cannot delete account: user is the sole owner of ${om.studio?.name || "a studio"}. Assign another owner before deleting.`
                    );
                }
            }

            // 1. Record in past_member for all studios the user was part of
            for (const m of targetUser.members) {
                await tx.insert(schema.pastMember).values({
                    id: uuidv4(),
                    userId: targetUser.id,
                    studioId: m.studioId,
                    name: targetUser.name,
                    email: targetUser.email,
                    phoneNumber: targetUser.phoneNumber || null,
                    image: targetUser.image || null,
                    role: m.role,
                    joinedAt: m.createdAt,
                    leftAt: new Date().toISOString(),
                    removedById: session.user.id,
                    removedByName: callerUser?.name || "Owner",
                    reason: "ACCOUNT_DELETED",
                    totalBookings: m.bookings?.length || 0,
                });
            }

            // If user had no studio memberships (unassigned user), record an archive entry with no studio
            if (targetUser.members.length === 0) {
                await tx.insert(schema.pastMember).values({
                    id: uuidv4(),
                    userId: targetUser.id,
                    studioId: null,
                    name: targetUser.name,
                    email: targetUser.email,
                    phoneNumber: targetUser.phoneNumber || null,
                    image: targetUser.image || null,
                    role: targetUser.role || "user",
                    joinedAt: targetUser.createdAt,
                    leftAt: new Date().toISOString(),
                    removedById: session.user.id,
                    removedByName: callerUser?.name || "Owner",
                    reason: "ACCOUNT_DELETED",
                    totalBookings: 0,
                });
            }

            // 2. Clean up credentials, active sessions, invitations, and memberships
            await tx.delete(schema.session).where(eq(schema.session.userId, targetUserId));
            await tx.delete(schema.account).where(eq(schema.account.userId, targetUserId));
            await tx.delete(schema.verification).where(eq(schema.verification.identifier, targetUser.email.toLowerCase()));

            if (isPlatformAdmin) {
                await tx.delete(schema.invitation).where(eq(schema.invitation.email, targetUser.email.toLowerCase()));
            } else if (ownedStudioIds.length > 0) {
                await tx.delete(schema.invitation).where(
                    and(
                        eq(schema.invitation.email, targetUser.email.toLowerCase()),
                        inArray(schema.invitation.studioId, ownedStudioIds),
                    )
                );
            }

            await tx.delete(schema.bookingBackfillAccess).where(eq(schema.bookingBackfillAccess.userId, targetUserId));
            await tx.delete(schema.member).where(eq(schema.member.userId, targetUserId));
            await tx.delete(schema.userNotification).where(eq(schema.userNotification.userId, targetUserId));

            // 3. Mark user row as deleted, scramble email to release unique constraint while preserving foreign key integrity
            await tx.update(schema.user)
                .set({
                    role: "deleted",
                    email: `deleted_${Date.now()}_${targetUser.email}`,
                    phoneNumber: null,
                })
                .where(eq(schema.user.id, targetUserId));
        });

        for (const m of targetUser.members) {
            if (m.studio?.slug) {
                revalidatePath(`/studios/${m.studio.slug}`);
            }
        }
        revalidatePath("/users");
        revalidatePath("/studios");
        revalidatePath("/", "layout");

        return {
            status: "success" as const,
            message: `Successfully deleted account for ${targetUser.name}. A record of their work history has been preserved in Past Staff.`
        };
    } catch (error) {
        console.error("[UserManagement] deleteUserAccount error:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to delete account."
        };
    }
}

// ── Get Studio Past Members ─────────────────────────────────────────

export async function getStudioPastMembers(studioId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return { status: "error" as const, data: [] };
        }

        // Authorize: caller must hold a management-level role in this studio
        const permittedRoles = ["owner", "manager", "developer"];
        const callerUser = await db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true },
        });
        const isPlatformAdmin = callerUser?.role === "admin";

        if (!isPlatformAdmin) {
            const callerMembership = await db.query.member.findFirst({
                where: and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.studioId, studioId),
                ),
                columns: { role: true },
            });
            if (!callerMembership || !permittedRoles.includes(callerMembership.role)) {
                return { status: "error" as const, data: [] };
            }
        }

        const pastMembers = await db.query.pastMember.findMany({
            where: eq(schema.pastMember.studioId, studioId),
            orderBy: (pm, { desc }) => [desc(pm.leftAt)],
        });

        // Redact phoneNumber for non-platform-admin callers
        const sanitized = isPlatformAdmin
            ? pastMembers
            : pastMembers.map((pm) => ({ ...pm, phoneNumber: null }));

        return { status: "success" as const, data: sanitized as PastMemberRecord[] };
    } catch (error) {
        console.error("[UserManagement] getStudioPastMembers error:", error);
        return { status: "error" as const, data: [] };
    }
}
