"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { verifyPayment } from "@/lib/actions/payment";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { Loader2, CheckCircle2, PartyPopperIcon, XCircleIcon } from "lucide-react";

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        PaystackPop: any;
    }
}

interface PaymentCheckoutProps {
    reference: string;
    accessCode: string;
    email: string;
    amount: number;
    publicKey: string;
}

export function PaymentCheckout({ reference, email, amount, publicKey }: PaymentCheckoutProps) {
    const [status, setStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
    const [scriptLoaded, setScriptLoaded] = useState(() => {
        if (typeof document !== "undefined") {
            return !!document.getElementById("paystack-script");
        }
        return false;
    });

    useEffect(() => {
        // Load Paystack inline script
        if (document.getElementById("paystack-script")) {
            return;
        }
        const script = document.createElement("script");
        script.id = "paystack-script";
        script.src = "https://js.paystack.co/v2/inline.js";
        script.onload = () => setScriptLoaded(true);
        document.head.appendChild(script);
    }, []);

    const handlePay = () => {
        if (!scriptLoaded || !window.PaystackPop) {
            toast.error("Payment system is loading. Please wait...");
            return;
        }

        const popup = new window.PaystackPop();
        popup.newTransaction({
            key: publicKey,
            email,
            amount: Math.round(amount * 100),
            ref: reference,
            onSuccess: async () => {
                setStatus("processing");
                const { data: result, error } = await tryCatch(verifyPayment(reference));
                if (error || result?.status !== "success") {
                    setStatus("failed");
                    toast.error("Payment verification failed. Please contact support.");
                } else {
                    setStatus("success");
                    toast.success("Payment successful!");
                }
            },
            onCancel: () => {
                toast.info("Payment was cancelled");
            },
        });
    };

    if (status === "success") {
        return (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <PartyPopperIcon className="h-8 w-8 text-amber-500 absolute -top-2 -right-2 animate-bounce" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold text-green-600">Payment Successful!</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        Your payment has been confirmed. You will receive a notification when your booking is ready.
                    </p>
                </div>
                <div className="rounded-lg bg-muted/50 border p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Amount Paid</p>
                    <p className="text-2xl font-bold">₦{amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-2">Ref: {reference}</p>
                </div>
            </div>
        );
    }

    if (status === "processing") {
        return (
            <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verifying your payment...</p>
            </div>
        );
    }

    if (status === "failed") {
        return (
            <div className="flex flex-col items-center gap-4 py-8">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircleIcon className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-destructive">Verification Failed</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        Payment may have been made but we couldn&apos;t verify it. Please contact support with reference: <strong>{reference}</strong>
                    </p>
                </div>
                <Button onClick={handlePay} variant="outline" className="mt-2">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 w-full">
            <Button
                size="lg"
                className="w-full max-w-sm text-lg py-6 gap-2 font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/20 transition-all hover:shadow-xl hover:shadow-green-500/30"
                onClick={handlePay}
                disabled={!scriptLoaded}
            >
                {!scriptLoaded ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : null}
                Pay ₦{amount.toLocaleString()}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
                Secure payment powered by Paystack
            </p>
        </div>
    );
}
