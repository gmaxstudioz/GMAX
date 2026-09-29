import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, phoneNumber } from "better-auth/plugins";
import { PostHog } from "posthog-node";
import { db } from "./db";
import * as schema from "./schema";
import { sendInvitationEmail } from "./termii";
import { studioAc, photographer, videographer, receptionist, manager, owner, developer } from "./permissions";

const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

let posthogClient: PostHog | null | undefined;

export function getPostHogClient(): PostHog | null {
    if (posthogClient !== undefined) {
        return posthogClient;
    }

    const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!projectToken || !host) {
        if (process.env.NODE_ENV === "development") {
            const missingVariable = !projectToken
                ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
                : "NEXT_PUBLIC_POSTHOG_HOST";
            throw new Error(
                `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
            );
        }

        posthogClient = null;
        return posthogClient;
    }

    posthogClient = new PostHog(projectToken, {
        host,
        enableExceptionAutocapture: true,
        flushAt: 1,
        flushInterval: 0,
    });

    return posthogClient;
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
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
            // Map Better Auth's "organization" to your existing "studio" table
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