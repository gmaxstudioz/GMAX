"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, ilike, inArray, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

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
        const trimmed = name.trim();
        if (trimmed.replace(/[\\%_\s]/g, "").length < 2) {
            return { exists: false };
        }
        const escapedName = escapeLikePattern(trimmed);
        const existing = await db.query.client.findFirst({
            where: and(
                eq(schema.client.studioId, studioId),
                ilike(schema.client.name, escapedName)
            ),
            columns: { id: true, name: true, phone: true }
        });

        if (existing) {
            const firstPhone = existing.phone ?? "";

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
    selectedVariantId?: string;
    addonIds?: string[];
    sessionCount: number;
    bookingDate: string; // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm(:ss)"
    bookingTime?: string; // "HH:mm" or "HH:mm:ss"
    notes?: string;
}) {
    try {
        if (!Number.isInteger(data.sessionCount) || data.sessionCount < 1 || data.sessionCount > 50) {
            return { status: "error", message: "Invalid session count (must be between 1 and 50)" };
        }
        const dateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(data.bookingDate);
        if (!dateTimeMatch) {
            return { status: "error", message: "Invalid booking date format" };
        }
        let hours = dateTimeMatch[4] !== undefined ? Number(dateTimeMatch[4]) : 0;
        let minutes = dateTimeMatch[5] !== undefined ? Number(dateTimeMatch[5]) : 0;
        let seconds = dateTimeMatch[6] !== undefined ? Number(dateTimeMatch[6]) : 0;

        if (data.bookingTime !== undefined) {
            const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(data.bookingTime);
            if (!timeMatch) {
                return { status: "error", message: "Invalid booking time format" };
            }
            hours = Number(timeMatch[1]);
            minutes = Number(timeMatch[2]);
            seconds = timeMatch[3] !== undefined ? Number(timeMatch[3]) : 0;
        }

        const y = Number(dateTimeMatch[1]);
        const m = Number(dateTimeMatch[2]);
        const d = Number(dateTimeMatch[3]);
        if (
            m < 1 || m > 12 ||
            d < 1 || d > 31 ||
            hours < 0 || hours > 23 ||
            minutes < 0 || minutes > 59 ||
            seconds < 0 || seconds > 59
        ) {
            return { status: "error", message: "Invalid booking date or time" };
        }
        const bookingDateUTC = new Date(Date.UTC(y, m - 1, d, hours, minutes, seconds));
        if (
            Number.isNaN(bookingDateUTC.getTime()) ||
            bookingDateUTC.getUTCFullYear() !== y ||
            bookingDateUTC.getUTCMonth() !== m - 1 ||
            bookingDateUTC.getUTCDate() !== d
        ) {
            return { status: "error", message: "Invalid booking date" };
        }

        const studio = await db.query.studio.findFirst({
            where: eq(schema.studio.id, data.studioId),
            with: { members: true },
        });
        if (!studio) return { status: "error", message: "Studio not found" };

        // Verify existingClientId belongs to data.studioId if supplied
        let clientId: string | undefined;
        if (data.existingClientId) {
            const scopedClient = await db.query.client.findFirst({
                where: and(
                    eq(schema.client.id, data.existingClientId),
                    eq(schema.client.studioId, data.studioId)
                ),
                columns: { id: true },
            });
            clientId = scopedClient?.id;
        }

        if (!clientId) {
            const normalizedPhone = data.clientPhone.trim();
            const existingByContact = data.clientEmail
                ? await db.query.client.findFirst({
                      where: and(
                          eq(schema.client.studioId, data.studioId),
                          eq(schema.client.email, data.clientEmail)
                      ),
                      columns: { id: true },
                  })
                : normalizedPhone
                  ? await db.query.client.findFirst({
                        where: and(
                            eq(schema.client.studioId, data.studioId),
                            eq(schema.client.phone, normalizedPhone)
                        ),
                        columns: { id: true },
                    })
                  : null;

            if (existingByContact) {
                clientId = existingByContact.id;
            } else {
                const createdClient = await db.insert(schema.client).values({
                    id: uuidv4(),
                    name: data.clientName,
                    phone: normalizedPhone,
                    email: data.clientEmail || null,
                    type: "regular",
                    studioId: data.studioId,
                }).returning().then(res => res[0]);
                clientId = createdClient.id;
            }
        }

        // Check for an existing PENDING booking for the same client+service
        // created in the last 5 minutes to catch double-submits and basic bots.
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const recentDuplicate = await db.query.booking.findFirst({
            where: and(
                eq(schema.booking.studioId, data.studioId),
                eq(schema.booking.clientId, clientId),
                eq(schema.booking.serviceId, data.serviceId),
                eq(schema.booking.bookingStatus, "PENDING"),
                gte(schema.booking.createdAt, fiveMinsAgo)
            )
        });

        if (recentDuplicate) {
            return {
                status: "error",
                message: "A booking for this service was already submitted recently. Please wait a moment before trying again.",
            };
        }

        const defaultMember =
            studio.members.find((m: any) => m.role === "owner") || studio.members[0];
        if (!defaultMember) return { status: "error", message: "No available staff member" };

        const service = await db.query.service.findFirst({
            where: and(
                eq(schema.service.id, data.serviceId),
                eq(schema.service.studioId, data.studioId),
                eq(schema.service.isActive, true)
            ),
            with: { serviceVariants: true }
        });
        if (!service) throw new Error("Service not found");

        const selectedVariant = data.selectedVariantId 
            ? service.serviceVariants.find((v: any) => v.id === data.selectedVariantId) 
            : service.serviceVariants[0];
            
        if (!selectedVariant) throw new Error("Invalid service variant selected");

        // Clean addon composite IDs to UUIDs for DB lookup (scoped to studioId & isAddon)
        const parsedAddons = (data.addonIds || []).map(str => {
            const parts = str.split(":");
            return { addonId: parts[0], variantId: parts[1] };
        });
        const cleanAddonIds = [...new Set(parsedAddons.map(p => p.addonId))];
        const addonsList = cleanAddonIds.length ? await db.query.service.findMany({ 
            where: and(
                inArray(schema.service.id, cleanAddonIds),
                eq(schema.service.studioId, data.studioId),
                eq(schema.service.isAddon, true),
                eq(schema.service.isActive, true)
            ),
            with: { serviceVariants: true } 
        }) : [];

        const servicePrice = Number(selectedVariant.basePrice);
        const sessionTotal = servicePrice * data.sessionCount;
        
        const addonsTotal = parsedAddons.reduce((sum, p) => {
            const addon = addonsList.find((a: any) => a.id === p.addonId);
            if (!addon) throw new Error(`Addon not found: ${p.addonId}`);
            
            const variant = p.variantId ? addon.serviceVariants.find((v: any) => v.id === p.variantId) : addon.serviceVariants[0];
            if (!variant) throw new Error(`Invalid variant for addon: ${addon.name}`);
            
            return sum + Number(variant.basePrice);
        }, 0);
        
        const grandTotal = sessionTotal + addonsTotal;

        const bookingId = uuidv4();
        await db.insert(schema.booking).values({
            id: bookingId,
            bookingDate: bookingDateUTC.toISOString(),
            sessionCount: data.sessionCount,
            notes: data.notes || null,
            totalAmount: grandTotal.toString(),
            bookingStatus: "PENDING",
            paymentStatus: "PENDING",
            deliveryStatus: "PENDING",
            serviceId: data.serviceId,
            serviceVariantId: data.selectedVariantId || selectedVariant?.id || null,
            studioId: data.studioId,
            clientId: clientId as string,
            memberId: defaultMember.id,
            createdBy: defaultMember.userId,
        });

        if (cleanAddonIds.length > 0) {
            await db.insert(schema.bookingAddons).values(
                cleanAddonIds.map(addonId => ({
                    a: bookingId,
                    b: addonId
                }))
            );
        }

        const booking = await db.query.booking.findFirst({
            where: eq(schema.booking.id, bookingId),
            with: { client: true }
        });

        if (!booking) throw new Error("Failed to create booking");

        const reference = `gmax-pub-${crypto.randomBytes(12).toString("hex")}`;
        const receiptNumber = generateReceiptNumber();

        const payment = await db.insert(schema.payment).values({
            id: uuidv4(),
            amount: grandTotal.toString(),
            method: "TRANSFER",
            status: "PENDING",
            paystackReference: reference,
            receiptNumber,
            bookingId: booking.id,
            recordedById: defaultMember.userId,
        }).returning().then(res => res[0]);
        
        const [clientRecord] = await db.select().from(schema.client).where(eq(schema.client.id, clientId as string));
        const clientEmail = data.clientEmail ?? clientRecord?.email;

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