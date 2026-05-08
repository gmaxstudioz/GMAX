import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { Metadata } from "next";
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

export default async function PaymentPage({ params }: Props) {
    const { reference } = await params;

    const payment = await prisma.payment.findFirst({
        where: { paystackReference: reference },
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
        },
    });

    if (!payment) return notFound();

    const booking = payment.booking;
    if (!booking) return notFound();
 
    const studio = booking.studio;
    const isAlreadyPaid = payment.status === "PAID";
    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

    const sessionDuration = booking.service?.studioSession?.duration || 45;
    const totalDuration = sessionDuration * booking.sessionCount;

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
                                <p className="text-sm font-medium">{booking.client?.name}</p>
                            </div>

                            {booking.addons.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {booking.addons.map(a => (
                                        <Badge key={a.id} variant="outline" className="text-xs">
                                            + {a.name}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Amount */}
                        <div className="text-center space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Amount Due</p>
                            <p className="text-4xl font-bold tracking-tight">
                                {formatCurrency(Number(payment.amount))}
                            </p>
                        </div>

                        <Separator />

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
