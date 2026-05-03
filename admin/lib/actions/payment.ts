"use server";

import { prisma } from "../prisma";
import { auth } from "../auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
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

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                client: true,
                service: true,
                payments: true,
                addons: true,
                studio: true,
            },
        });

        if (!booking) return { status: "error", message: "Booking not found" };

        // Verify the caller is a member of this booking's studio
        const member = await prisma.member.findFirst({
            where: { userId: session.user.id, studioId: booking.studioId },
        });
        if (!member) return { status: "error", message: "Unauthorized access to this booking" };

        // Calculate balance due
        const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
        const grandTotal = sessionTotal + addonsTotal;

        const totalPaid = booking.payments
            .filter((p) => p.status === "PAID")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const balanceDue = Math.max(0, grandTotal - totalPaid);

        if (balanceDue <= 0) {
            return { status: "error", message: "No balance due — booking is fully paid" };
        }

        const reference = `gmax-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        // Create a pending Payment record
        const payment = await prisma.payment.create({
            data: {
                amount: balanceDue,
                method: "TRANSFER",
                status: "PENDING",
                paystackReference: reference,
                receiptNumber,
                bookingId: booking.id,
                recordedById: session.user.id,
            },
        });

        // Paystack requires a real email — fall back only as a last resort and
        // flag clearly in logs so the team knows a receipt won't be delivered.
        const clientEmail = booking.client?.email;
        if (!clientEmail) {
            console.warn(
                `[Payment] Booking ${booking.id} has no client email. ` +
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
                    booking_id: booking.id,
                    payment_id: payment.id,
                    studio_name: booking.studio?.name,
                    client_name: booking.client?.name,
                    custom_fields: [
                        { display_name: "Client", variable_name: "client", value: booking.client?.name ?? "N/A" },
                        { display_name: "Service", variable_name: "service", value: booking.service?.name ?? "N/A" },
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

        const payment = await prisma.payment.findFirst({
            where: { paystackReference: reference },
            include: {
                booking: {
                    include: { payments: true, service: true, addons: true },
                },
            },
        });

        if (!payment) return { status: "error", message: "Payment record not found" };

        if (payment.status === "PAID") {
            // Idempotency guard — already processed, return success
            return { status: "success", message: "Payment already verified" };
        }

        // Verify the confirmed amount matches what was initialized.
        // Paystack returns amounts in kobo; our DB stores in naira.
        const confirmedAmountNaira = paystackRes.data.amount / 100;
        const expectedAmountNaira = Number(payment.amount);

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
        // All reads within this block see a consistent snapshot; concurrent
        // transactions targeting the same booking row will serialize correctly.
        await prisma.$transaction(async (tx) => {
            // Step 1: Mark this payment as PAID
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: "PAID",
                    paystackResponse: paystackRes.data as any,
                },
            });

            if (!payment.bookingId) return;

            // Step 2: Re-read ALL payments for this booking within the transaction.
            // The payment updated above will already show PAID in this read.
            const allPayments = await tx.payment.findMany({
                where: { bookingId: payment.bookingId },
            });

            const booking = payment.booking;
            if (!booking) return;

            const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
            const sessionTotal = servicePrice * booking.sessionCount;
            const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
            const grandTotal = sessionTotal + addonsTotal;

            // Step 3: Recalculate with the freshly updated payment included
            const totalPaid = allPayments
                .filter((p) => p.status === "PAID")
                .reduce((sum, p) => sum + Number(p.amount), 0);

            const newPaymentStatus = totalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

            // Step 4: Update booking status atomically
            await tx.booking.update({
                where: { id: payment.bookingId },
                data: { paymentStatus: newPaymentStatus },
            });
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Payment verified successfully" };
    } catch (e) {
        console.error("Failed to verify payment:", e);
        return { status: "error", message: "Failed to verify payment" };
    }
}