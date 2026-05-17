import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PaymentCheckout } from "./_components/PaymentCheckout";
import { getPublicPaymentDetails } from "@/lib/api";
import {
    CalendarIcon,
    PackageIcon,
    UserIcon,
    ShieldCheckIcon,
    ShoppingBagIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Pay — GMAX Studioz",
    description: "Complete your payment securely",
};

interface Props {
    params: Promise<{ reference: string }>;
}

function formatDate(dateString: string): string {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export default async function PaymentPage({ params }: Props) {
    const { reference } = await params;

    let payment;
    try {
        payment = await getPublicPaymentDetails(reference);
    } catch (error: any) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-red-950/20 border-red-900">
                    <CardContent className="pt-6">
                        <h2 className="text-xl font-bold text-red-500 mb-2">Error Loading Payment</h2>
                        <p className="text-sm text-red-200">{error.message || "Unknown error occurred while fetching payment details"}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!payment) return notFound();

    const booking = payment.booking;
    const productAccess = payment.productAccess;
    
    if (!booking && !productAccess) return notFound();
 
    const studio = booking?.studio;
    const isAlreadyPaid = payment.isAlreadyPaid;
    const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(v);

    const buyerEmail = booking?.client?.email || productAccess?.buyer?.email || "";

    // Determine the type of purchase for post-payment messaging
    const purchaseType: "booking" | "product" = booking ? "booking" : "product";

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center px-4 py-8 sm:py-12">
            <div className="w-full max-w-lg space-y-6">
                {/* Header Branding */}
                <div className="text-center space-y-3">
                    {studio?.logo ? (
                        <div className="mx-auto h-16 w-16 rounded-2xl overflow-hidden border shadow-sm">
                            <Image
                                src={`${r2PublicUrl}/${studio.logo}`}
                                alt={studio.name || "Studio"}
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="mx-auto h-16 w-16 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center">
                            <ShoppingBagIcon className="h-8 w-8 text-primary" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">{studio?.name || "GMAX Studioz Shop"}</h1>
                        <p className="text-muted-foreground text-sm mt-1">Complete your payment</p>
                    </div>
                </div>

                {/* Payment Card */}
                <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
                    <CardContent className="space-y-6 pt-6">
                        {/* Summary */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                {booking ? "Booking Summary" : "Order Summary"}
                            </h2>

                            {booking && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2">
                                            <PackageIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{booking.service?.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {booking.sessionCount} session{booking.sessionCount > 1 ? "s" : ""} · {
                                                    (booking.service?.duration || 45) * booking.sessionCount
                                                } minutes
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{formatDate(booking.bookingDate)}</p>
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
                                            {booking.addons.map((a: any) => (
                                                <Badge key={a.id} variant="outline" className="text-xs">
                                                    + {a.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {productAccess && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2">
                                            <ShoppingBagIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{productAccess.product.title}</p>
                                            <p className="text-xs text-muted-foreground">Digital Product</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium">{productAccess.buyer.name}</p>
                                    </div>
                                </>
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
                                {purchaseType === "product" && (
                                    <Link
                                        href="/shop/access"
                                        className="mt-2 inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
                                    >
                                        Access Your Downloads
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <PaymentCheckout
                                reference={reference}
                                accessCode=""
                                email={buyerEmail}
                                amount={Number(payment.amount)}
                                publicKey={paystackPublicKey}
                                purchaseType={purchaseType}
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
