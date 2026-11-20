"use server";
import { APP_NAME } from "@/lib/constants";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { auth } from "../auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

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

        if (!booking) return { status: "error", message: "Booking not found" };

        // Verify the caller is a member of this booking's studio
        const [dbUser, member] = await Promise.all([
            db.query.user.findFirst({ where: eq(schema.user.id, session.user.id), columns: { role: true } }),
            db.query.member.findFirst({ where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId)) }),
        ]);
        if (dbUser?.role !== "admin" && !member) {
            return { status: "error", message: "Unauthorized access to this booking" };
        }

        // Calculate balance due
        const servicePrice = Number(booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ?? booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = (booking.bookingAddons || []).reduce((sum: any, a: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addonService = (a as any).service || a; const variantId = (addonService as any).addonVariantId;
            const variant = variantId ? addonService.serviceVariants?.find((v: any) => v.id === variantId) : addonService.serviceVariants?.[0];
            return sum + Number(variant?.basePrice ?? 0);
        }, 0);
        const fallbackGrandTotal = booking.totalAmount != null ? Number(booking.totalAmount) : (sessionTotal + addonsTotal);
        const reference = `gmax-${crypto.randomBytes(12).toString("hex")}`;
        const receiptNumber = generateReceiptNumber();

        const txResult = await db.transaction(async (tx: any) => {
            const [lockedBooking] = await tx
                .select({ id: schema.booking.id, totalAmount: schema.booking.totalAmount })
                .from(schema.booking)
                .where(eq(schema.booking.id, booking.id))
                .for("update");

            if (!lockedBooking) return null;

            const currentPayments = await tx.query.payment.findMany({
                where: eq(schema.payment.bookingId, booking.id),
            });

            const grandTotalKobo = Math.round(
                Number(lockedBooking.totalAmount ?? fallbackGrandTotal) * 100
            );
            const paidKobo = currentPayments
                .filter((p: any) => p.status === "PAID")
                .reduce((sum: number, p: any) => sum + Math.round(Number(p.amount) * 100), 0);

            const dueKobo = Math.max(0, grandTotalKobo - paidKobo);
            if (dueKobo <= 0) {
                return { error: "No balance due — booking is fully paid" as const };
            }

            await tx
                .update(schema.payment)
                .set({ status: "CANCELLED" })
                .where(
                    and(
                        eq(schema.payment.bookingId, booking.id),
                        eq(schema.payment.status, "PENDING")
                    )
                );

            const dueNaira = dueKobo / 100;
            const amountStr = dueNaira.toFixed(2);
            const inserted = await tx
                .insert(schema.payment)
                .values({
                    id: uuidv4(),
                    amount: amountStr,
                    expectedAmount: amountStr,
                    method: "TRANSFER",
                    status: "PENDING",
                    paystackReference: reference,
                    receiptNumber,
                    bookingId: booking.id,
                    recordedById: session.user.id,
                })
                .returning()
                .then((res: any[]) => res[0]);

            return { payment: inserted, balanceDueKobo: dueKobo, balanceDue: dueNaira };
        });

        if (!txResult) {
            return { status: "error", message: "Booking not found" };
        }
        if ("error" in txResult) {
            return { status: "error", message: txResult.error };
        }

        const { payment, balanceDueKobo, balanceDue } = txResult;

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
                amount: balanceDueKobo, // kobo
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
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(reference)) {
            return { status: "error", message: "Invalid payment reference" };
        }

        const payment = await db.query.payment.findFirst({ where: eq(schema.payment.paystackReference, reference), with: {
                booking: {
                    with: { payments: true, service: { with: { serviceVariants: true } }, bookingAddons: { with: { service: { with: { serviceVariants: true } } } } },
                },
            }});

        if (!payment) return { status: "error", message: "Payment record not found" };

        if (payment.status === "PAID") {
            // Idempotency guard — already processed, return success
            return { status: "success", message: "Payment already verified" };
        }

        if (payment.status === "CANCELLED" || payment.status !== "PENDING") {
            return { status: "error", message: "Payment link is no longer valid" };
        }

        const paystackRes = await paystackFetch<{
            status: boolean;
            data: {
                status: string;
                amount: number; // kobo
                currency?: string;
                reference: string;
                metadata: { booking_id?: string; payment_id?: string };
            };
        }>(`/transaction/verify/${encodeURIComponent(reference)}`);

        if (!paystackRes.status || paystackRes.data.status !== "success") {
            return { status: "error", message: "Payment not confirmed by Paystack" };
        }

        if (String(paystackRes.data.currency ?? "").toUpperCase() !== "NGN") {
            return { status: "error", message: "Unsupported payment currency" };
        }

        // Verify the confirmed amount matches what was initialized in exact integer kobo.
        const confirmedKobo = Number(paystackRes.data.amount ?? 0);
        const expectedKobo = Math.round(Number(payment.amount) * 100);

        if (!Number.isInteger(confirmedKobo) || confirmedKobo !== expectedKobo) {
            console.error(
                `[Payment] Amount mismatch for ref ${reference}: ` +
                `expected ${expectedKobo} kobo, confirmed ${confirmedKobo} kobo`,
            );
            return {
                status: "error",
                message: `Payment amount mismatch. Expected ₦${(expectedKobo / 100).toFixed(2)}, got ₦${(confirmedKobo / 100).toFixed(2)}.`,
            };
        }
        const bookingId = payment.bookingId;
        if (!bookingId) {
            return { status: "error", message: "Payment is missing a booking association" };
        }

        // Atomic transaction — lock booking row, verify balance, update payment & booking status together.
        const txOutcome = await db.transaction(async (tx: any) => {
            const [lockedBooking] = await tx
                .select({ id: schema.booking.id, totalAmount: schema.booking.totalAmount })
                .from(schema.booking)
                .where(eq(schema.booking.id, bookingId))
                .for("update");

            if (!lockedBooking) {
                return "BOOKING_NOT_FOUND" as const;
            }

            const lockedPayment = await tx.query.payment.findFirst({
                where: eq(schema.payment.id, payment.id),
            });

            if (lockedPayment?.status === "PAID") {
                return "ALREADY_PAID" as const;
            }
            if (!lockedPayment || lockedPayment.status !== "PENDING") {
                return "INVALID" as const;
            }

            const allPayments = await tx.query.payment.findMany({
                where: eq(schema.payment.bookingId, bookingId as string),
            });

            const booking = (payment as any).booking;
            const servicePrice = Number(booking?.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ?? booking?.service?.serviceVariants?.[0]?.basePrice ?? 0);
            const sessionTotal = servicePrice * (booking?.sessionCount ?? 1);
            const addonsTotal = (booking?.bookingAddons || []).reduce((sum: any, a: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const addonService = (a as any).service || a; const variantId = (addonService as any).addonVariantId;
                const variant = variantId ? addonService.serviceVariants?.find((v: any) => v.id === variantId) : addonService.serviceVariants?.[0];
                return sum + Number(variant?.basePrice ?? 0);
            }, 0);
            const grandTotalKobo = Math.round(
                (lockedBooking.totalAmount != null ? Number(lockedBooking.totalAmount) : (sessionTotal + addonsTotal)) * 100
            );

            const paidBeforeKobo = allPayments
                .filter((p: any) => p.status === "PAID")
                .reduce((sum: number, p: any) => sum + Math.round(Number(p.amount) * 100), 0);

            const remainingBeforeKobo = Math.max(0, grandTotalKobo - paidBeforeKobo);
            if (remainingBeforeKobo < confirmedKobo) {
                return "STALE_OR_OVERPAYMENT" as const;
            }

            await tx.update(schema.payment).set({
                status: "PAID",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                paystackResponse: paystackRes.data as any,
            }).where(and(eq(schema.payment.id, payment.id), eq(schema.payment.status, "PENDING")));

            const totalPaidAfterKobo = paidBeforeKobo + confirmedKobo;
            const newRemainingKobo = Math.max(0, grandTotalKobo - totalPaidAfterKobo);
            const newPaymentStatus = totalPaidAfterKobo >= grandTotalKobo ? "PAID" : "PARTIALLY_PAID";

            await tx.update(schema.booking).set({ paymentStatus: newPaymentStatus }).where(eq(schema.booking.id, bookingId as string));

            const stalePendingIds = allPayments
                .filter(
                    (p: any) =>
                        p.id !== payment.id &&
                        p.status === "PENDING" &&
                        (newRemainingKobo <= 0 || Math.round(Number(p.amount) * 100) !== newRemainingKobo)
                )
                .map((p: any) => p.id);

            if (stalePendingIds.length > 0) {
                await tx
                    .update(schema.payment)
                    .set({ status: "CANCELLED" })
                    .where(inArray(schema.payment.id, stalePendingIds));
            }

            return "VERIFIED" as const;
        });

        if (txOutcome === "BOOKING_NOT_FOUND") {
            return { status: "error", message: "Booking not found" };
        }
        if (txOutcome === "INVALID") {
            return { status: "error", message: "Payment link is no longer valid" };
        }
        if (txOutcome === "STALE_OR_OVERPAYMENT") {
            return { status: "error", message: "Payment amount exceeds remaining balance" };
        }
        if (txOutcome === "ALREADY_PAID") {
            return { status: "success", message: "Payment already verified" };
        }

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

        const [dbUser, member] = await Promise.all([
            db.query.user.findFirst({ where: eq(schema.user.id, session.user.id), columns: { role: true } }),
            db.query.member.findFirst({ where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId)) }),
        ]);
        const isPlatformAdmin = dbUser?.role === "admin";
        if (!isPlatformAdmin && (!member || !["owner", "admin", "manager", "developer", "receptionist"].includes(member.role))) {
            return { status: "error", message: "Unauthorized: insufficient permissions to record manual payment" };
        }

        const servicePrice = Number(booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ?? booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = (booking.bookingAddons || []).reduce((sum: any, a: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addonService = (a as any).service || a; const variantId = (addonService as any).addonVariantId;
            const variant = variantId ? addonService.serviceVariants?.find((v: any) => v.id === variantId) : addonService.serviceVariants?.[0];
            return sum + Number(variant?.basePrice ?? 0);
        }, 0);
        const fallbackGrandTotal = booking.totalAmount != null ? Number(booking.totalAmount) : (sessionTotal + addonsTotal);
        const receiptNumber = generateReceiptNumber();

        const manualPaid = await db.transaction(async (tx: any) => {
            const [lockedBooking] = await tx
                .select({ id: schema.booking.id, totalAmount: schema.booking.totalAmount })
                .from(schema.booking)
                .where(eq(schema.booking.id, booking.id))
                .for("update");

            if (!lockedBooking) return false;

            const allPayments = await tx.query.payment.findMany({
                where: eq(schema.payment.bookingId, booking.id),
            });

            const paidBeforeKobo = allPayments
                .filter((p: any) => p.status === "PAID")
                .reduce((sum: number, p: any) => sum + Math.round(Number(p.amount) * 100), 0);
            const grandTotalKobo = Math.round(
                Number(lockedBooking.totalAmount ?? fallbackGrandTotal) * 100
            );
            const balanceDueKobo = Math.max(0, grandTotalKobo - paidBeforeKobo);

            if (balanceDueKobo <= 0) {
                return false;
            }

            const amountStr = (balanceDueKobo / 100).toFixed(2);
            await tx.insert(schema.payment).values({
                id: uuidv4(),
                amount: amountStr,
                expectedAmount: amountStr,
                method: "CASH",
                status: "PAID",
                receiptNumber,
                bookingId: booking.id,
                recordedById: session.user.id,
            });

            await tx
                .update(schema.payment)
                .set({ status: "CANCELLED" })
                .where(
                    and(
                        eq(schema.payment.bookingId, booking.id),
                        eq(schema.payment.status, "PENDING")
                    )
                );

            await tx
                .update(schema.booking)
                .set({ paymentStatus: "PAID" })
                .where(eq(schema.booking.id, booking.id));

            return true;
        });

        if (!manualPaid) {
            return { status: "error", message: "Booking is already fully paid" };
        }

        revalidatePath("/studios", "layout");
        return { status: "success", message: "Payment marked as paid manually" };
    } catch (e) {
        console.error("Failed to mark as paid:", e);
        return { status: "error", message: "Failed to mark as paid manually" };
    }
}