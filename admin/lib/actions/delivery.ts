"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { eq, and } from "drizzle-orm";
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
                accessCode = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars, e.g., "A1B2C3"
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

    const downloadLink = `\${publicDomain}/booking/\${bookingId}/deliverables?code=\${accessCode}`;

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

    revalidatePath(`/studios/\${booking.studio?.slug}/bookings/detail/\${bookingId}`);
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
            service: true,
        },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    const payments = await db.query.payment.findMany({
        where: eq(schema.payment.bookingId, bookingId)
    });

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

    const totalPaid = payments
        .filter((p: any) => p.status === "PAID")
        .reduce((sum: any, p: any) => sum + Number(p.amount), 0);
    const grandTotal = Number(booking.totalAmount);
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    if (balanceDue <= 0) {
        throw new Error("There is no outstanding balance for this booking.");
    }


    const paymentLink = `\${publicDomain}/pay/\${booking.id}`;

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

    revalidatePath(`/studios/\${booking.studio?.slug}/bookings/detail/\${bookingId}`);
    return { success: true };
}
