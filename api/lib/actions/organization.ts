"use server";

import { auth } from "../auth";
import { headers } from "next/headers";
import { CreateStudioSchema, CreateStudioSchemaType, UpdateStudioSchema, UpdateStudioInput } from "../schemas/studio";
import { ApiResponse } from "../type";

// ── Create Studio ───────────────────────────────────────────────────

export async function CreateStudio(values: CreateStudioSchemaType): Promise<ApiResponse> {
    try {
        const validation = CreateStudioSchema.safeParse(values);

        if (!validation.success) {
            return {
                status: "error",
                message: validation.error.issues[0]?.message ?? "Invalid data",
            };
        }

        const { name, slug, logo, metadata } = validation.data;

        await auth.api.createOrganization({
            body: {
                name,
                slug,
                logo: logo ?? undefined,
                metadata: metadata ?? undefined,
            },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Studio created successfully",
        };
    } catch (error) {
        console.error("[Action] createStudio failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to create studio",
        };
    }
}

// ── Update Studio ───────────────────────────────────────────────────

export async function updateStudio(
    organizationId: string,
    values: UpdateStudioInput,
): Promise<ApiResponse> {
    try {
        const validation = UpdateStudioSchema.safeParse(values);

        if (!validation.success) {
            return {
                status: "error",
                message: validation.error.issues[0]?.message ?? "Invalid data",
            };
        }

        await auth.api.updateOrganization({
            body: {
                organizationId,
                data: {
                    name: validation.data.name,
                    slug: validation.data.slug,
                    logo: validation.data.logo,
                    metadata: validation.data.metadata,
                },
            },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Studio updated successfully",
        };
    } catch (error) {
        console.error("[Action] updateStudio failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update studio",
        };
    }
}

// ── Delete Studio ───────────────────────────────────────────────────

export async function deleteStudio(organizationId: string): Promise<ApiResponse> {
    try {
        await auth.api.deleteOrganization({
            body: { organizationId },
            headers: await headers(),
        });

        return {
            status: "success",
            message: "Studio deleted successfully",
        };
    } catch (error) {
        console.error("[Action] deleteStudio failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to delete studio",
        };
    }
}

// ── Get Full Studio ─────────────────────────────────────────────────

export async function getStudio(params?: {
    organizationId?: string;
    organizationSlug?: string;
}) {
    try {
        const data = await auth.api.getFullOrganization({
            query: {
                organizationId: params?.organizationId,
                organizationSlug: params?.organizationSlug,
            },
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] getStudio failed:", error);
        return { status: "error" as const, data: null };
    }
}

// ── List User Studios ───────────────────────────────────────────────

export async function listStudios() {
    try {
        const data = await auth.api.listOrganizations({
            headers: await headers(),
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] listStudios failed:", error);
        return { status: "error" as const, data: [] };
    }
}

// ── Set Active Studio ───────────────────────────────────────────────

export async function setActiveStudio(
    organizationId: string | null,
): Promise<ApiResponse> {
    try {
        await auth.api.setActiveOrganization({
            body: { organizationId },
            headers: await headers(),
        });

        return {
            status: "success",
            message: organizationId
                ? "Active studio updated"
                : "Active studio cleared",
        };
    } catch (error) {
        console.error("[Action] setActiveStudio failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to set active studio",
        };
    }
}

// ── Check Slug ──────────────────────────────────────────────────────

export async function checkStudioSlug(slug: string) {
    try {
        const data = await auth.api.checkOrganizationSlug({
            body: { slug },
        });

        return { status: "success" as const, data };
    } catch (error) {
        console.error("[Action] checkStudioSlug failed:", error);
        return { status: "error" as const, data: null };
    }
}
