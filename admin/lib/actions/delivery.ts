"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendDeliveryEmail, sendDeliverySMS, sendDeliveryWhatsApp } from "@/lib/termii";
import crypto from "crypto";
import { auth } from "../auth";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export async function deliverBooking(bookingId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const booking = await db.query.booking.findFirst({
        where: eq(schema.booking.id, bookingId),
        with: {
            client: true,
            studio: true,
        },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    const member = await db.query.member.findFirst({
        where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
    });

    if (!member) {
        throw new Error("Unauthorized access to studio");
    }

    if (!["owner", "admin", "manager", "developer"].includes(member.role)) {
        throw new Error("You do not have permission to deliver assets");
    }

    // Generate access code if one doesn't exist

    const publicDomain = process.env.NEXT_PUBLIC_APP_URL;
    if (!publicDomain) {
        throw new Error("NEXT_PUBLIC_APP_URL environment variable is missing");
    }

    let accessCode = booking.accessCode;
    const isNewAccessCode = !accessCode;

    if (booking.deliveryStatus !== "DELIVERED") {
        let updated = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!updated && attempts < maxAttempts) {
            if (isNewAccessCode) {
                accessCode = crypto.randomBytes(6).toString("hex").toUpperCase(); // 12 hex chars (48 bits)
            }

            try {
                // Mark as delivered and set access code
                const updateData: any = { 
                    deliveryStatus: "DELIVERED",
                    deliveredAt: new Date().toISOString(),
                };
                if (isNewAccessCode) {
                    updateData.accessCode = accessCode;
                }

                await db.update(schema.booking)
                    .set(updateData)
                    .where(eq(schema.booking.id, bookingId));

                // Update expiresAt for all photos to 5 days from now
                await db.update(schema.photo)
                    .set({ expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() })
                    .where(eq(schema.photo.bookingId, bookingId));

                updated = true;
            } catch (err: unknown) {
                const error = err as { code?: string };
                if (error?.code === '23505') { // postgres unique violation is typically 23505
                    attempts++;
                    if (attempts >= maxAttempts) {
                        throw new Error("Failed to generate a unique access code after multiple attempts");
                    }
                } else {
                    throw err;
                }
            }
        }
    }

    const downloadLink = `${publicDomain}/booking/${bookingId}/deliverables?code=${accessCode}`;

    const promises = [];

    // Email
    if (booking.client?.email) {
        promises.push(
            sendDeliveryEmail({
                email: booking.client.email,
                clientName: booking.client.name,
                studioName: booking.studio?.name || "",
                downloadLink,
                accessCode: accessCode ?? "",
            })
        );
    }

    // SMS
    if (booking.client?.phone) {
        const smsRes = await sendDeliverySMS({
            phone: booking.client.phone,
            clientName: booking.client.name,
            studioName: booking.studio?.name || "",
            downloadLink,
            accessCode: accessCode ?? "",
        }).catch(e => { console.error("Termii Delivery SMS failed", e); return null; });

        if (smsRes && smsRes.message_id) {
            await db.insert(schema.notification).values({
                id: uuidv4(),
                type: "PHOTOS_READY",
                channel: ["SMS"],
                clientPhone: booking.client.phone,
                clientEmail: booking.client.email,
                clientName: booking.client.name,
                message: "Photos are ready for download",
                status: "SENT",
                providerId: smsRes.message_id,
                bookingId: booking.id,
            }).catch((e: any) => console.error("[Delivery] Failed to save SMS notification:", e));
        }

        if (process.env.TERMII_WHATSAPP_SENDER_ID) {
            const waRes = await sendDeliveryWhatsApp({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio?.name || "",
                downloadLink,
                accessCode: accessCode ?? "",
            }).catch(e => { console.error("Termii Delivery WhatsApp failed", e); return null; });

            if (waRes && waRes.message_id) {
                await db.insert(schema.notification).values({
                    id: uuidv4(),
                    type: "PHOTOS_READY",
                    channel: ["WHATSAPP"],
                    clientPhone: booking.client.phone,
                    clientEmail: booking.client.email,
                    clientName: booking.client.name,
                    message: "Photos are ready for download",
                    status: "SENT",
                    providerId: waRes.message_id,
                    bookingId: booking.id,
                }).catch((e: any) => console.error("[Delivery] Failed to save WA notification:", e));
            }
        }
    }

    revalidatePath(`/studios/${booking.studio?.slug}/bookings/detail/${bookingId}`);
    return { success: true, accessCode };
}

export async function sendBalanceDueReminder(bookingId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const booking = await db.query.booking.findFirst({
        where: eq(schema.booking.id, bookingId),
        with: {
            client: true,
            studio: true,
            service: { with: { serviceVariants: true } },
            bookingAddons: { with: { service: { with: { serviceVariants: true } } } },
        },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    const member = await db.query.member.findFirst({
        where: and(eq(schema.member.userId, session.user.id), eq(schema.member.studioId, booking.studioId))
    });

    if (!member) {
        throw new Error("Unauthorized access to studio");
    }

    if (!["owner", "admin", "manager", "developer"].includes(member.role)) {
        throw new Error("You do not have permission to send payment reminders");
    }

    const publicDomain = process.env.NEXT_PUBLIC_APP_URL;
    if (!publicDomain) {
        throw new Error("NEXT_PUBLIC_APP_URL environment variable is missing");
    }

    const servicePrice = Number(
        booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ??
            booking.service?.serviceVariants?.[0]?.basePrice ??
            0
    );
    const sessionTotal = servicePrice * booking.sessionCount;
    const addonsTotal = (booking.bookingAddons || []).reduce((sum: number, a: any) => {
        const addonService = a.service || a;
        const variantId = addonService.addonVariantId;
        const variant = variantId
            ? addonService.serviceVariants?.find((v: any) => v.id === variantId)
            : addonService.serviceVariants?.[0];
        return sum + Number(variant?.basePrice ?? 0);
    }, 0);
    const fallbackGrandTotal = sessionTotal + addonsTotal;

    const { pendingReference, balanceDue } = await db.transaction(async (tx) => {
        const [lockedBooking] = await tx
            .select({ id: schema.booking.id, totalAmount: schema.booking.totalAmount })
            .from(schema.booking)
            .where(eq(schema.booking.id, bookingId))
            .for("update");

        if (!lockedBooking) {
            throw new Error("Booking not found");
        }

        const payments = await tx.query.payment.findMany({
            where: eq(schema.payment.bookingId, bookingId),
        });

        const totalPaidKobo = payments
            .filter((p) => p.status === "PAID")
            .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
        const grandTotalKobo = Math.round(
            Number(lockedBooking.totalAmount ?? fallbackGrandTotal) * 100
        );
        const balanceDueKobo = Math.max(0, grandTotalKobo - totalPaidKobo);

        if (balanceDueKobo <= 0) {
            throw new Error("There is no outstanding balance for this booking.");
        }

        const pendingPayments = payments.filter((p) => p.status === "PENDING");
        const matchingPending = pendingPayments.find(
            (p) =>
                typeof p.paystackReference === "string" &&
                p.paystackReference.length > 0 &&
                Math.round(Number(p.amount) * 100) === balanceDueKobo
        );

        const stalePendingIds = pendingPayments
            .filter((p) => p.id !== matchingPending?.id)
            .map((p) => p.id);

        if (stalePendingIds.length > 0) {
            await tx
                .update(schema.payment)
                .set({ status: "CANCELLED" })
                .where(inArray(schema.payment.id, stalePendingIds));
        }

        const computedBalanceDue = balanceDueKobo / 100;

        if (matchingPending?.paystackReference) {
            return {
                pendingReference: matchingPending.paystackReference,
                balanceDue: computedBalanceDue,
            };
        }

        const newReference = `gmax-${crypto.randomBytes(12).toString("hex")}`;
        const receiptNumber = `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
        const amountStr = computedBalanceDue.toFixed(2);
        await tx.insert(schema.payment).values({
            id: uuidv4(),
            amount: amountStr,
            expectedAmount: amountStr,
            method: "TRANSFER",
            status: "PENDING",
            paystackReference: newReference,
            receiptNumber,
            bookingId: booking.id,
            recordedById: session.user.id,
        });

        return {
            pendingReference: newReference,
            balanceDue: computedBalanceDue,
        };
    });

    const paymentLink = `${publicDomain}/pay/${pendingReference}`;

    const { sendPaymentLinkSMS, sendPaymentLinkWhatsApp } = await import("@/lib/termii");

    const promises = [];

    if (booking.client?.phone) {
        promises.push(
            sendPaymentLinkSMS({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio?.name || "",
                amount: balanceDue,
                paymentLink: paymentLink
            }).catch(err => console.error("Balance Due SMS failed:", err))
        );

        promises.push(
            sendPaymentLinkWhatsApp({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio?.name || "",
                amount: balanceDue,
                paymentLink: paymentLink
            }).catch(err => console.error("Balance Due WhatsApp failed:", err))
        );
    }

    await Promise.allSettled(promises);

    revalidatePath(`/studios/${booking.studio?.slug}/bookings/detail/${bookingId}`);
    return { success: true };
}
