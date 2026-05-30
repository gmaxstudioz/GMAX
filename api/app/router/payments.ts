// router/payments.ts
import { prisma } from "@/lib/prisma";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { paystackFetch } from "@/lib/paystack";
import { sendPurchaseAccessEmail, sendPurchaseAccessSMS, sendPurchaseAccessWhatsApp, sendBookingPaymentEmail, sendBookingPaymentSMS, sendBookingPaymentWhatsApp } from "@/lib/termii";
import { Prisma } from "@/lib/generated/prisma/client";
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
                const paystackRes = payment.paystackResponse as { pendingProduct?: { title: string }, pendingBuyer?: { name: string, email: string }, productId?: string, buyerId?: string } | null;
                const isProductPurchase = Boolean(paystackRes?.pendingProduct && paystackRes?.pendingBuyer);
                const productId = paystackRes?.productId;
                const buyerId = paystackRes?.buyerId;

                try {
                    await prisma.$transaction(async (tx) => {
                        await tx.payment.update({
                            where: { id: payment.id, status: "PENDING" },
                            data: { status: "PAID" },
                        });

                        if (isProductPurchase && productId && buyerId && !payment.productAccess) {
                            try {
                                await tx.productAccess.create({
                                    data: {
                                        productId,
                                        buyerId,
                                        paymentId: payment.id,
                                    },
                                });
                            } catch (error) {
                                const prismaError = error as Prisma.PrismaClientKnownRequestError;
                                if (prismaError.code !== "P2002") {
                                    throw error;
                                }
                                // Duplicate access already exists, treat as already processed.
                            }
                        }
                    });
                } catch (error) {
                    const prismaError = error as Prisma.PrismaClientKnownRequestError;
                    if (prismaError.code === "P2025") {
                        return {
                            verified: true,
                            buyerId: buyerId,
                        };
                    }
                    throw error;
                }

                if (isProductPurchase && buyerId) {
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
                            const emailResult = await sendPurchaseAccessEmail({
                                email: buyerEmail,
                                buyerName,
                                productTitle,
                                accessLink,
                                amount: formatCurrency(Number(payment.amount)),
                            }).catch(err => {
                                console.error("[verifyPurchase] Purchase email failed:", err);
                                return null;
                            });
                            if (!emailResult) {
                                console.warn("[verifyPurchase] Email delivery failed — check Termii logs");
                            }
                        }

                        // Also send SMS & WhatsApp if we have the phone number
                        const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
                        if (buyer?.phone) {
                            await sendPurchaseAccessSMS({
                                phone: buyer.phone,
                                productTitle,
                                accessLink,
                            }).catch(err => {
                                console.error("[verifyPurchase] SMS failed:", err);
                            });

                            await sendPurchaseAccessWhatsApp({
                                phone: buyer.phone,
                                productTitle,
                                accessLink,
                            }).catch(err => {
                                console.error("[verifyPurchase] WhatsApp failed:", err);
                            });
                        }

                        console.log(`[verifyPurchase] Access link sent for buyer ${buyerId}`);
                    } catch (notifErr) {
                        // Don't fail the verification if notifications fail
                        console.error("[verifyPurchase] Notification error:", notifErr);
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

                    // Send SMS and WhatsApp
                    const clientPhone = payment.booking.client?.phone;
                    if (clientPhone) {
                        const clientName = payment.booking.client?.name || "Customer";
                        const serviceName = payment.booking.service?.name || "Service";

                        await sendBookingPaymentSMS({
                            phone: clientPhone,
                            serviceName,
                            reference: input.reference,
                        }).catch(err => {
                            console.error("[verifyPurchase] Booking SMS failed:", err);
                        });

                        await sendBookingPaymentWhatsApp({
                            phone: clientPhone,
                            clientName,
                            serviceName,
                            reference: input.reference,
                        }).catch(err => {
                            console.error("[verifyPurchase] Booking WhatsApp failed:", err);
                        });
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
            // Check if it's a pending booking intent
            const intent = await prisma.bookingIntent.findUnique({
                where: { paystackReference: input.reference },
                include: { studio: true }
            });

            if (!intent) {
                // Check if it's a direct booking ID (for balance payments)
                const booking = await prisma.booking.findUnique({
                    where: { id: input.reference },
                    include: {
                        client: true,
                        service: { include: { studioSession: true } },
                        studio: true,
                        addons: true,
                        payments: true,
                    }
                });

                if (booking) {
                    const totalPaid = booking.payments
                        .filter((p: any) => p.status === "PAID")
                        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                    const grandTotal = Number(booking.totalAmount || 0);
                    const balanceDue = grandTotal - totalPaid;

                    if (balanceDue <= 0) {
                        return {
                            amount: "0",
                            status: "PAID",
                            isAlreadyPaid: true,
                            booking: {
                                sessionCount: booking.sessionCount,
                                bookingDate: booking.bookingDate.toISOString(),
                                client: booking.client ? { name: booking.client.name, email: booking.client.email } : null,
                                service: booking.service ? { name: booking.service.name, duration: booking.service.studioSession?.duration || 45 } : null,
                                studio: booking.studio ? { name: booking.studio.name, logo: booking.studio.logo } : null,
                                addons: booking.addons.map((a: any) => ({ id: a.id, name: a.name })),
                            },
                            productAccess: null,
                        };
                    }

                    return {
                        amount: balanceDue.toString(),
                        status: "PENDING",
                        isAlreadyPaid: false,
                        booking: {
                            sessionCount: booking.sessionCount,
                            bookingDate: booking.bookingDate.toISOString(),
                            client: booking.client ? { name: booking.client.name, email: booking.client.email } : null,
                            service: booking.service ? { name: booking.service.name, duration: booking.service.studioSession?.duration || 45 } : null,
                            studio: booking.studio ? { name: booking.studio.name, logo: booking.studio.logo } : null,
                            addons: booking.addons.map((a: any) => ({ id: a.id, name: a.name })),
                        },
                        productAccess: null,
                    };
                }

                throw new Error("Payment not found");
            }

            const service = await prisma.service.findUnique({
                where: { id: intent.serviceId },
                include: { studioSession: true }
            });

            const uniqueAddonIds = [...new Set(intent.addonIds.map(id => id.split(":")[0]))];
            const addons = uniqueAddonIds.length > 0 ? await prisma.service.findMany({
                where: { id: { in: uniqueAddonIds } }
            }) : [];

            return {
                amount: intent.amount.toString(),
                status: intent.status === "COMPLETED" ? "PAID" : "PENDING",
                isAlreadyPaid: intent.status === "COMPLETED",
                booking: {
                    sessionCount: intent.sessionCount,
                    bookingDate: intent.bookingDate.toISOString(),
                    client: {
                        name: intent.clientName,
                        email: intent.clientEmail || "",
                    },
                    service: service ? {
                        name: service.name,
                        duration: service.studioSession?.duration || 45,
                    } : null,
                    studio: intent.studio ? {
                        name: intent.studio.name,
                        logo: intent.studio.logo,
                    } : null,
                    addons: addons.map(a => ({
                        id: a.id,
                        name: a.name,
                    })),
                },
                productAccess: null,
            };
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
