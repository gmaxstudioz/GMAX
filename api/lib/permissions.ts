/**
 * GMAX Studioz — Access Control & Permissions
 *
 * Defines custom roles beyond Better Auth's defaults (owner / admin / member).
 * These roles are used by the organization plugin on both server and client.
 *
 * @see https://better-auth.com/docs/plugins/organization#access-control
 */

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, defaultRoles } from "better-auth/plugins/organization/access";

/**
 * Studio-specific statements (permissions).
 * Extend the defaults (organization CRUD, member CRUD, invitation CRUD)
 * with any studio-specific resource permissions you need.
 */

const studioStatements = {
    ...defaultStatements,
    studio: ["create", "share", "update", "delete",  "read"],
    studioMember: ["create", "share", "update", "delete",  "read"],
    studioInvitation: ["create", "share", "update", "delete",  "read"],
    studioCategory: ["create", "share", "update", "delete",  "read"],
    studioSession: ["create", "share", "update", "delete",  "read"],
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
} as const;

/**
 * Access control instance with custom roles.
 * Each role inherits all default permissions, plus any overrides you add.
 */
export const studioAc = createAccessControl(studioStatements);

/**
 * Custom role definitions.
 * All roles get the same base permissions for now — you can restrict per-role later.
 */

export const owner = studioAc.newRole({
    ...defaultRoles.owner.statements,
    studio: ["create", "share", "update", "delete",  "read"],
    studioMember: ["create", "share", "update", "delete",  "read"],
    studioInvitation: ["create", "share", "update", "delete",  "read"],
    studioCategory: ["create", "share", "update", "delete",  "read"],
    studioSession: ["create", "share", "update", "delete",  "read"],
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
});

export const developer = studioAc.newRole({
    ...defaultRoles.admin.statements,
    studio: ["create", "share", "update", "delete",  "read"],
    studioMember: ["create", "share", "update", "delete",  "read"],
    studioInvitation: ["create", "share", "update", "delete",  "read"],
    studioCategory: ["create", "share", "update", "delete",  "read"],
    studioSession: ["create", "share", "update", "delete",  "read"],
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
});

export const manager = studioAc.newRole({
    ...defaultRoles.admin.statements,
    studio: ["create", "share", "update", "delete",  "read"],
    studioMember: ["create", "share", "update", "delete",  "read"],
    studioInvitation: ["create", "share", "update", "delete",  "read"],
    studioCategory: ["create", "share", "update", "delete",  "read"],
    studioSession: ["create", "share", "update", "delete",  "read"],
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
});

export const photographer = studioAc.newRole({
    ...defaultRoles.member.statements,
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
});

export const videographer = studioAc.newRole({
    ...defaultRoles.member.statements,
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
});

export const receptionist = studioAc.newRole({
    ...defaultRoles.member.statements,
    studioClient: ["create", "share", "update", "delete",  "read"],
    studioBooking: ["create", "share", "update", "delete",  "read"],
});
