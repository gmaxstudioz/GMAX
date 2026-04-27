import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

if (!PAYSTACK_SECRET) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
}

export async function POST(req: Request) {
    try {
        const body = await req.text();

                // Verify HMAC signature (constant-time)
        const signature = req.headers.get("x-paystack-signature");
        if (!signature) {
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }
        const hash = crypto
            .createHmac("sha512", PAYSTACK_SECRET)
            .update(body)
            .digest("hex");
        const sigBuf = Buffer.from(signature, "hex");
        const hashBuf = Buffer.from(hash, "hex");
        if (
            sigBuf.length !== hashBuf.length ||
            !crypto.timingSafeEqual(sigBuf, hashBuf)
        ) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const event = JSON.parse(body);

        if (event.event === "charge.success") {
            const reference = event.data.reference;

            const payment = await prisma.payment.findFirst({
                where: { paystackReference: reference },
                include: {
                    booking: {
                        include: { service: true, addons: true, payments: true },
                    },
                },
            });

            if (payment && payment.status !== "PAID") {
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: "PAID",
                        paystackResponse: event.data,
                    },
                });

                // Recalculate total paid
                const allPayments = await prisma.payment.findMany({
                    where: { bookingId: payment.bookingId },
                });

                const totalPaid = allPayments
                    .map(p => (p.id === payment.id ? Number(payment.amount) : p.status === "PAID" ? Number(p.amount) : 0))
                    .reduce((a, b) => a + b, 0);

                const booking = payment.booking;
                const servicePrice = booking.service?.salePrice ?? booking.service?.price ?? 0;
                const sessionTotal = servicePrice * booking.sessionCount;
                const addonsTotal = booking.addons.reduce((sum, a) => sum + (a.salePrice ?? a.price), 0);
                const grandTotal = sessionTotal + addonsTotal;

                const newStatus = totalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

                await prisma.booking.update({
                    where: { id: payment.bookingId },
                    data: { paymentStatus: newStatus },
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Paystack Webhook] Error:", error);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}
