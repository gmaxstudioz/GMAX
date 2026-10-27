"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";

type CashoutInput = {
    description: string;
    category: string;
    studioId: string;
    amount: string;
    expenseDate: string;
    notes: string;
};

function parseCashoutForm(
    formData: FormData,
): { ok: true; data: CashoutInput } | { ok: false; error: string } {
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const studioId = String(formData.get("studioId") ?? "");
    const amountInput = String(formData.get("amount") ?? "").trim();
    const expenseDateInput = String(formData.get("expenseDate") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!description || description.length > 120) {
        return { ok: false, error: "Enter a description of 1 to 120 characters." };
    }
    if (!category || category.length > 50) {
        return { ok: false, error: "Enter a category of 1 to 50 characters." };
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountInput)) {
        return { ok: false, error: "Enter an amount with no more than 2 decimal places." };
    }
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) {
        return { ok: false, error: "Enter an amount greater than zero." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDateInput)) {
        return { ok: false, error: "Select a valid cashout date." };
    }
    const expenseDate = new Date(`${expenseDateInput}T12:00:00`);
    if (Number.isNaN(expenseDate.getTime()) || expenseDate.toISOString().slice(0, 10) !== expenseDateInput) {
        return { ok: false, error: "Select a valid cashout date." };
    }
    if (!studioId) return { ok: false, error: "Select a studio." };
    if (notes.length > 500) return { ok: false, error: "Notes must be 500 characters or fewer." };

    return {
        ok: true,
        data: {
            description,
            category,
            studioId,
            amount: amount.toFixed(2),
            expenseDate: expenseDate.toISOString(),
            notes: notes || "",
        },
    };
}

async function getFinanceAccess(studioId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { ok: false as const, error: "You must be signed in to manage cashouts." };

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
            ["owner", "manager", "receptionist", "developer"].includes(membership.role),
    );

    if (!isPlatformAdmin && !canManageStudio) {
        return { ok: false as const, error: "You do not have permission to manage cashouts for this studio." };
    }

    return { ok: true as const, session };
}

export type AddCashoutState =
    | { status: "success"; message: string }
    | { status: "error"; message: string }
    | null;

export async function addCashout(
    _previousState: AddCashoutState,
    formData: FormData,
): Promise<Exclude<AddCashoutState, null>> {
    const parsed = parseCashoutForm(formData);
    if (!parsed.ok) return { status: "error", message: parsed.error };
    const input = parsed.data;

    try {
        const access = await getFinanceAccess(input.studioId);
        if (!access.ok) return { status: "error", message: access.error };

        await db.insert(schema.cashout).values({
            id: uuidv4(),
            ...input,
            notes: input.notes || null,
            recordedById: access.session.user.id,
        });

        revalidatePath("/finances");
        return { status: "success", message: "Cashout recorded." };
    } catch (error) {
        console.error("[Finance] Failed to record cashout:", error);
        return { status: "error", message: "Cashout could not be recorded. Please try again." };
    }
}

export async function updateCashout(
    cashoutId: string,
    formData: FormData,
): Promise<Exclude<AddCashoutState, null>> {
    if (!cashoutId || cashoutId.length > 100) {
        return { status: "error", message: "Invalid cashout." };
    }
    const parsed = parseCashoutForm(formData);
    if (!parsed.ok) return { status: "error", message: parsed.error };
    const input = parsed.data;

    try {
        const [cashout, access] = await Promise.all([
            db.query.cashout.findFirst({ where: eq(schema.cashout.id, cashoutId) }),
            getFinanceAccess(input.studioId),
        ]);
        if (!cashout) return { status: "error", message: "Cashout not found." };
        if (!access.ok) return { status: "error", message: access.error };

        const originalStudioAccess = await getFinanceAccess(cashout.studioId);
        if (!originalStudioAccess.ok) {
            return { status: "error", message: originalStudioAccess.error };
        }

        await db.update(schema.cashout)
            .set({
                ...input,
                notes: input.notes || null,
            })
            .where(eq(schema.cashout.id, cashoutId));

        revalidatePath("/finances");
        return { status: "success", message: "Cashout updated." };
    } catch (error) {
        console.error("[Finance] Failed to update cashout:", error);
        return { status: "error", message: "Cashout could not be updated. Please try again." };
    }
}
