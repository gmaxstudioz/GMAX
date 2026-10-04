// router/payments.ts
import { db } from "@/lib/db";
import { payment, productAccess, buyerAccessToken, booking, buyer, bookingIntent, service } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { implement } from "@orpc/server";
import { contract } from "@/app/contract";
import { BaseContext, optionalAuthMiddleware } from "./middleware";
import { paystackFetch } from "@/lib/paystack";
import { sendPurchaseAccessEmail, sendPurchaseAccessSMS, sendPurchaseAccessWhatsApp, sendBookingPaymentEmail, sendBookingPaymentSMS, sendBookingPaymentWhatsApp } from "@/lib/termii";
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
        const paymentRecord = await db.query.payment.findFirst({
            where: eq(payment.paystackReference, input.reference),
            with: {
                productAccesses: true,
                booking: {
                    with: {
                        client: true,
                        service: true,
                    },
                },
            },
        });

        if (!paymentRecord) {
            return { verified: false };
        }

        const firstProductAccess = paymentRecord.productAccesses?.[0];

        // If already verified, return early
        if (paymentRecord.status === "PAID") {
            return {
                verified: true,
                buyerId: firstProductAccess?.buyerId,
            };
        }

        try {
            // Verify with Paystack
            const response = await paystackFetch<{ data?: { status?: string } }>(`/transaction/verify/${input.reference}`);
            
            if (response.data?.status === "success") {
                const paystackRes = paymentRecord.paystackResponse as { pendingProduct?: { title: string }, pendingBuyer?: { name: string, email: string }, productId?: string, buyerId?: string } | null;
                const isProductPurchase = Boolean(paystackRes?.pendingProduct && paystackRes?.pendingBuyer);
                const productId = paystackRes?.productId;
                const buyerId = paystackRes?.buyerId;

                try {
                    await db.transaction(async (tx) => {
                        const updateRes = await tx.update(payment)
                            .set({ status: "PAID" })
                            .where(and(eq(payment.id, paymentRecord.id), eq(payment.status, "PENDING")))
                            .returning();
                        
                        if (updateRes.length === 0) {
                            throw new Error("P2025");
                        }

                        if (isProductPurchase && productId && buyerId && !firstProductAccess) {
                            try {
                                await tx.insert(productAccess).values({
                                    id: crypto.randomUUID(),
                                    productId,
                                    buyerId,
                                    paymentId: paymentRecord.id,
                                });
                            } catch (error: any) {
                                if (error.code !== "23505") {
                                    throw error;
                                }
                                // Duplicate access already exists, treat as already processed.
                            }
                        }
                    });
                } catch (error: any) {
                    if (error.message === "P2025") {
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
                        await db.insert(buyerAccessToken).values({
                            id: crypto.randomUUID(),
                            buyerId,
                            token,
                            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                            used: false,
                        });

                        const accessLink = `${PORTAL_URL}/shop/access/${token}`;
                        const buyerEmail = paystackRes?.pendingBuyer?.email;
                        const buyerName = paystackRes?.pendingBuyer?.name || "Customer";
                        const productTitle = paystackRes?.pendingProduct?.title || "Digital Product";

                        // Send email notification
                        if (buyerEmail) {
                            const emailResult = await sendPurchaseAccessEmail({
                                email: buyerEmail,
                                buyerName,
                                productTitle,
                                accessLink,
                                amount: formatCurrency(Number(paymentRecord.amount)),
                            }).catch(err => {
                                console.error("[verifyPurchase] Purchase email failed:", err);
                                return null;
                            });
                            if (!emailResult) {
                                console.warn("[verifyPurchase] Email delivery failed — check Termii logs");
                            }
                        }

                        // Also send SMS & WhatsApp if we have the phone number
                        const buyerRecord = await db.query.buyer.findFirst({ where: eq(buyer.id, buyerId) });
                        if (buyerRecord?.phone) {
                            await sendPurchaseAccessSMS({
                                phone: buyerRecord.phone,
                                productTitle,
                                accessLink,
                            }).catch(err => {
                                console.error("[verifyPurchase] SMS failed:", err);
                            });

                            await sendPurchaseAccessWhatsApp({
                                phone: buyerRecord.phone,
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
                if (paymentRecord.bookingId && paymentRecord.booking) {
                    await db.update(booking)
                        .set({ paymentStatus: "PAID" })
                        .where(eq(booking.id, paymentRecord.bookingId));

                    // Send booking confirmation email
                    const clientEmail = paymentRecord.booking.client?.email;
                    if (clientEmail) {
                        try {
                            await sendBookingPaymentEmail({
                                email: clientEmail,
                                clientName: paymentRecord.booking.client?.name || "Customer",
                                serviceName: paymentRecord.booking.service?.name || "Service",
                                amount: formatCurrency(Number(paymentRecord.amount)),
                                reference: input.reference,
                            });
                            console.log(`[verifyPurchase] Booking confirmation sent to ${clientEmail}`);
                        } catch (emailErr) {
                            console.error("[verifyPurchase] Failed to send booking email:", emailErr);
                        }
                    }

                    // Send SMS and WhatsApp
                    const clientPhone = paymentRecord.booking.client?.phone;
                    if (clientPhone) {
                        const clientName = paymentRecord.booking.client?.name || "Customer";
                        const serviceName = paymentRecord.booking.service?.name || "Service";

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
        const paymentRecord = await db.query.payment.findFirst({
            where: eq(payment.paystackReference, input.reference),
            with: {
                booking: {
                    with: {
                        client: true,
                        service: {
                            with: { studioSession: true },
                        },
                        studio: true,
                        bookingAddons: {
                            with: { service: true }
                        },
                    },
                },
                productAccesses: {
                    with: {
                        product: true,
                        buyer: true,
                    }
                }
            },
        });

        if (!paymentRecord) {
            // Fallback: check bookingIntent (happens before payment is finalized)
            const intent = await db.query.bookingIntent.findFirst({
                where: eq(bookingIntent.paystackReference, input.reference),
                with: {
                    studio: true,
                }
            });

            if (!intent) {
                throw new Error("Payment not found");
            }

            // Manually fetch service details to match the expected format
            const serviceRecord = await db.query.service.findFirst({
                where: eq(service.id, intent.serviceId),
                with: { studioSession: true },
            });

            let addonsList: any[] = [];
            if (intent.addonIds && intent.addonIds.length > 0) {
                // addonIds format is likely "addonId" or "addonId:variantId"
                const cleanAddonIds = intent.addonIds.map(id => id.split(":")[0]);
                const addonsRecords = await db.query.service.findMany({
                    where: inArray(service.id, cleanAddonIds),
                });
                addonsList = addonsRecords.map(a => ({ id: a.id, name: a.name }));
            }

            return {
                amount: intent.amount.toString(),
                status: "PENDING",
                isAlreadyPaid: false,
                booking: {
                    sessionCount: intent.sessionCount,
                    bookingDate: intent.bookingDate,
                    client: {
                        name: intent.clientName,
                        email: intent.clientEmail || "",
                    },
                    service: serviceRecord ? {
                        name: serviceRecord.name,
                        duration: serviceRecord.studioSession?.duration || 45,
                    } : null,
                    studio: intent.studio ? {
                        name: intent.studio.name,
                        logo: intent.studio.logo,
                    } : null,
                    addons: addonsList,
                },
                productAccess: null,
            };
        }

        const isAlreadyPaid = paymentRecord.status === "PAID";

        const bookingData = paymentRecord.booking ? {
            sessionCount: paymentRecord.booking.sessionCount,
            bookingDate: paymentRecord.booking.bookingDate,
            client: paymentRecord.booking.client ? {
                name: paymentRecord.booking.client.name,
                email: paymentRecord.booking.client.email,
            } : null,
            service: paymentRecord.booking.service ? {
                name: paymentRecord.booking.service.name,
                duration: paymentRecord.booking.service.studioSession?.duration || 45,
            } : null,
            studio: paymentRecord.booking.studio ? {
                name: paymentRecord.booking.studio.name,
                logo: paymentRecord.booking.studio.logo,
            } : null,
            addons: paymentRecord.booking.bookingAddons?.map((a: any) => ({
                id: a.service?.id,
                name: a.service?.name,
            })) || [],
        } : null;

        const paystackRes = paymentRecord.paystackResponse as { pendingProduct?: { title: string }, pendingBuyer?: { name: string, email: string } } | null;
        
        const firstProductAccess = paymentRecord.productAccesses?.[0];
        const productAccessData = firstProductAccess ? {
            product: { title: firstProductAccess.product.title },
            buyer: { name: firstProductAccess.buyer.name, email: firstProductAccess.buyer.email },
        } : paystackRes?.pendingProduct ? {
            product: { title: paystackRes.pendingProduct.title },
            buyer: { name: paystackRes.pendingBuyer?.name || "Customer", email: paystackRes.pendingBuyer?.email || "" },
        } : null;

        return {
            amount: paymentRecord.amount.toString(),
            status: paymentRecord.status,
            isAlreadyPaid,
            booking: bookingData,
            productAccess: productAccessData,
        };
    });
