"use server";

import { db } from "../db";
import { booking, member } from "../schema";
import { eq, and } from "drizzle-orm";
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

    const bookingData = await db.query.booking.findFirst({
        where: eq(booking.id, bookingId),
        with: {
            client: true,
            studio: true,
        },
    });

    if (!bookingData) {
        throw new Error("Booking not found");
    }

    const memberData = await db.query.member.findFirst({
        where: and(
            eq(member.userId, session.user.id),
            eq(member.studioId, bookingData.studioId)
        )
    });

    if (!memberData) {
        throw new Error("Unauthorized access to studio");
    }

    // Generate access code if one doesn't exist
    let accessCode = bookingData.accessCode;
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
            const updateData: any = { deliveryStatus: "DELIVERED" };
            if (isNewAccessCode) {
                updateData.accessCode = accessCode;
            }
            await db.update(booking)
                .set(updateData)
                .where(eq(booking.id, bookingId));
            updated = true;
        } catch (error: any) {
            // Drizzle/postgres duplicate key error code is 23505 usually
            if (isNewAccessCode && (error.code === '23505' || error.code === 'P2002')) {
                attempts++;
                if (attempts >= maxAttempts) {
                    throw new Error("Failed to generate a unique access code after multiple attempts");
                }
            } else {
                throw error;
            }
        }
    }

    // Send notifications
    // Assume public app runs on the same domain for now, or a known env variable
    const publicDomain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const downloadLink = `${publicDomain}/booking/${bookingId}/deliverables?code=${accessCode}`;

    const promises = [];

    // Email
    if (bookingData.client?.email) {
        promises.push(
            sendDeliveryEmail({
                email: bookingData.client.email,
                clientName: bookingData.client.name,
                studioName: bookingData.studio?.name || "",
                downloadLink,
                accessCode: accessCode ?? "",
            })
        );
    }

    // SMS & WhatsApp
    if (bookingData.client?.phone) {
        promises.push(
            sendDeliverySMS({
                phone: bookingData.client.phone,
                clientName: bookingData.client.name,
                studioName: bookingData.studio?.name || "",
                downloadLink,
                accessCode,
            })
        );

        if (process.env.TERMII_WHATSAPP_SENDER_ID) {
            promises.push(
                sendDeliveryWhatsApp({
                    phone: bookingData.client.phone,
                    clientName: bookingData.client.name,
                    studioName: bookingData.studio?.name || "",
                    downloadLink,
                    accessCode,
                })
            );
        }
    }

    await Promise.allSettled(promises);

    revalidatePath(`/studios/${bookingData.studio?.slug}/bookings/detail/${bookingId}`);
    return { success: true, accessCode };
}
