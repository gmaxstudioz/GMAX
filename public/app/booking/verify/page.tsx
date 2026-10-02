"use client";
import { APP_NAME } from "@/lib/constants";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { verifyBookingPayment, type VerifyBookingResult } from "@/lib/api";
import { CheckCircle2, Loader2, AlertCircle, ArrowLeft, Calendar, CreditCard, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

function VerifyContent() {
    const searchParams = useSearchParams();
    const reference = searchParams.get("reference");
    const [result, setResult] = useState<VerifyBookingResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!reference) {
            setError("No booking reference found.");
            setLoading(false);
            return;
        }

        const verify = async () => {
            try {
                const data = await verifyBookingPayment(reference);
                setResult(data);
            } catch (err) {
                console.error(err);
                setError("Unable to verify your booking. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [reference]);

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(v);

    const formatDate = (dateString: string) => {
        if (!dateString) return "—";
        const d = new Date(dateString);
        return d.toLocaleDateString("en-NG", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const planLabel = (plan: string) => {
        switch (plan) {
            case "QUARTER": return "Quarter (25%)";
            case "HALF": return "Half (50%)";
            default: return "Full (100%)";
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground animate-pulse">Verifying your booking...</p>
                </div>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold">Verification Failed</h1>
                    <p className="text-muted-foreground">{error || "Something went wrong."}</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    const statusConfig = {
        COMPLETED: {
            icon: CheckCircle2,
            color: "text-green-500",
            bg: "bg-green-500/10",
            ringColor: "ring-green-500/20",
            label: "Booking Confirmed",
            description: "Your payment was successful and your booking is confirmed.",
        },
        PENDING: {
            icon: Clock,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            ringColor: "ring-amber-500/20",
            label: "Payment Pending",
            description: "We're still processing your payment. Please check back shortly.",
        },
        EXPIRED: {
            icon: AlertCircle,
            color: "text-gray-500",
            bg: "bg-gray-500/10",
            ringColor: "ring-gray-500/20",
            label: "Booking Expired",
            description: "This booking session has expired. Please create a new booking.",
        },
        FAILED: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            ringColor: "ring-red-500/20",
            label: "Payment Failed",
            description: "Your payment could not be processed. Please try again.",
        },
    };

    const config = statusConfig[result.status];
    const StatusIcon = config.icon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center px-4 py-12">
            <div className="max-w-lg w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-heading font-bold uppercase tracking-wide"> {APP_NAME} </h1>
                    <p className="text-muted-foreground text-sm">Booking Verification</p>
                </div>

                {/* Status Card */}
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Status Banner */}
                    <div className={cn("py-8 flex flex-col items-center gap-4", config.bg)}>
                        <div className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center ring-4",
                            config.bg, config.ringColor
                        )}>
                            <StatusIcon className={cn("w-10 h-10", config.color)} />
                        </div>
                        <div className="text-center">
                            <h2 className={cn("text-2xl font-bold", config.color)}>{config.label}</h2>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{config.description}</p>
                        </div>
                    </div>

                    {/* Booking Details */}
                    {(result.status === "COMPLETED" || result.status === "PENDING") && (
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Details</h3>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                                        <span className="text-sm text-muted-foreground">Client</span>
                                        <span className="text-sm font-medium">{result.clientName}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5" /> Service
                                        </span>
                                        <span className="text-sm font-medium">{result.serviceName}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5" /> Date
                                        </span>
                                        <span className="text-sm font-medium">{formatDate(result.bookingDate)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                                        <span className="text-sm text-muted-foreground">Payment Plan</span>
                                        <span className="text-sm font-medium">{planLabel(result.paymentPlan)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                                        <span className="text-sm text-muted-foreground">Reference</span>
                                        <span className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">{result.reference}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Amount Summary */}
                            <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Total</span>
                                    <span className="text-sm font-medium">{formatCurrency(result.totalAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Amount Paid</span>
                                    <span className="text-lg font-bold text-primary">{formatCurrency(result.amountPaid)}</span>
                                </div>
                                {result.paymentPlan !== "FULL" && (
                                    <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                                        <span className="text-sm text-muted-foreground">Remaining</span>
                                        <span className="text-sm font-semibold">{formatCurrency(result.totalAmount - result.amountPaid)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="p-6 pt-0 flex justify-center">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium text-sm hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default function BookingVerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <VerifyContent />
        </Suspense>
    );
}
