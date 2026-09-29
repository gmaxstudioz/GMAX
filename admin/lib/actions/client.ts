"use server";

import { Client } from "../schemas/client";
import { db } from "../db";
import { client } from "../schema";
import { eq } from "drizzle-orm";
import { ApiResponse } from "../type";
import { requireSession, requireStudioMember } from "./with-auth";

// ── Create Client ────────────────────────────────────────────────────────────

export async function CreateClient(values: Client, studioId: string): Promise<ApiResponse> {
    try {
        // Verify caller is a member of this studio before creating
        const auth = await requireStudioMember(studioId);
        if (auth.status === "error") return auth;

        await db.insert(client).values({
            id: crypto.randomUUID(),
            name: values.name,
            email: values.email,
            phone: values.phone,
            address: values.address,
            notes: values.notes,
            type: values.type,
            studioId: studioId,
        });

        return { status: "success", message: "Client created successfully" };
    } catch (error) {
        console.error("[Action] CreateClient failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to create client",
        };
    }
}

// ── Delete Client ────────────────────────────────────────────────────────────

export async function DeleteClient(clientId: string): Promise<ApiResponse> {
    try {
        const sessionResult = await requireSession();
        if (sessionResult.status === "error") return sessionResult;

        // Fetch first to get the studioId — we need it to verify membership
        const clientRec = await db.query.client.findFirst({
            where: eq(client.id, clientId)
        });
        if (!clientRec) return { status: "error", message: "Client not found" };

        // Verify the caller belongs to the studio that owns this client
        const auth = await requireStudioMember(clientRec.studioId);
        if (auth.status === "error") return auth;

        await db.delete(client).where(eq(client.id, clientId));

        return { status: "success", message: "Client deleted successfully" };
    } catch (error) {
        console.error("[Action] DeleteClient failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to delete client",
        };
    }
}

// ── Update Client ────────────────────────────────────────────────────────────

export async function UpdateClient(values: Client, clientId: string): Promise<ApiResponse> {
    try {
        const sessionResult = await requireSession();
        if (sessionResult.status === "error") return sessionResult;

        // Fetch first to get the studioId for ownership check
        const existing = await db.query.client.findFirst({
            where: eq(client.id, clientId)
        });
        if (!existing) return { status: "error", message: "Client not found" };

        const auth = await requireStudioMember(existing.studioId);
        if (auth.status === "error") return auth;

        await db.update(client).set({
            name: values.name,
            email: values.email,
            phone: values.phone,
            address: values.address,
            notes: values.notes,
            type: values.type,
        }).where(eq(client.id, clientId));

        return { status: "success", message: "Client updated successfully" };
    } catch (error) {
        console.error("[Action] UpdateClient failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update client",
        };
    }
}

// ── Fetch Clients ────────────────────────────────────────────────────────────

export async function FetchClients(studioId: string) {
    try {
        const auth = await requireStudioMember(studioId);
        if (auth.status === "error") return { status: "error" as const, message: auth.message, data: [] };

        const data = await db.query.client.findMany({
            where: eq(client.studioId, studioId),
            orderBy: (client, { desc }) => [desc(client.createdAt)],
        });

        return { status: "success" as const, message: "Clients fetched successfully", data };
    } catch (error) {
        console.error("[Action] FetchClients failed:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to fetch clients",
            data: [],
        };
    }
}
