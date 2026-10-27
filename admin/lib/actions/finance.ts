"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

export type AddCashoutState =
    | { status: "success"; message: string }
    | { status: "error"; message: string }
    | null;

export async function addCashout(
    _previousState: AddCashoutState,
    formData: FormData,
): Promise<Exclude<AddCashoutState, null>> {
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const studioId = String(formData.get("studioId") ?? "");
    const amountInput = String(formData.get("amount") ?? "").trim();
    const expenseDateInput = String(formData.get("expenseDate") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!description || description.length > 120) {
        return { status: "error", message: "Enter a description of 1 to 120 characters." };
    }
    if (!category || category.length > 50) {
        return { status: "error", message: "Enter a category of 1 to 50 characters." };
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountInput)) {
        return { status: "error", message: "Enter an amount with no more than 2 decimal places." };
    }
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) {
        return { status: "error", message: "Enter an amount greater than zero." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDateInput)) {
        return { status: "error", message: "Select a valid cashout date." };
    }
    const expenseDate = new Date(`${expenseDateInput}T12:00:00`);
    if (Number.isNaN(expenseDate.getTime()) || expenseDate.toISOString().slice(0, 10) !== expenseDateInput) {
        return { status: "error", message: "Select a valid cashout date." };
    }
    if (!studioId) return { status: "error", message: "Select a studio." };
    if (notes.length > 500) return { status: "error", message: "Notes must be 500 characters or fewer." };

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { status: "error", message: "You must be signed in to record a cashout." };

    try {
        const [user, memberships] = await Promise.all([
            db.query.user.findFirst({
                where: eq(schema.user.id, session.user.id),
                columns: { role: true },
            }),
            db.query.member.findMany({
                where: eq(schema.member.userId, session.user.id),
                columns: { role: true, studioId: true },
            }),
        ]);
        const isPlatformAdmin = user?.role === "admin";
        const canManageStudio = memberships.some(
            (membership) =>
                membership.studioId === studioId &&
                ["owner", "manager", "developer"].includes(membership.role),
        );

        if (!isPlatformAdmin && !canManageStudio) {
            return { status: "error", message: "You do not have permission to record a cashout for this studio." };
        }

        await db.insert(schema.cashout).values({
            id: uuidv4(),
            studioId,
            description,
            category,
            amount: amount.toFixed(2),
            expenseDate: expenseDate.toISOString(),
            notes: notes || null,
            recordedById: session.user.id,
        });

        revalidatePath("/finances");
        return { status: "success", message: "Cashout recorded." };
    } catch (error) {
        console.error("[Finance] Failed to record cashout:", error);
        return { status: "error", message: "Cashout could not be recorded. Please try again." };
    }
}
