import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

function generateReceiptNumber(): string {
    return `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

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
        const intent = await prisma.bookingIntent.findUnique({
            where: { paystackReference: reference },
        });

        if (!intent) {
            console.warn(`[Webhook] No booking intent for reference: ${reference}`);
            return Response.json({ received: true });
        }

        // Idempotency guard — Paystack retries webhooks on non-2xx responses
        if (intent.status !== "PENDING") {
            console.info(`[Webhook] Intent ${reference} already processed: ${intent.status}`);
            return Response.json({ received: true });
        }

        const studio = await prisma.studio.findUnique({
            where: { id: intent.studioId },
            include: { members: true },
        });

        if (!studio) {
            console.error(`[Webhook] Studio not found: ${intent.studioId}`);
            await prisma.bookingIntent.update({
                where: { paystackReference: reference },
                data: { status: "FAILED" },
            });
            return Response.json({ received: true });
        }

        const defaultMember =
            studio.members.find(m => m.role === "owner") ?? studio.members[0];

        if (!defaultMember) {
            console.error(`[Webhook] No staff member for studio: ${intent.studioId}`);
            await prisma.bookingIntent.update({
                where: { paystackReference: reference },
                data: { status: "FAILED" },
            });
            return Response.json({ received: true });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Resolve client
            let clientId = intent.existingClientId;

            if (!clientId) {
                const phone = intent.clientPhone?.trim() ?? "";

                let existing = null;
                if (intent.clientEmail) {
                    existing = await tx.client.findFirst({
                        where: { studioId: intent.studioId, email: intent.clientEmail },
                    });
                }
                if (!existing && phone) {
                    existing = await tx.client.findFirst({
                        where: { studioId: intent.studioId, phone },
                    });
                }

                if (existing) {
                    clientId = existing.id;
                } else {
                    const client = await tx.client.create({
                        data: {
                            name:     intent.clientName,
                            phone,                          // ← now a string
                            email:    intent.clientEmail ?? null,
                            type:     "regular",
                            studioId: intent.studioId,
                        },
                    });
                    clientId = client.id;
                }
            }

            // 2. Create booking
            const booking = await tx.booking.create({
                data: {
                    bookingDate:   intent.bookingDate,
                    sessionCount:  intent.sessionCount,
                    notes:         intent.notes,
                    totalAmount:   intent.amount,
                    bookingStatus: "CONFIRMED",
                    paymentStatus: "PAID",
                    deliveryStatus: "PENDING",
                    serviceId:     intent.serviceId,
                    studioId:      intent.studioId,
                    clientId:      clientId!,
                    memberId:      defaultMember.id,
                    createdBy:     defaultMember.userId,
                    ...(intent.addonIds.length > 0 && {
                        addons: { connect: intent.addonIds.map(id => ({ id })) },
                    }),
                },
            });

            // 3. Create payment record
            await tx.payment.create({
                data: {
                    amount:            intent.amount,
                    method:            "TRANSFER",
                    status:            "PAID",
                    paystackReference: reference,
                    paystackResponse:  payload.data,
                    receiptNumber:     generateReceiptNumber(),
                    bookingId:         booking.id,
                    recordedById:      defaultMember.userId,
                    installmentType:   "FULL",
                    sequence:          1,
                    expectedAmount:    intent.amount,
                    paymentDate:       new Date(),
                },
            });

            // 4. Mark intent resolved
            await tx.bookingIntent.update({
                where: { paystackReference: reference },
                data: {
                    status:            "COMPLETED",
                    resolvedBookingId: booking.id,
                },
            });
        });

        return Response.json({ received: true });
    }

    // ── Shop Flow (payment record already exists) ─────────────────────────────
    if (reference.startsWith("gmax-shop-")) {
        const payment = await prisma.payment.findUnique({
            where: { paystackReference: reference },
        });

        if (!payment) {
            console.warn(`[Webhook] No payment for shop reference: ${reference}`);
            return Response.json({ received: true });
        }

        // Idempotency guard
        if (payment.status === "PAID") {
            console.info(`[Webhook] Shop payment ${reference} already processed`);
            return Response.json({ received: true });
        }

        const { product_id, buyer_id } = payload.data.metadata ?? {};

        if (!product_id || !buyer_id) {
            console.error(`[Webhook] Missing metadata for shop reference: ${reference}`);
            return Response.json({ received: true });
        }

        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status:           "PAID",
                    paystackResponse: payload.data,
                    paymentDate:      new Date(),
                },
            });

            await tx.productAccess.upsert({
                where:  { productId_buyerId: { productId: product_id, buyerId: buyer_id } },
                create: { productId: product_id, buyerId: buyer_id, paymentId: payment.id },
                update: {},
            });
        });

        return Response.json({ received: true });
    }

    console.warn(`[Webhook] Unrecognised reference prefix: ${reference}`);
    return Response.json({ received: true });
}