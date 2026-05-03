import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, phoneNumber } from "better-auth/plugins";
import { prisma } from "./prisma";
import { sendInvitationEmail } from "./termii";
import { studioAc, photographer, videographer, receptionist, manager, owner, developer } from "./permissions";

const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        phoneNumber(),
        organization({
            // ── Custom roles ────────────────────────────────────────────
            ac: studioAc,
            roles: {
                manager,
                owner,
                developer,
                photographer,
                videographer,
                receptionist,
            },
            // ── Schema mapping ──────────────────────────────────────────
            schema: {
                organization: {
                    modelName: "studio",
                },
                member: {
                    modelName: "member",
                    fields: {
                        organizationId: "studioId",
                    }
                },
                invitation: {
                    modelName: "invitation",
                    fields: {
                        organizationId: "studioId",
                    }
                }
            },

            // ── Invitation email via Termii ─────────────────────────────
            async sendInvitationEmail(data) {
                const inviteLink = `${BASE_URL}/auth/accept-invitation/${data.id}`;

                try {
                    await sendInvitationEmail({
                        email: data.email,
                        inviterName: data.inviter.user.name,
                        studioName: data.organization.name,
                        role: data.role ?? "member",
                        inviteLink,
                    });
                } catch (error) {
                    console.error("[Auth] Failed to send invitation email:", error);
                }
            },

            // ── Hooks ───────────────────────────────────────────────────
            organizationHooks: {
                // Set 7-day expiration on invitations
                beforeCreateInvitation: async ({ invitation }) => {
                    const sevenDays = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
                    return {
                        data: {
                            ...invitation,
                            expiresAt: sevenDays,
                        },
                    };
                },

                // Log new members
                afterAddMember: async ({ user, organization }) => {
                    console.log(`[Studio] ${user.email} joined ${organization.name}`);
                },

                // Log member removal
                afterRemoveMember: async ({ user, organization }) => {
                    console.log(`[Studio] ${user.email} was removed from ${organization.name}`);
                },
            },
        }),
    ],
});