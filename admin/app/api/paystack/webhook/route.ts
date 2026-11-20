import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payment as paymentModel, booking as bookingModel } from "@/lib/schema";
import { and, eq, ne } from "drizzle-orm";
import crypto from "crypto";

function timingSafeEqualStr(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
    try {
        const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecret) {
            console.error("[Paystack Webhook] PAYSTACK_SECRET_KEY is not configured");
            return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
        }

        const body = await req.text();

        // Verify HMAC signature
        const signature = req.headers.get("x-paystack-signature");
        if (!signature) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const hash = crypto
            .createHmac("sha512", paystackSecret)
            .update(body)
            .digest("hex");

        if (!timingSafeEqualStr(signature, hash)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        let event: any;
        try {
            event = JSON.parse(body);
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (event?.event === "charge.success" && typeof event?.data?.reference === "string") {
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
                const paidAmount = Number(event.data.amount ?? 0);
                const paidCurrency = String(event.data.currency ?? "").toUpperCase();
                const expectedAmount = Math.round(Number(payment.expectedAmount ?? payment.amount) * 100);

                if (paidAmount !== expectedAmount || paidCurrency !== "NGN") {
                    console.error(
                        `[Paystack Webhook] Amount/currency mismatch for ${reference}: expected ${expectedAmount} NGN, got ${paidAmount} ${paidCurrency}`
                    );
                    return NextResponse.json({ received: true });
                }

                const [updated] = await db.update(paymentModel)
                    .set({
                        status: "PAID",
                        paystackResponse: event.data,
                    })
                    .where(and(eq(paymentModel.id, payment.id), ne(paymentModel.status, "PAID")))
                    .returning();

                if (!updated) {
                    return NextResponse.json({ received: true });
                }

                // Recalculate total paid
                const allPayments = await db.query.payment.findMany({
                    where: (p, { eq }) => eq(p.bookingId, payment.bookingId!),
                });

                const totalPaid = allPayments
                    .filter(p => p.status === "PAID")
                    .reduce((a, b) => a + Number(b.amount), 0);

                const booking = payment.booking;
                if (booking && payment.bookingId) {
                    const servicePrice = Number(booking.service?.serviceVariants?.[0]?.basePrice ?? 0);
                    const sessionTotal = servicePrice * booking.sessionCount;
                    const addonsTotal = (booking.bookingAddons || []).reduce((sum: number, a: any) => {
                        return sum + Number(a.service?.serviceVariants?.[0]?.basePrice ?? 0);
                    }, 0);
                    const grandTotal = booking.totalAmount != null ? Number(booking.totalAmount) : (sessionTotal + addonsTotal);

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
