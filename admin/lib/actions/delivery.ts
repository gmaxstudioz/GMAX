"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendDeliveryEmail, sendDeliverySMS, sendDeliveryWhatsApp } from "@/lib/termii";
import crypto from "crypto";
import { auth } from "../auth";
import { headers } from "next/headers";

export async function deliverBooking(bookingId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            client: true,
            studio: true,
        },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    const member = await prisma.member.findFirst({
        where: { userId: session.user.id, studioId: booking.studioId }
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
                await prisma.booking.update({
                    where: { id: bookingId, deliveryStatus: { not: "DELIVERED" } },
                    data: { 
                        deliveryStatus: "DELIVERED",
                        deliveredAt: new Date(),
                        ...(isNewAccessCode && { accessCode })
                    },
                });

                // Update expiresAt for all photos to 5 days from now
                await prisma.photo.updateMany({
                    where: { bookingId },
                    data: {
                        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                    }
                });

                updated = true;
            } catch (err: unknown) {
                const error = err as { code?: string };
                if (error?.code === 'P2025') {
                    // Record to update not found. Could mean it was already delivered by a concurrent request.
                    break;
                }
                if (isNewAccessCode && error?.code === 'P2002') {
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
    if (booking.client.email) {
        promises.push(
            sendDeliveryEmail({
                email: booking.client.email,
                clientName: booking.client.name,
                studioName: booking.studio.name,
                downloadLink,
                accessCode: accessCode ?? "",
            })
        );
    }

    // SMS
    if (booking.client.phone) {
        const smsRes = await sendDeliverySMS({
            phone: booking.client.phone,
            clientName: booking.client.name,
            studioName: booking.studio.name,
            downloadLink,
            accessCode,
        }).catch(e => { console.error("Termii Delivery SMS failed", e); return null; });

        if (smsRes && smsRes.message_id) {
            await prisma.notification.create({
                data: {
                    type: "PHOTOS_READY",
                    channel: ["SMS"],
                    clientPhone: booking.client.phone,
                    clientEmail: booking.client.email,
                    clientName: booking.client.name,
                    message: "Photos are ready for download",
                    status: "SENT",
                    providerId: smsRes.message_id,
                    bookingId: booking.id,
                }
            }).catch(e => console.error("[Delivery] Failed to save SMS notification:", e));
        }

        if (process.env.TERMII_WHATSAPP_SENDER_ID) {
            const waRes = await sendDeliveryWhatsApp({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio.name,
                downloadLink,
                accessCode,
            }).catch(e => { console.error("Termii Delivery WhatsApp failed", e); return null; });

            if (waRes && waRes.message_id) {
                await prisma.notification.create({
                    data: {
                        type: "PHOTOS_READY",
                        channel: ["WHATSAPP"],
                        clientPhone: booking.client.phone,
                        clientEmail: booking.client.email,
                        clientName: booking.client.name,
                        message: "Photos are ready for download",
                        status: "SENT",
                        providerId: waRes.message_id,
                        bookingId: booking.id,
                    }
                }).catch(e => console.error("[Delivery] Failed to save WA notification:", e));
            }
        }
    }

    revalidatePath(`/studios/${booking.studio.slug}/bookings/detail/${bookingId}`);
    return { success: true, accessCode };
}

export async function sendBalanceDueReminder(bookingId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            client: true,
            studio: true,
            service: true,
            payments: true,
        },
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    const member = await prisma.member.findFirst({
        where: { userId: session.user.id, studioId: booking.studioId }
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

    const totalPaid = booking.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);
    const grandTotal = Number(booking.totalAmount);
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    if (balanceDue <= 0) {
        throw new Error("There is no outstanding balance for this booking.");
    }


    const paymentLink = `${publicDomain}/pay/${booking.id}`;

    const { sendPaymentLinkSMS, sendPaymentLinkWhatsApp } = await import("@/lib/termii");

    const promises = [];

    if (booking.client.phone) {
        promises.push(
            sendPaymentLinkSMS({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio.name,
                amount: balanceDue,
                paymentLink: paymentLink
            }).catch(err => console.error("Balance Due SMS failed:", err))
        );

        promises.push(
            sendPaymentLinkWhatsApp({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio.name,
                amount: balanceDue,
                paymentLink: paymentLink
            }).catch(err => console.error("Balance Due WhatsApp failed:", err))
        );
    }

    await Promise.allSettled(promises);

    revalidatePath(`/studios/${booking.studio.slug}/bookings/detail/${bookingId}`);
    return { success: true };
}
