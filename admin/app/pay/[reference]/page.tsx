import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PaymentCheckout } from "./_components/PaymentCheckout";
import {
    CalendarIcon,
    PackageIcon,
    UserIcon,
    ShieldCheckIcon,
} from "lucide-react";
import Image from "next/image";

export const metadata: Metadata = {
    title: "Pay — GMAX Studioz",
    description: "Complete your payment securely",
};

interface Props {
    params: Promise<{ reference: string }>;
}

function maskClientName(name: string | null | undefined): string {
    if (!name) return "Customer";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1][0]}.`;
}

export default async function PaymentPage({ params }: Props) {
    const { reference } = await params;

    if (!/^[A-Za-z0-9_-]{1,100}$/.test(reference)) {
        return notFound();
    }

    const payment = await db.query.payment.findFirst({
        where: (p, { eq }) => eq(p.paystackReference, reference),
        with: {
            booking: {
                with: {
                    client: true,
                    payments: true,
                    service: {
                        with: { studioSession: true, serviceVariants: true },
                    },
                    studio: true,
                    bookingAddons: {
                        with: { service: { with: { serviceVariants: true } } },
                    },
                },
            },
        },
    });

    if (!payment) return notFound();

    const booking = payment.booking;
    if (!booking) return notFound();

    const studio = booking.studio;
    let isAlreadyPaid = payment.status === "PAID";
    let isLinkInvalid = payment.status === "CANCELLED" || booking.bookingStatus === "CANCELLED";

    if (payment.status !== "PAID") {
        const servicePrice = Number(
            booking.service?.serviceVariants?.find((v: any) => v.id === booking.serviceVariantId)?.basePrice ??
                booking.service?.serviceVariants?.[0]?.basePrice ??
                0
        );
        const sessionTotal = servicePrice * booking.sessionCount;
        const addonsTotal = (booking.bookingAddons || []).reduce((sum: number, a: any) => {
            const addonService = a.service || a;
            const variantId = addonService?.addonVariantId;
            const variant = variantId
                ? addonService?.serviceVariants?.find((v: any) => v.id === variantId)
                : addonService?.serviceVariants?.[0];
            return sum + Number(variant?.basePrice ?? 0);
        }, 0);
        const grandTotalKobo = Math.round(
            (booking.totalAmount != null ? Number(booking.totalAmount) : sessionTotal + addonsTotal) * 100
        );
        const paidKobo = (booking.payments || [])
            .filter((p: any) => p.status === "PAID")
            .reduce((sum: number, p: any) => sum + Math.round(Number(p.amount) * 100), 0);
        const balanceDueKobo = Math.max(0, grandTotalKobo - paidKobo);
        const paymentAmountKobo = Math.round(Number(payment.amount) * 100);

        if (balanceDueKobo <= 0) {
            if (payment.status === "PENDING") {
                await db
                    .update(schema.payment)
                    .set({ status: "CANCELLED" })
                    .where(and(eq(schema.payment.id, payment.id), eq(schema.payment.status, "PENDING")));
            }
            isAlreadyPaid = true;
            isLinkInvalid = false;
        } else if (
            booking.bookingStatus === "CANCELLED" ||
            payment.status !== "PENDING" ||
            paymentAmountKobo !== balanceDueKobo
        ) {
            if (payment.status === "PENDING") {
                await db
                    .update(schema.payment)
                    .set({ status: "CANCELLED" })
                    .where(and(eq(schema.payment.id, payment.id), eq(schema.payment.status, "PENDING")));
            }
            isLinkInvalid = true;
        }
    }
    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

    const sessionDuration = booking.service?.studioSession?.duration || 45;
    const totalDuration = sessionDuration * booking.sessionCount;

    const addons = booking.bookingAddons?.map(ba => ba.service).filter(Boolean) || [];

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(v);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center px-4 py-8 sm:py-12">
            <div className="w-full max-w-lg space-y-6">
                {/* Studio Branding */}
                <div className="text-center space-y-3">
                    {studio?.logo && (
                        <div className="mx-auto h-16 w-16 rounded-2xl overflow-hidden border shadow-sm">
                            <Image
                                src={`${r2PublicUrl}/${studio.logo}`}
                                alt={studio.name || "Studio"}
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">{studio?.name || "Studio"}</h1>
                        <p className="text-muted-foreground text-sm mt-1">Complete your payment</p>
                    </div>
                </div>

                {/* Payment Card */}
                <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
                    <CardContent className="space-y-6 pt-6">
                        {/* Booking Summary */}
                        {!isAlreadyPaid && (
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Booking Summary</h2>

                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <PackageIcon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{booking.service?.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {booking.sessionCount} session{booking.sessionCount > 1 ? "s" : ""} · {totalDuration} minutes
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <CalendarIcon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{format(new Date(booking.bookingDate), "EEEE, MMMM do, yyyy")}</p>
                                        <p className="text-xs text-muted-foreground">{format(new Date(booking.bookingDate), "h:mm a")}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <UserIcon className="h-4 w-4 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium">{maskClientName(booking.client?.name)}</p>
                                </div>

                                {addons.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {addons.map((a: any) => (
                                            <Badge key={a.id} variant="outline" className="text-xs">
                                                + {a.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isAlreadyPaid && (
                            <>
                                <Separator />

                                {/* Amount */}
                                <div className="text-center space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Amount Due</p>
                                    <p className="text-4xl font-bold tracking-tight">
                                        {formatCurrency(Number(payment.amount))}
                                    </p>
                                </div>

                                <Separator />
                            </>
                        )}

                        {/* Payment Action */}
                        {isAlreadyPaid ? (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                                    <ShieldCheckIcon className="h-8 w-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-green-600">Payment Complete</h3>
                                <p className="text-sm text-muted-foreground text-center">
                                    This payment has already been confirmed. Thank you!
                                </p>
                            </div>
                        ) : isLinkInvalid ? (
                            <div className="flex flex-col items-center gap-3 py-4">
                                <h3 className="text-xl font-bold text-destructive">Payment Link Expired</h3>
                                <p className="text-sm text-muted-foreground text-center">
                                    This payment link is no longer valid because the booking balance has changed. Please request a new payment link.
                                </p>
                            </div>
                        ) : (
                            <PaymentCheckout
                                reference={reference}
                                accessCode=""
                                email={booking.client?.email || ""}
                                amount={Number(payment.amount)}
                                publicKey={paystackPublicKey}
                            />
                        )}

                        {/* Security badge */}
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                            <span>Secured by Paystack · 256-bit SSL encryption</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} GMAX Studioz. All rights reserved.
                </p>
            </div>
        </div>
    );
}
