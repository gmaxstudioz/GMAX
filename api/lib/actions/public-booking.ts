"use server";

import { prisma } from "../prisma";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";

// ── Check if client name exists for this studio ───────────────────

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
            return {
                exists: true,
                client: {
                    id: existing.id,
                    name: existing.name,
                    maskedPhone: existing.phone.length > 0
                        ? existing.phone[0].replace(/^(\d{3}).*(\d{3})$/, "$1****$2")
                        : null,
                },
            };
        }

        return { exists: false };
    } catch {
        return { exists: false };
    }
}

// ── Create Public Booking ──────────────────────────────────────────

export async function createPublicBooking(data: {
    studioId: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    existingClientId?: string; // If they confirmed they're the existing client
    serviceId: string;
    addonIds?: string[];
    sessionCount: number;
    bookingDate: string;
    notes?: string;
}) {
    try {
        const studio = await prisma.studio.findUnique({
            where: { id: data.studioId },
            include: { members: true },
        });
        if (!studio) return { status: "error", message: "Studio not found" };

        // Find or create client
        let clientId = data.existingClientId;

        if (!clientId) {
            // Create new client
            const phones = data.clientPhone.split(",").map(p => p.trim()).filter(Boolean);
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

        // Get default member (first available or owner)
        const defaultMember = studio.members.find(m => m.role === "owner") || studio.members[0];
        if (!defaultMember) return { status: "error", message: "No available staff member" };

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                bookingDate: new Date(data.bookingDate),
                sessionCount: data.sessionCount,
                notes: data.notes || null,
                bookingStatus: "PENDING",
                paymentStatus: "PENDING",
                deliveryStatus: "PENDING",
                serviceId: data.serviceId,
                studioId: data.studioId,
                clientId: clientId,
                memberId: defaultMember.id,
                createdBy: defaultMember.userId,
                addons: data.addonIds?.length
                    ? { connect: data.addonIds.map(id => ({ id })) }
                    : undefined,
            },
            include: {
                service: true,
                addons: true,
                client: true,
            },
        });

        // Calculate total
        const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
        const grandTotal = sessionTotal + addonsTotal;

        // Initialize Paystack payment
        const reference = `gmax-pub-${uuidv4().slice(0, 8)}`;
        const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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

        const clientEmail = data.clientEmail || booking.client?.email || `${reference}@payment.gmax.studio`;

        try {
            const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: clientEmail,
                    amount: Math.round(grandTotal * 100),
                    reference,
                    currency: "NGN",
                    callback_url: `${process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:3000"}/pay/${reference}?status=success`,
                    metadata: {
                        booking_id: booking.id,
                        payment_id: payment.id,
                        studio_name: studio.name,
                    },
                }),
            });

            if (paystackRes.ok) {
                const result = await paystackRes.json();

                revalidatePath("/dashboard/studios", "layout");
                return {
                    status: "success",
                    data: {
                        bookingId: booking.id,
                        paymentUrl: result.data.authorization_url,
                        reference: result.data.reference,
                        amount: grandTotal,
                    },
                };
            }
        } catch (e) {
            console.error("Paystack init failed for public booking:", e);
        }

        // If Paystack fails, return booking without payment link
        revalidatePath("/dashboard/studios", "layout");
        return {
            status: "success",
            data: {
                bookingId: booking.id,
                paymentUrl: null,
                reference,
                amount: grandTotal,
            },
        };
    } catch (e) {
        console.error("Failed to create public booking:", e);
        return { status: "error", message: "Failed to create booking. Please try again." };
    }
}
