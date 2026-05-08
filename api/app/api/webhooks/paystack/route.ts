import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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
    const payment = await prisma.payment.findUnique({
        where: { paystackReference: reference },
    });

    if (!payment) {
        console.warn(`[Webhook] No payment for reference: ${reference}`);
        return Response.json({ received: true });
    }

    if (reference.startsWith("gmax-pub-")) {
        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "PAID", paystackResponse: payload.data, paymentDate: new Date() },
            });
            if (payment.bookingId) {
                await tx.booking.update({
                    where: { id: payment.bookingId },
                    data: { paymentStatus: "PAID" },
                });
            }
        });
    }

    if (reference.startsWith("gmax-shop-")) {
        const { product_id, buyer_id } = payload.data.metadata ?? {};
        if (!product_id || !buyer_id) {
            console.error(`[Webhook] Missing metadata for: ${reference}`);
            return Response.json({ received: true });
        }

        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: "PAID", paystackResponse: payload.data, paymentDate: new Date() },
            });
            await tx.productAccess.upsert({
                where: { productId_buyerId: { productId: product_id, buyerId: buyer_id } },
                create: { productId: product_id, buyerId: buyer_id, paymentId: payment.id },
                update: {},
            });
        });
    }

    return Response.json({ received: true });
}