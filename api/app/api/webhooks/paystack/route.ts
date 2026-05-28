import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { sendBookingPaymentSMS, sendBookingPaymentWhatsApp, sendBookingPaymentEmail, sendAcademyRegistrationEmail, sendAcademyRegistrationSMS, sendAcademyRegistrationWhatsApp } from "@/lib/termii";

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
        // Use Prisma findUnique instead of raw SQL to get proper camelCase fields
        const intent = await prisma.bookingIntent.findUnique({
            where: { paystackReference: reference },
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
            await prisma.bookingIntent.update({
                where: { paystackReference: reference },
                data: { status: "FAILED" },
            });
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

        let newBookingId: string | null = null;
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
                            phone,
                            email:    intent.clientEmail ?? null,
                            type:     "regular",
                            studioId: intent.studioId,
                        },
                    });
                    clientId = client.id;
                }
            }

            // 2. Create booking
            const service = await tx.service.findUnique({
                where: { id: intent.serviceId },
                include: { variants: true },
            });
            const booking = await tx.booking.create({
                data: {
                    bookingDate:   intent.bookingDate,
                    sessionCount:  intent.sessionCount,
                    extraPicturesCount: intent.extraPicturesCount,
                    notes:         intent.notes,
                    totalAmount:   intent.totalAmount,
                    paymentPlan:   intent.paymentPlan,
                    bookingStatus: "CONFIRMED",
                    paymentStatus: intent.paymentPlan === "FULL" ? "PAID" : "PARTIALLY_PAID",
                    deliveryStatus: "PENDING",
                    serviceId:     intent.serviceId,
                    studioId:      intent.studioId,
                    clientId:      clientId!,
                    memberId:      defaultMember.id,
                    createdBy:     defaultMember.userId,
                    serviceVariantId: intent.serviceVariantId ?? service?.variants?.[0]?.id ?? null,
                    ...(intent.addonIds.length > 0 && {
                        addons: { connect: [...new Set(intent.addonIds.map((id: string) => id.split(":")[0]))].map(id => ({ id })) },
                    }),
                },
            });
            
            newBookingId = booking.id;

            // 3. Create payment record
            const installmentType = intent.paymentPlan === "FULL" ? "FULL" : "DEPOSIT";
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
                    installmentType,
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

        // 5. Send notifications to client (fire-and-forget)
        try {
            const clientPhone = intent.clientPhone?.trim();
            const clientEmail = intent.clientEmail?.trim();
            const clientName = intent.clientName || "Customer";
            const service = await prisma.service.findUnique({ where: { id: intent.serviceId }, select: { name: true } });
            const serviceName = service?.name ?? "Session";
            const amountFormatted = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(intent.amount));

            if (clientEmail) {
                await sendBookingPaymentEmail({
                    email: clientEmail,
                    clientName,
                    serviceName,
                    amount: amountFormatted,
                    reference,
                }).catch(err => console.error(`[Webhook] Email notification failed for ${reference}:`, err));
            }

            if (clientPhone) {
                await sendBookingPaymentSMS({
                    phone: clientPhone,
                    serviceName,
                    reference,
                }).catch(err => console.error(`[Webhook] SMS notification failed for ${reference}:`, err));

                await sendBookingPaymentWhatsApp({
                    phone: clientPhone,
                    clientName,
                    serviceName,
                    reference,
                }).catch(err => console.error(`[Webhook] WhatsApp notification failed for ${reference}:`, err));
                
                console.info(`[Webhook] Notifications dispatched for ${reference}`);
            }

            if (newBookingId) {
                const { notifyAdminsOfPayment } = await import("@/lib/notifications");
                await notifyAdminsOfPayment(
                    intent.studioId,
                    newBookingId,
                    Number(intent.amount),
                    clientName,
                    serviceName
                ).catch(err => console.error(`[Webhook] Admin notification failed for ${reference}:`, err));
            }
        } catch (notifErr) {
            console.error(`[Webhook] Notification dispatch failed for ${reference}:`, notifErr);
            // Don't fail the webhook — booking is already created
        }

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

        const paidAmount = Number(payload.data.amount ?? 0);
        const paidCurrency = String(payload.data.currency ?? "").toUpperCase();
        const expectedAmount = Math.round(Number(payment.expectedAmount ?? payment.amount) * 100);

        if (paidAmount !== expectedAmount || paidCurrency !== "NGN") {
            console.error(
                `[Webhook] Shop payment mismatch for ${reference}. expected ${expectedAmount} NGN, got ${paidAmount} ${paidCurrency}`
            );
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: "PENDING",
                    paystackResponse: payload.data,
                    paymentDate: new Date(),
                },
            });
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

    // ── Academy Flow ──────────────────────────────────────────────────────────
    if (reference.startsWith("gmax-academy-")) {
        const registration = await prisma.academyStudent.findUnique({
            where: { paymentReference: reference },
            include: { course: true, batch: true },
        });

        if (!registration) {
            console.warn(`[Webhook] No registration for academy reference: ${reference}`);
            return Response.json({ received: true });
        }

        if (registration.paymentStatus === "SUCCESS") {
            console.info(`[Webhook] Academy payment ${reference} already processed`);
            return Response.json({ received: true });
        }

        const paidAmount = Number(payload.data.amount ?? 0);
        const paidCurrency = String(payload.data.currency ?? "").toUpperCase();
        const expectedAmount = Math.round(Number(registration.amountPaid) * 100);

        if (paidAmount !== expectedAmount || paidCurrency !== "NGN") {
            console.error(
                `[Webhook] Academy payment mismatch for ${reference}. expected ${expectedAmount} NGN, got ${paidAmount} ${paidCurrency}`
            );
            await prisma.academyStudent.update({
                where: { id: registration.id },
                data: { paymentStatus: "FAILED" },
            });
            return Response.json({ received: true });
        }

        await prisma.academyStudent.update({
            where: { id: registration.id },
            data: { paymentStatus: "SUCCESS" },
        });

        const startDateStr = registration.batch?.startDate 
            ? new Date(registration.batch.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : "a date to be announced";

        try {
            await sendAcademyRegistrationEmail({
                email: registration.email,
                studentName: registration.firstName,
                courseName: registration.course.title,
                startDate: startDateStr,
                amountPaid: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(registration.amountPaid)),
            }).catch(err => console.error(`[Webhook] Academy Email failed for ${reference}:`, err));

            if (registration.phone) {
                await sendAcademyRegistrationSMS({
                    phone: registration.phone,
                    courseName: registration.course.title,
                    startDate: startDateStr,
                }).catch(err => console.error(`[Webhook] Academy SMS failed for ${reference}:`, err));
                
                await sendAcademyRegistrationWhatsApp({
                    phone: registration.phone,
                    courseName: registration.course.title,
                    startDate: startDateStr,
                }).catch(err => console.error(`[Webhook] Academy WhatsApp failed for ${reference}:`, err));
            }
            console.info(`[Webhook] Academy notifications dispatched for ${reference}`);
        } catch (notifErr) {
            console.error(`[Webhook] Academy notification dispatch failed for ${reference}:`, notifErr);
        }

        return Response.json({ received: true });
    }

    console.warn(`[Webhook] Unrecognised reference prefix: ${reference}`);
    return Response.json({ received: true });
}