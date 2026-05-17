// router/payments.ts
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { paystackFetch } from "@/lib/paystack";
import { sendPurchaseAccessEmail, sendPurchaseAccessSMS, sendBookingPaymentEmail } from "@/lib/termii";
import crypto from "crypto";

const os = implement(contract).$context<BaseContext>();

const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3000";

function generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

function formatCurrency(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(num);
}

export const verifyPurchase = os.payment.verifyPurchase
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const payment = await prisma.payment.findUnique({
            where: { paystackReference: input.reference },
            include: {
                productAccess: true,
                booking: {
                    include: {
                        client: true,
                        service: true,
                    },
                },
            },
        });

        if (!payment) {
            return { verified: false };
        }

        // If already verified, return early
        if (payment.status === "PAID") {
            return {
                verified: true,
                buyerId: payment.productAccess?.buyerId,
            };
        }

        try {
            // Verify with Paystack
            const response = await paystackFetch<{ data?: { status?: string } }>(`/transaction/verify/${input.reference}`);
            
            if (response.data?.status === "success") {
                // Update payment status
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: "PAID" }
                });

                // ── Product purchase ──────────────────────────────────
                const paystackRes = payment.paystackResponse as { pendingProduct?: { title: string }, pendingBuyer?: { name: string, email: string }, productId?: string, buyerId?: string } | null;
                if (paystackRes?.pendingProduct && paystackRes?.pendingBuyer) {
                    const productId = paystackRes.productId;
                    const buyerId = paystackRes.buyerId;
                    
                    if (productId && buyerId && !payment.productAccess) {
                        await prisma.productAccess.create({
                            data: {
                                productId,
                                buyerId,
                                paymentId: payment.id,
                            }
                        });
                    }

                    // Generate a magic link token and send it to the buyer
                    if (buyerId) {
                        try {
                            const token = generateToken();
                            await prisma.buyerAccessToken.create({
                                data: {
                                    buyerId,
                                    token,
                                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                                    used: false,
                                },
                            });

                            const accessLink = `${PORTAL_URL}/shop/access/${token}`;
                            const buyerEmail = paystackRes.pendingBuyer?.email;
                            const buyerName = paystackRes.pendingBuyer?.name || "Customer";
                            const productTitle = paystackRes.pendingProduct?.title || "Digital Product";

                            // Send email notification
                            if (buyerEmail) {
                                await sendPurchaseAccessEmail({
                                    email: buyerEmail,
                                    buyerName,
                                    productTitle,
                                    accessLink,
                                    amount: formatCurrency(Number(payment.amount)),
                                }).catch(err => {
                                    console.error("[verifyPurchase] Failed to send purchase email:", err);
                                });
                            }

                            // Also send SMS if we have the phone number
                            const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
                            if (buyer?.phone) {
                                await sendPurchaseAccessSMS({
                                    phone: buyer.phone,
                                    productTitle,
                                    accessLink,
                                }).catch(err => {
                                    console.error("[verifyPurchase] Failed to send purchase SMS:", err);
                                });
                            }

                            console.log(`[verifyPurchase] Access link sent to ${buyerEmail}: ${accessLink}`);
                        } catch (notifErr) {
                            // Don't fail the verification if notifications fail
                            console.error("[verifyPurchase] Notification error:", notifErr);
                        }
                    }
                    
                    return { verified: true, buyerId };
                }

                // ── Booking payment ──────────────────────────────────
                if (payment.bookingId && payment.booking) {
                    await prisma.booking.update({
                        where: { id: payment.bookingId },
                        data: { paymentStatus: "PAID" }
                    });

                    // Send booking confirmation email
                    const clientEmail = payment.booking.client?.email;
                    if (clientEmail) {
                        try {
                            await sendBookingPaymentEmail({
                                email: clientEmail,
                                clientName: payment.booking.client?.name || "Customer",
                                serviceName: payment.booking.service?.name || "Service",
                                amount: formatCurrency(Number(payment.amount)),
                                reference: input.reference,
                            });
                            console.log(`[verifyPurchase] Booking confirmation sent to ${clientEmail}`);
                        } catch (emailErr) {
                            console.error("[verifyPurchase] Failed to send booking email:", emailErr);
                        }
                    }

                    return { verified: true };
                }

                return { verified: true };
            }
        } catch (e) {
            console.error("[verifyPurchase] Paystack verification failed:", e);
        }

        return { verified: false };
    });

export const getPublicPaymentDetails = os.payment.getPublicPaymentDetails
    .use(optionalAuthMiddleware)
    .handler(async ({ input }) => {
        const payment = await prisma.payment.findUnique({
            where: { paystackReference: input.reference },
            include: {
                booking: {
                    include: {
                        client: true,
                        service: {
                            include: { studioSession: true },
                        },
                        studio: true,
                        addons: true,
                    },
                },
                productAccess: {
                    include: {
                        product: true,
                        buyer: true,
                    }
                }
            },
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        const isAlreadyPaid = payment.status === "PAID";

        const bookingData = payment.booking ? {
            sessionCount: payment.booking.sessionCount,
            bookingDate: payment.booking.bookingDate.toISOString(),
            client: payment.booking.client ? {
                name: payment.booking.client.name,
                email: payment.booking.client.email,
            } : null,
            service: payment.booking.service ? {
                name: payment.booking.service.name,
                duration: payment.booking.service.studioSession?.duration || 45,
            } : null,
            studio: payment.booking.studio ? {
                name: payment.booking.studio.name,
                logo: payment.booking.studio.logo,
            } : null,
            addons: payment.booking.addons.map(a => ({
                id: a.id,
                name: a.name,
            })),
        } : null;

        const paystackRes = payment.paystackResponse as { pendingProduct?: { title: string }, pendingBuyer?: { name: string, email: string } } | null;
        const productAccessData = payment.productAccess ? {
            product: { title: payment.productAccess.product.title },
            buyer: { name: payment.productAccess.buyer.name, email: payment.productAccess.buyer.email },
        } : paystackRes?.pendingProduct ? {
            product: { title: paystackRes.pendingProduct.title },
            buyer: { name: paystackRes.pendingBuyer?.name || "Customer", email: paystackRes.pendingBuyer?.email || "" },
        } : null;

        return {
            amount: payment.amount.toString(),
            status: payment.status,
            isAlreadyPaid,
            booking: bookingData,
            productAccess: productAccessData,
        };
    });