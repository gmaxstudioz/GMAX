"use server";

import { Client } from "../schemas/client";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { ApiResponse } from "../type";
import { requireSession, requireStudioMember } from "./with-auth";
import { v4 as uuidv4 } from "uuid";

// ── Create Client ────────────────────────────────────────────────────────────

export async function CreateClient(values: Client, studioId: string): Promise<ApiResponse> {
    try {
        const auth = await requireStudioMember(studioId);
        if (auth.status === "error") return auth;

        const allowedRoles = ["owner", "admin", "manager", "receptionist", "developer"];
        if (!allowedRoles.includes(auth.member.role)) {
            return { status: "error", message: "Unauthorized: You do not have permission to create clients" };
        }

        const [newClient] = await db.insert(schema.client).values({
            id: uuidv4(),
            name: values.name,
            email: values.email,
            phone: values.phone,
            address: values.address,
            notes: values.notes,
            type: values.type,
            studioId,
        }).returning();

        return { status: "success", message: "Client created successfully", data: newClient };
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
        const client = await db.query.client.findFirst({ where: eq(schema.client.id, clientId) });
        if (!client) return { status: "error", message: "Client not found" };

        // Verify the caller belongs to the studio that owns this client
        const auth = await requireStudioMember(client.studioId);
        if (auth.status === "error") return auth;

        await db.delete(schema.client).where(eq(schema.client.id, clientId));

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
        const existing = await db.query.client.findFirst({ where: eq(schema.client.id, clientId) });
        if (!existing) return { status: "error", message: "Client not found" };

        const auth = await requireStudioMember(existing.studioId);
        if (auth.status === "error") return auth;

        const allowedRoles = ["owner", "admin", "manager", "developer"];
        if (!allowedRoles.includes(auth.member.role)) {
            return { status: "error", message: "Unauthorized: You do not have permission to update clients" };
        }

        await db.update(schema.client)
            .set({
                name: values.name,
                email: values.email,
                phone: values.phone,
                address: values.address,
                notes: values.notes,
                type: values.type,
            })
            .where(eq(schema.client.id, clientId));

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
            where: eq(schema.client.studioId, studioId),
            orderBy: [desc(schema.client.createdAt)],
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
