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

    // Generate access code if one doesn't exist
    if (booking.deliveryStatus === "DELIVERED") {
        return;
    }

    const publicDomain = process.env.NEXT_PUBLIC_APP_URL;
    if (!publicDomain) {
        throw new Error("NEXT_PUBLIC_APP_URL environment variable is missing");
    }

    let accessCode = booking.accessCode;
    const isNewAccessCode = !accessCode;

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
                    ...(isNewAccessCode && { accessCode })
                },
            });
            updated = true;
        } catch (error: any) {
            if (error.code === 'P2025') {
                 // Record to update not found. Could mean it was already delivered by a concurrent request.
                 return;
            }
            if (isNewAccessCode && error.code === 'P2002') {
                attempts++;
                if (attempts >= maxAttempts) {
                    throw new Error("Failed to generate a unique access code after multiple attempts");
                }
            } else {
                throw error;
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

    // SMS & WhatsApp
    if (booking.client.phone) {
        promises.push(
            sendDeliverySMS({
                phone: booking.client.phone,
                clientName: booking.client.name,
                studioName: booking.studio.name,
                downloadLink,
                accessCode,
            })
        );

        if (process.env.TERMII_WHATSAPP_SENDER_ID) {
            promises.push(
                sendDeliveryWhatsApp({
                    phone: booking.client.phone,
                    clientName: booking.client.name,
                    studioName: booking.studio.name,
                    downloadLink,
                    accessCode,
                })
            );
        }
    }

    await Promise.allSettled(promises);

    revalidatePath(`/studios/${booking.studio.slug}/bookings/detail/${bookingId}`);
    return { success: true, accessCode };
}
