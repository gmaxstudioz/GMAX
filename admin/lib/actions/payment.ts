"use server";

import { db } from "../db";
import { booking, payment as paymentTable, member, serviceVariant, bookingAddons, service } from "../schema";
import { eq, and } from "drizzle-orm";
import { auth } from "../auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`[Paystack] ${path} failed (${res.status}):`, text);
        throw new Error(`Paystack request failed: ${res.status}`);
    }

    return res.json() as T;
}

// ── Generate receipt number ──────────────────────────────────────────────────

function generateReceiptNumber(): string {
    return `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

// ── Initialize Payment ───────────────────────────────────────────────────────

export async function initializePayment(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const foundBooking = await db.query.booking.findFirst({
            where: eq(booking.id, bookingId),
            with: {
                client: true,
                service: { with: { serviceVariants: true } },
                payments: true,
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                studio: true,
            },
        });

        if (!foundBooking) return { status: "error", message: "Booking not found" };

        // Verify the caller is a member of this booking's studio
        const memberRecord = await db.query.member.findFirst({
            where: and(eq(member.userId, session.user.id), eq(member.studioId, foundBooking.studioId)),
        });
        if (!memberRecord) return { status: "error", message: "Unauthorized access to this booking" };

        // Calculate balance due
        const servicePrice = Number(foundBooking.service?.serviceVariants?.find((v) => v.id === foundBooking.serviceVariantId)?.basePrice ?? foundBooking.service?.serviceVariants?.[0]?.basePrice ?? 0);
        const sessionTotal = servicePrice * foundBooking.sessionCount;
        const addonsTotal = foundBooking.bookingAddons.reduce((sum, relation) => {
            const a = relation.service;
            if (!a) return sum;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const variantId = (a as any).addonVariantId;
            const variant = variantId ? a.serviceVariants?.find((v) => v.id === variantId) : a.serviceVariants?.[0];
            return sum + Number(variant?.basePrice ?? 0);
        }, 0);
        const grandTotal = foundBooking.totalAmount != null ? Number(foundBooking.totalAmount) : (sessionTotal + addonsTotal);

        const totalPaid = foundBooking.payments
            .filter((p) => p.status === "PAID")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const balanceDue = Math.max(0, grandTotal - totalPaid);

        if (balanceDue <= 0) {
            return { status: "error", message: "No balance due — booking is fully paid" };
        }

        const reference = `gmax-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        // Create a pending Payment record
        const [payment] = await db.insert(paymentTable).values({
            id: crypto.randomUUID(),
            amount: balanceDue.toString(),
            method: "TRANSFER",
            status: "PENDING",
            paystackReference: reference,
            receiptNumber,
            bookingId: foundBooking.id,
            recordedById: session.user.id,
        }).returning();

        // Paystack requires a real email — fall back only as a last resort and
        // flag clearly in logs so the team knows a receipt won't be delivered.
        const clientEmail = foundBooking.client?.email;
        if (!clientEmail) {
            console.warn(
                `[Payment] Booking ${foundBooking.id} has no client email. ` +
                `Paystack receipt will not be delivered to the client.`,
            );
        }
        const paystackEmail = clientEmail ?? `${reference}@noreply.gmax.studio`;

        const paystackRes = await paystackFetch<{
            status: boolean;
            data: { authorization_url: string; access_code: string; reference: string };
        }>("/transaction/initialize", {
            method: "POST",
            body: JSON.stringify({
                email: paystackEmail,
                amount: Math.round(balanceDue * 100), // kobo
                reference,
                currency: "NGN",
                callback_url: `${process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3000"}/pay/${reference}?status=success`,
                metadata: {
                    booking_id: foundBooking.id,
                    payment_id: payment.id,
                    studio_name: foundBooking.studio?.name,
                    client_name: foundBooking.client?.name,
                    custom_fields: [
                        { display_name: "Client", variable_name: "client", value: foundBooking.client?.name ?? "N/A" },
                        { display_name: "Service", variable_name: "service", value: foundBooking.service?.name ?? "N/A" },
                    ],
                },
            }),
        });

        revalidatePath("/studios", "layout");

        return {
            status: "success",
            data: {
                paymentUrl: paystackRes.data.authorization_url,
                reference: paystackRes.data.reference,
                accessCode: paystackRes.data.access_code,
                amount: balanceDue,
            },
        };
    } catch (e) {
        console.error("Failed to initialize payment:", e);
        return { status: "error", message: "Failed to generate payment link" };
    }
}

// ── Verify Payment ───────────────────────────────────────────────────────────

export async function verifyPayment(reference: string) {
    try {
        const paystackRes = await paystackFetch<{
            status: boolean;
            data: {
                status: string;
                amount: number; // kobo
                reference: string;
                metadata: { booking_id?: string; payment_id?: string };
            };
        }>(`/transaction/verify/${reference}`);

        if (!paystackRes.status || paystackRes.data.status !== "success") {
            return { status: "error", message: "Payment not confirmed by Paystack" };
        }

        const foundPayment = await db.query.payment.findFirst({
            where: eq(paymentTable.paystackReference, reference),
            with: {
                booking: {
                    with: { 
                        payments: true, 
                        service: { with: { serviceVariants: true } }, 
                        bookingAddons: { with: { service: { with: { serviceVariants: true } } } } 
                    },
                },
            },
        });

        if (!foundPayment) return { status: "error", message: "Payment record not found" };

        if (foundPayment.status === "PAID") {
            // Idempotency guard — already processed, return success
            return { status: "success", message: "Payment already verified" };
        }

        // Verify the confirmed amount matches what was initialized.
        // Paystack returns amounts in kobo; our DB stores in naira.
        const confirmedAmountNaira = paystackRes.data.amount / 100;
        const expectedAmountNaira = Number(foundPayment.amount);

        if (Math.abs(confirmedAmountNaira - expectedAmountNaira) > 0.5) {
            console.error(
                `[Payment] Amount mismatch for ref ${reference}: ` +
                `expected ₦${expectedAmountNaira}, confirmed ₦${confirmedAmountNaira}`,
            );
            return {
                status: "error",
                message: `Payment amount mismatch. Expected ₦${expectedAmountNaira}, got ₦${confirmedAmountNaira}.`,
            };
        }

        // Atomic transaction — update payment and booking status together.
        await db.transaction(async (tx) => {
            // Step 1: Mark this payment as PAID
            await tx.update(paymentTable).set({
                status: "PAID",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                paystackResponse: paystackRes.data as any,
            }).where(eq(paymentTable.id, foundPayment.id));

            if (!foundPayment.bookingId) return;

            // Step 2: Re-read ALL payments for this booking within the transaction.
            const allPayments = await tx.query.payment.findMany({
                where: eq(paymentTable.bookingId, foundPayment.bookingId),
            });

            const currentBooking = foundPayment.booking;
            if (!currentBooking) return;

            const servicePrice = Number(currentBooking.service?.serviceVariants?.find((v) => v.id === currentBooking.serviceVariantId)?.basePrice ?? currentBooking.service?.serviceVariants?.[0]?.basePrice ?? 0);
            const sessionTotal = servicePrice * currentBooking.sessionCount;
            const addonsTotal = currentBooking.bookingAddons.reduce((sum, relation) => {
                const a = relation.service;
                if (!a) return sum;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const variantId = (a as any).addonVariantId;
                const variant = variantId ? a.serviceVariants?.find((v) => v.id === variantId) : a.serviceVariants?.[0];
                return sum + Number(variant?.basePrice ?? 0);
            }, 0);
            const grandTotal = currentBooking.totalAmount != null ? Number(currentBooking.totalAmount) : (sessionTotal + addonsTotal);

            // Step 3: Recalculate with the freshly updated payment included
            const totalPaid = allPayments
                .filter((p) => p.status === "PAID")
                .reduce((sum, p) => sum + Number(p.amount), 0);

            const newPaymentStatus = totalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

            // Step 4: Update booking status atomically
            await tx.update(booking).set({ 
                paymentStatus: newPaymentStatus as any 
            }).where(eq(booking.id, foundPayment.bookingId));
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Payment verified successfully" };
    } catch (e) {
        console.error("Failed to verify payment:", e);
        return { status: "error", message: "Failed to verify payment" };
    }
}