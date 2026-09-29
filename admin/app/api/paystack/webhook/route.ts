import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payment as paymentModel, booking as bookingModel } from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";

export async function POST(req: Request) {
    try {
        const body = await req.text();

        // Verify HMAC signature
        const signature = req.headers.get("x-paystack-signature");
        const hash = crypto
            .createHmac("sha512", PAYSTACK_SECRET)
            .update(body)
            .digest("hex");

        if (signature !== hash) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const event = JSON.parse(body);

        if (event.event === "charge.success") {
            const reference = event.data.reference;

            const payment: any = await db.query.payment.findFirst({
                where: (p, { eq }) => eq(p.paystackReference, reference),
                with: {
                    booking: {
                        with: { 
                            service: { with: { serviceVariants: true } }, 
                            bookingAddons: { with: { service: { with: { serviceVariants: true } } } }, 
                            payments: true 
                        },
                    },
                },
            });

            if (payment && payment.status !== "PAID") {
                await db.update(paymentModel)
                    .set({
                        status: "PAID",
                        paystackResponse: event.data,
                    })
                    .where(eq(paymentModel.id, payment.id));

                // Recalculate total paid
                const allPayments = await db.query.payment.findMany({
                    where: (p, { eq }) => eq(p.bookingId, payment.bookingId!),
                });

                const totalPaid = allPayments
                    .map(p => (p.id === payment.id ? Number(payment.amount) : p.status === "PAID" ? Number(p.amount) : 0))
                    .reduce((a, b) => a + b, 0);

                const booking = payment.booking;
                if (booking && payment.bookingId) {
                    const servicePrice = Number(booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
                    const sessionTotal = servicePrice * booking.sessionCount;
                    
                    // In Drizzle, bookingAddons is a join table.
                    const addonsTotal = booking.bookingAddons.reduce((sum: number, a: any) => {
                        return sum + Number(a.service?.serviceVariants?.[0]?.basePrice ?? 0);
                    }, 0);
                    const grandTotal = sessionTotal + addonsTotal;

                    const newStatus = totalPaid >= grandTotal ? "PAID" : "PARTIALLY_PAID";

                    await db.update(bookingModel)
                        .set({ paymentStatus: newStatus })
                        .where(eq(bookingModel.id, payment.bookingId));
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Paystack Webhook] Error:", error);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}
