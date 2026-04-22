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

// ── Initialize Payment ─────────────────────────────────────────────

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

        // Calculate balance due
        const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
        const grandTotal = sessionTotal + addonsTotal;

        const totalPaid = booking.payments
            .filter(p => p.status === "PAID")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const balanceDue = Math.max(0, grandTotal - totalPaid);

        if (balanceDue <= 0) {
            return { status: "error", message: "No balance due — booking is fully paid" };
        }

        const reference = `gmax-${uuidv4().slice(0, 8)}`;
        const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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

        const clientEmail = booking.client?.email || `${reference}@payment.gmax.studio`;

        // Initialize Paystack transaction
        const paystackRes = await paystackFetch<{
            status: boolean;
            data: { authorization_url: string; access_code: string; reference: string };
        }>("/transaction/initialize", {
            method: "POST",
            body: JSON.stringify({
                email: clientEmail,
                amount: Math.round(balanceDue * 100), // Paystack expects kobo
                reference,
                currency: "NGN",
                callback_url: `${process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:3000"}/pay/${reference}?status=success`,
                metadata: {
                    booking_id: booking.id,
                    payment_id: payment.id,
                    studio_name: booking.studio?.name,
                    client_name: booking.client?.name,
                    custom_fields: [
                        { display_name: "Client", variable_name: "client", value: booking.client?.name || "N/A" },
                        { display_name: "Service", variable_name: "service", value: booking.service?.name || "N/A" },
                    ],
                },
            }),
        });

        revalidatePath("/dashboard/studios", "layout");

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

// ── Verify Payment ─────────────────────────────────────────────────

export async function verifyPayment(reference: string) {
    try {
        const paystackRes = await paystackFetch<{
            status: boolean;
            data: {
                status: string;
                amount: number;
                reference: string;
                metadata: { booking_id?: string; payment_id?: string };
            };
        }>(`/transaction/verify/${reference}`);

        if (!paystackRes.status || paystackRes.data.status !== "success") {
            return { status: "error", message: "Payment not confirmed" };
        }

        const payment = await prisma.payment.findFirst({
            where: { paystackReference: reference },
            include: { booking: { include: { payments: true, service: true, addons: true } } },
        });

        if (!payment) return { status: "error", message: "Payment record not found" };

        // Update payment
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: "PAID",
                paystackResponse: paystackRes.data as any,
            },
        });

        // Recalculate total paid to determine booking payment status
        const allPayments = await prisma.payment.findMany({
            where: { bookingId: payment.bookingId },
        });

        const totalPaid = allPayments
            .filter(p => p.id === payment.id ? true : p.status === "PAID")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const booking = payment.booking;
        const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
        const grandTotal = sessionTotal + addonsTotal;

        const newPaymentStatus = totalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

        await prisma.booking.update({
            where: { id: payment.bookingId },
            data: { paymentStatus: newPaymentStatus },
        });

        revalidatePath("/dashboard/studios", "layout");
        return { status: "success", message: "Payment verified successfully" };
    } catch (e) {
        console.error("Failed to verify payment:", e);
        return { status: "error", message: "Failed to verify payment" };
    }
}
