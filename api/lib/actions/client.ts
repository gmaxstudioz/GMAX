"use server";

import { Client } from "../schemas/client";
import { prisma } from "../prisma";
import { ApiResponse } from "../type";

export async function CreateClient(values: Client, studioId: string): Promise<ApiResponse> {
    try {
        await prisma.client.create({
            data: {
                name: values.name,
                email: values.email,
                phone: values.phone,
                address: values.address,
                notes: values.notes,
                type: values.clientType,
                studio: {
                    connect: {
                        id: studioId
                    }
                },
            }
        });

        return {
            status: "success",
            message: "Client created successfully",
        }
    } catch (error) {
        console.error("[Action] Create Client failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to create client",
        }
    }
}

export async function DeleteClient(clientId: string): Promise<ApiResponse> {
    try {
        await prisma.client.delete({
            where: {
                id: clientId
            }
        });

        return {
            status: "success",
            message: "Client deleted successfully",
        }
    } catch (error) {
        console.error("[Action] Delete Client failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to delete client",
        }
    }
}

export async function UpdateClient(values: Client, clientId: string): Promise<ApiResponse> {
    try {
        await prisma.client.update({
            where: {
                id: clientId
            },
            data: {
                name: values.name,
                email: values.email,
                phone: values.phone,
                address: values.address,
                notes: values.notes,
                type: values.clientType,
            }
        });

        return {
            status: "success",
            message: "Client updated successfully",
        }
    } catch (error) {
        console.error("[Action] Update Client failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to update client",
        }
    }
}

export async function FetchClient(): Promise<ApiResponse> {
    try {
        await prisma.client.findMany();
        return {
            status: "success",
            message: "Client fetched successfully",
        }
    } catch (error) {
        console.error("[Action] Fetch Client failed:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch client",
        }
    }
}