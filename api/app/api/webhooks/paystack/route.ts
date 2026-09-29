import crypto from "crypto";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { sendSMS } from "@/lib/termii";
import { getPostHogClient } from "@/lib/auth";
import { bookingIntent, studio, client, service, booking, payment, productAccess, bookingAddons } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

async function captureEvent(event: string, properties: Record<string, string | number | boolean>) {
    const posthog = getPostHogClient();
    if (!posthog) return;

    posthog.capture({ event, properties });
    await posthog.flush();
}

function generateReceiptNumber(): string {
    return `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

const PORTAL_URL = process.env.PORTAL_URL ?? "";

export async function POST(req: Request) {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    const secret = process.env.PAYSTACK_SECRET_KEY!;

    const expectedSignature = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

    if (signature !== expectedSignature) {
        return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event !== "charge.success") {
        return Response.json({ received: true });
    }

    const { reference } = payload.data;

    // ── Public Booking Flow ───────────────────────────────────────────────────

    if (reference.startsWith("gmax-pub-")) {
        const intent = await db.query.bookingIntent.findFirst({
            where: (bookingIntent, { eq }) => eq(bookingIntent.paystackReference, reference),
        });

        if (!intent || intent.status !== "PENDING") {
            console.info(`[Webhook] Intent ${reference} already processed or not found`);
            return Response.json({ received: true });
        }

        const paidAmount = Number(payload.data.amount ?? 0);
        const paidCurrency = String(payload.data.currency ?? "").toUpperCase();
        const expectedAmount = Math.round(Number(intent.amount) * 100);

        if (paidAmount !== expectedAmount || paidCurrency !== "NGN") {
            console.error(
                `[Webhook] Booking payment mismatch for ${reference}. expected ${expectedAmount} NGN, got ${paidAmount} ${paidCurrency}`
            );
            await db.update(bookingIntent)
                .set({ status: "FAILED" })
                .where(eq(bookingIntent.paystackReference, reference));
            return Response.json({ received: true });
        }

        const foundStudio = await db.query.studio.findFirst({
            where: (studio, { eq }) => eq(studio.id, intent.studioId),
            with: { members: true },
        });

        if (!foundStudio) {
            console.error(`[Webhook] Studio not found: ${intent.studioId}`);
            await db.update(bookingIntent)
                .set({ status: "FAILED" })
                .where(eq(bookingIntent.paystackReference, reference));
            return Response.json({ received: true });
        }

        const defaultMember =
            foundStudio.members.find(m => m.role === "owner") ?? foundStudio.members[0];

        if (!defaultMember) {
            console.error(`[Webhook] No staff member for studio: ${intent.studioId}`);
            await db.update(bookingIntent)
                .set({ status: "FAILED" })
                .where(eq(bookingIntent.paystackReference, reference));
            return Response.json({ received: true });
        }

        let bookingId = "";

        await db.transaction(async (tx) => {
            // 1. Resolve client
            let clientId = intent.existingClientId;

            if (!clientId) {
                const phone = intent.clientPhone?.trim() ?? "";

                let existing = null;
                if (intent.clientEmail) {
                    existing = await tx.query.client.findFirst({
                        where: (client, { and, eq }) => and(eq(client.studioId, intent.studioId), eq(client.email, intent.clientEmail!)),
                    });
                }
                if (!existing && phone) {
                    existing = await tx.query.client.findFirst({
                        where: (client, { and, eq }) => and(eq(client.studioId, intent.studioId), eq(client.phone, phone)),
                    });
                }

                if (existing) {
                    clientId = existing.id;
                } else {
                    const [newClient] = await tx.insert(client).values({
                        id: uuidv4(),
                        name: intent.clientName,
                        phone,
                        email: intent.clientEmail ?? null,
                        type: "regular",
                        studioId: intent.studioId,
                        updatedAt: new Date().toISOString(),
                    }).returning();
                    clientId = newClient.id;
                }
            }

            // 2. Create booking
            const foundService = await tx.query.service.findFirst({
                where: (service, { eq }) => eq(service.id, intent.serviceId),
                with: { serviceVariants: true },
            });
            
            const [newBooking] = await tx.insert(booking).values({
                id: uuidv4(),
                bookingDate: intent.bookingDate,
                sessionCount: intent.sessionCount,
                notes: intent.notes,
                totalAmount: intent.totalAmount,
                paymentPlan: intent.paymentPlan,
                bookingStatus: "CONFIRMED",
                paymentStatus: intent.paymentPlan === "FULL" ? "PAID" : "PARTIALLY_PAID",
                deliveryStatus: "PENDING",
                serviceId: intent.serviceId,
                studioId: intent.studioId,
                        updatedAt: new Date().toISOString(),
                clientId: clientId!,
                memberId: defaultMember.id,
                createdBy: defaultMember.userId,
                serviceVariantId: intent.serviceVariantId ?? foundService?.serviceVariants?.[0]?.id ?? null,
            }).returning();

            bookingId = newBooking.id;

            if (intent.addonIds && intent.addonIds.length > 0) {
                const uniqueAddonIds = [...new Set(intent.addonIds.map((id: string) => id.split(":")[0]))];
                await tx.insert(bookingAddons).values(
                    uniqueAddonIds.map(id => ({
                        a: bookingId,
                        b: id
                    }))
                );
            }

            // 3. Create payment record
            const installmentType = intent.paymentPlan === "FULL" ? "FULL" : "DEPOSIT";
            await tx.insert(payment).values({
                id: uuidv4(),
                amount: intent.amount,
                method: "TRANSFER",
                status: "PAID",
                paystackReference: reference,
                paystackResponse: payload.data,
                receiptNumber: generateReceiptNumber(),
                bookingId: bookingId,
                recordedById: defaultMember.userId,
                installmentType,
                sequence: 1,
                expectedAmount: intent.amount,
                paymentDate: new Date().toISOString(),
            });

            // 4. Mark intent resolved
            await tx.update(bookingIntent)
                .set({
                    status: "COMPLETED",
                    resolvedBookingId: bookingId,
                })
                .where(eq(bookingIntent.paystackReference, reference));
        });

        // 5. Send SMS notification to client (fire-and-forget)
        try {
            const clientPhone = intent.clientPhone?.trim();
            if (clientPhone) {
                const serviceRes = await db.query.service.findFirst({
                    where: (service, { eq }) => eq(service.id, intent.serviceId),
                    columns: { name: true }
                });
                const bookingDate = new Date(intent.bookingDate).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                const amount = Number(intent.amount).toLocaleString("en-NG");
                const planLabel = intent.paymentPlan === "FULL" ? "Full" : intent.paymentPlan === "HALF" ? "Half (50%)" : "Quarter (25%)";
                const verifyLink = `${PORTAL_URL}/booking/verify?reference=${reference}`;
                const message = `GMAX Studioz: Booking Confirmed! ✅\n\nService: ${serviceRes?.name ?? "Session"}\nDate: ${bookingDate}\nPaid: ₦${amount} (${planLabel})\nRef: ${reference}\n\nView details: ${verifyLink}`;

                await sendSMS(clientPhone, message);
                console.info(`[Webhook] SMS sent to ${clientPhone} for ${reference}`);
            }
        } catch (smsErr) {
            console.error(`[Webhook] SMS notification failed for ${reference}:`, smsErr);
            // Don't fail the webhook — booking is already created
        }

        await captureEvent("booking_payment_completed", {
            payment_plan: intent.paymentPlan,
            session_count: intent.sessionCount,
        });

        return Response.json({ received: true });
    }

    // ── Shop Flow (payment record already exists) ─────────────────────────────
    if (reference.startsWith("gmax-shop-")) {
        const foundPayment = await db.query.payment.findFirst({
            where: (payment, { eq }) => eq(payment.paystackReference, reference),
        });

        if (!foundPayment) {
            console.warn(`[Webhook] No payment for shop reference: ${reference}`);
            return Response.json({ received: true });
        }

        // Idempotency guard
        if (foundPayment.status === "PAID") {
            console.info(`[Webhook] Shop payment ${reference} already processed`);
            return Response.json({ received: true });
        }

        const paidAmount = Number(payload.data.amount ?? 0);
        const paidCurrency = String(payload.data.currency ?? "").toUpperCase();
        const expectedAmount = Math.round(Number(foundPayment.expectedAmount ?? foundPayment.amount) * 100);

        if (paidAmount !== expectedAmount || paidCurrency !== "NGN") {
            console.error(
                `[Webhook] Shop payment mismatch for ${reference}. expected ${expectedAmount} NGN, got ${paidAmount} ${paidCurrency}`
            );
            await db.update(payment)
                .set({
                    status: "PENDING",
                    paystackResponse: payload.data,
                    paymentDate: new Date().toISOString(),
                })
                .where(eq(payment.id, foundPayment.id));
            return Response.json({ received: true });
        }

        const { product_id, buyer_id } = payload.data.metadata ?? {};

        if (!product_id || !buyer_id) {
            console.error(`[Webhook] Missing metadata for shop reference: ${reference}`);
            return Response.json({ received: true });
        }

        await db.transaction(async (tx) => {
            await tx.update(payment)
                .set({
                    status: "PAID",
                    paystackResponse: payload.data,
                    paymentDate: new Date().toISOString(),
                })
                .where(eq(payment.id, foundPayment.id));

            await tx.insert(productAccess)
                .values({
                    id: uuidv4(),
                    productId: product_id,
                    buyerId: buyer_id,
                    paymentId: foundPayment.id,
                })
                .onConflictDoUpdate({
                    target: [productAccess.productId, productAccess.buyerId],
                    set: { paymentId: foundPayment.id }
                });
        });

        await captureEvent("product_purchase_completed", {});

        return Response.json({ received: true });
    }

    console.warn(`[Webhook] Unrecognised reference prefix: ${reference}`);
    return Response.json({ received: true });
}