"use server";

import { prisma } from "../prisma";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE = "https://api.paystack.co";

// ── Paystack helper ──────────────────────────────────────────────────────────

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

// ── Check if client name exists for this studio ──────────────────────────────

export async function checkClientName(studioId: string, name: string) {
    try {
        const existing = await prisma.client.findFirst({
            where: {
                studioId,
                name: { equals: name, mode: "insensitive" },
            },
            select: { id: true, name: true, phone: true },
        });

        if (existing) {
            const firstPhone = existing.phone[0] ?? "";

            // Strip non-digits before masking so +2348012345678 works correctly.
            const digitsOnly = firstPhone.replace(/\D/g, "");
            const maskedPhone =
                digitsOnly.length >= 6
                    ? digitsOnly.replace(/^(\d{3}).*(\d{3})$/, "$1****$2")
                    : null;

            return {
                exists: true,
                client: {
                    id: existing.id,
                    name: existing.name,
                    maskedPhone,
                },
            };
        }

        return { exists: false };
    } catch {
        return { exists: false };
    }
}

// ── Create Public Booking ────────────────────────────────────────────────────

export async function createPublicBooking(data: {
    studioId: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    existingClientId?: string;
    serviceId: string;
    addonIds?: string[];
    sessionCount: number;
    bookingDate: string; // "YYYY-MM-DD"
    notes?: string;
}) {
    try {
        const studio = await prisma.studio.findUnique({
            where: { id: data.studioId },
            include: { members: true },
        });
        if (!studio) return { status: "error", message: "Studio not found" };

        // Check for an existing PENDING booking for the same client+service+date
        // created in the last 5 minutes to catch double-submits and basic bots.
        if (data.existingClientId) {
            const recentDuplicate = await prisma.booking.findFirst({
                where: {
                    studioId: data.studioId,
                    clientId: data.existingClientId,
                    serviceId: data.serviceId,
                    bookingStatus: "PENDING",
                    createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
                },
            });

            if (recentDuplicate) {
                return {
                    status: "error",
                    message: "A booking for this service was already submitted recently. Please wait a moment before trying again.",
                };
            }
        }

        // Find or create client
        let clientId = data.existingClientId;

        if (!clientId) {
            const phones = data.clientPhone
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);

            const client = await prisma.client.create({
                data: {
                    name: data.clientName,
                    phone: phones,
                    email: data.clientEmail || null,
                    type: "regular",
                    studioId: data.studioId,
                },
            });
            clientId = client.id;
        }

        const defaultMember =
            studio.members.find((m) => m.role === "owner") || studio.members[0];
        if (!defaultMember) return { status: "error", message: "No available staff member" };

        // Construct date in UTC so server timezone doesn't shift it
        const [y, m, d] = data.bookingDate.split("-").map(Number);
        const bookingDateUTC = new Date(Date.UTC(y, m - 1, d));

        const booking = await prisma.booking.create({
            data: {
                bookingDate: bookingDateUTC,
                sessionCount: data.sessionCount,
                notes: data.notes || null,
                bookingStatus: "PENDING",
                paymentStatus: "PENDING",
                deliveryStatus: "PENDING",
                serviceId: data.serviceId,
                studioId: data.studioId,
                clientId,
                memberId: defaultMember.id,
                createdBy: defaultMember.userId,
                addons: data.addonIds?.length
                    ? { connect: data.addonIds.map((id) => ({ id })) }
                    : undefined,
            },
            include: { service: true, addons: true, client: true },
        });

        // Calculate total
        const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
        const grandTotal = sessionTotal + addonsTotal;

        const reference = `gmax-pub-${uuidv4().slice(0, 8)}`;
        const receiptNumber = generateReceiptNumber();

        const payment = await prisma.payment.create({
            data: {
                amount: grandTotal,
                method: "TRANSFER",
                status: "PENDING",
                paystackReference: reference,
                receiptNumber,
                bookingId: booking.id,
                recordedById: defaultMember.userId,
            },
        });
        
        const clientEmail = data.clientEmail ?? booking.client?.email;

        if (!clientEmail) {
            // Booking and payment records are created; Paystack init is skipped.
            // Studio staff can send a manual payment link from the dashboard.
            console.warn(
                `[PublicBooking] No email for booking ${booking.id} — Paystack init skipped. ` +
                `Send a manual payment link from the studio dashboard.`,
            );

            revalidatePath("/studios", "layout");
            return {
                status: "success",
                data: {
                    bookingId: booking.id,
                    paymentUrl: null,
                    reference,
                    amount: grandTotal,
                    warning: "No email provided — payment link must be sent manually by the studio.",
                },
            };
        }

        try {
            const paystackRes = await paystackFetch<{
                status: boolean;
                data: { authorization_url: string; reference: string };
            }>("/transaction/initialize", {
                method: "POST",
                body: JSON.stringify({
                    email: clientEmail,
                    amount: Math.round(grandTotal * 100),
                    reference,
                    currency: "NGN",
                    callback_url: `${process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3000"}/pay/${reference}?status=success`,
                    metadata: {
                        booking_id: booking.id,
                        payment_id: payment.id,
                        studio_name: studio.name,
                    },
                }),
            });

            revalidatePath("/studios", "layout");
            return {
                status: "success",
                data: {
                    bookingId: booking.id,
                    paymentUrl: paystackRes.data.authorization_url,
                    reference: paystackRes.data.reference,
                    amount: grandTotal,
                },
            };
        } catch (e) {
            console.error("Paystack init failed for public booking:", e);

            // Booking exists; return without payment URL so client can retry
            revalidatePath("/studios", "layout");
            return {
                status: "success",
                data: {
                    bookingId: booking.id,
                    paymentUrl: null,
                    reference,
                    amount: grandTotal,
                    warning: "Payment link could not be generated. Please contact the studio.",
                },
            };
        }
    } catch (e) {
        console.error("Failed to create public booking:", e);
        return { status: "error", message: "Failed to create booking. Please try again." };
    }
}