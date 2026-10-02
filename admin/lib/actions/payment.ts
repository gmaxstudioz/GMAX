"use server";
import { APP_NAME } from "@/lib/constants";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
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

        const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, bookingId), with: {
                client: true,
                service: { with: { serviceVariants: true } },
                payments: true,
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
                studio: true,
            }});

        if (!foundBooking) return { status: "error", message: "Booking not found" };

        // Verify the caller is a member of this booking's studio
        const member = await db.query.member.findFirst({ where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId)) });
        if (!member) return { status: "error", message: "Unauthorized access to this booking" };

        // Calculate balance due
        const servicePrice = Number(booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ?? booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = (booking.bookingAddons || []).reduce((sum: any, a: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addonService = (a as any).service || a; const variantId = (addonService as any).addonVariantId;
            const variant = variantId ? addonService.serviceVariants?.find((v: any) => v.id === variantId) : addonService.serviceVariants?.[0];
            return sum + Number(variant?.basePrice ?? 0);
        }, 0);
        const grandTotal = foundBooking.totalAmount != null ? Number(foundBooking.totalAmount) : (sessionTotal + addonsTotal);

        const totalPaid = booking.payments
            .filter((p: any) => p.status === "PAID")
            .reduce((sum: any, p: any) => sum + Number(p.amount), 0);

        const balanceDue = Math.max(0, grandTotal - totalPaid);

        if (balanceDue <= 0) {
            return { status: "error", message: "No balance due — booking is fully paid" };
        }

        const reference = `gmax-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        // Create a pending Payment record
        const payment = await db.insert(schema.payment).values({ id: uuidv4(), 
                amount: balanceDue.toString(),
                method: "TRANSFER",
                status: "PENDING",
                paystackReference: reference,
                receiptNumber,
                bookingId: booking.id,
                recordedById: session.user.id,
             }).returning().then(res => res[0]);

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

        if (booking.client?.phone) {
            try {
                const { sendPaymentLinkSMS } = await import("../termii");
                await sendPaymentLinkSMS({
                    phone: booking.client.phone,
                    clientName: booking.client.name,
                    studioName: booking.studio?.name ?? APP_NAME,
                    amount: balanceDue,
                    paymentLink: paystackRes.data.authorization_url,
                });
            } catch (notifyErr) {
                console.error("[Payment] Failed to send payment link SMS", notifyErr);
            }
        }

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

        const payment = await db.query.payment.findFirst({ where: eq(schema.payment.paystackReference, reference), with: {
                booking: {
                    with: { payments: true, service: { with: { serviceVariants: true } }, bookingAddons: { with: { service: { with: { serviceVariants: true } } } } },
                },
            }});

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
        // All reads within this block see a consistent snapshot; concurrent
        // transactions targeting the same booking row will serialize correctly.
        await db.transaction(async (tx: any) => {
            // Step 1: Mark this payment as PAID
            await tx.update(schema.payment).set({
                    status: "PAID",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    paystackResponse: paystackRes.data as any,
                }).where(eq(schema.payment.id, payment.id));

            if (!foundPayment.bookingId) return;

            // Step 2: Re-read ALL payments for this booking within the transaction.
            // The payment updated above will already show PAID in this read.
            const allPayments = await tx.query.payment.findMany({ where: eq(schema.payment.bookingId, payment.bookingId) });

            const booking = (payment as any).booking;
            if (!booking) return;

            const servicePrice = Number(booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ?? booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
            const sessionTotal = servicePrice * booking.sessionCount;
            const addonsTotal = (booking.bookingAddons || []).reduce((sum: any, a: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const addonService = (a as any).service || a; const variantId = (addonService as any).addonVariantId;
                const variant = variantId ? addonService.serviceVariants?.find((v: any) => v.id === variantId) : addonService.serviceVariants?.[0];
                return sum + Number(variant?.basePrice ?? 0);
            }, 0);
            const grandTotal = currentBooking.totalAmount != null ? Number(currentBooking.totalAmount) : (sessionTotal + addonsTotal);

            // Step 3: Recalculate with the freshly updated payment included
            const totalPaid = allPayments
                .filter((p: any) => p.status === "PAID")
                .reduce((sum: any, p: any) => sum + Number(p.amount), 0);

            const newPaymentStatus = totalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

            // Step 4: Update booking status atomically
            await tx.update(schema.booking).set({ paymentStatus: newPaymentStatus }).where(eq(schema.booking.id, payment.bookingId));
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Payment verified successfully" };
    } catch (e) {
        console.error("Failed to verify payment:", e);
        return { status: "error", message: "Failed to verify payment" };
    }
}

// ── Mark Payment as Paid Manually ───────────────────────────────────────────

export async function markAsPaidManually(bookingId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return { status: "error", message: "Unauthorized" };

        const booking = await db.query.booking.findFirst({ where: eq(schema.booking.id, bookingId), with: {
                payments: true,
                service: { with: { serviceVariants: true } },
                bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
            }});

        if (!booking) return { status: "error", message: "Booking not found" };

        const member = await db.query.member.findFirst({ where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId)) });
        if (!member) return { status: "error", message: "Unauthorized access to this booking" };

        const servicePrice = Number(booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ?? booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = (booking.bookingAddons || []).reduce((sum: any, a: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addonService = (a as any).service || a; const variantId = (addonService as any).addonVariantId;
            const variant = variantId ? addonService.serviceVariants?.find((v: any) => v.id === variantId) : addonService.serviceVariants?.[0];
            return sum + Number(variant?.basePrice ?? 0);
        }, 0);
        const grandTotal = booking.totalAmount != null ? Number(booking.totalAmount) : (sessionTotal + addonsTotal);

        const totalPaid = booking.payments
            .filter((p: any) => p.status === "PAID")
            .reduce((sum: any, p: any) => sum + Number(p.amount), 0);

        const balanceDue = Math.max(0, grandTotal - totalPaid);

        if (balanceDue <= 0) {
            return { status: "error", message: "Booking is already fully paid" };
        }

        const receiptNumber = generateReceiptNumber();

        await db.transaction(async (tx: any) => {
            // Create a manual PAID payment
            await tx.insert(schema.payment).values({ id: uuidv4(), 
                    amount: balanceDue,
                    method: "CASH", // Default to CASH for manual entry, could be TRANSFER too
                    status: "PAID",
                    receiptNumber,
                    bookingId: booking.id,
                    recordedById: session.user.id,
                 }).returning();

            // Re-calculate and update booking
            const allPayments = await tx.query.payment.findMany({ where: eq(schema.payment.bookingId, booking.id) });
            const newTotalPaid = allPayments
                .filter((p: any) => p.status === "PAID")
                .reduce((sum: any, p: any) => sum + Number(p.amount), 0);
            
            const newPaymentStatus = newTotalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

            await tx.update(schema.booking).set({ paymentStatus: newPaymentStatus }).where(eq(schema.booking.id, booking.id));
        });

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Payment marked as paid manually" };
    } catch (e) {
        console.error("Failed to mark as paid:", e);
        return { status: "error", message: "Failed to mark as paid manually" };
    }
}