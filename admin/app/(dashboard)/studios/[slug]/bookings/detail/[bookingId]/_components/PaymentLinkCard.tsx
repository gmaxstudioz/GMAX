"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initializePayment } from "@/lib/actions/payment";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import {
    CreditCardIcon,
    LinkIcon,
    QrCodeIcon,
    CopyIcon,
    CheckCircle2Icon,
    Loader2,
    ExternalLinkIcon,
} from "lucide-react";

interface Payment {
    id: string;
    amount: any;
    method: string;
    status: string;
    paymentDate: string | Date;
    paystackReference: string | null;
}

interface PaymentLinkCardProps {
    bookingId: string;
    balanceDue: number;
    grandTotal: number;
    totalPaid: number;
    paymentStatus: string;
    payments: Payment[];
    addonsTotal: number;
    servicePrice: number;
    salePrice: number | null;
    addonsCount: number;
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "secondary",
    PAID: "default",
    PARTIALLY_PAID: "secondary",
    CANCELLED: "destructive",
};

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(v);

export function PaymentLinkCard({
    bookingId,
    balanceDue,
    grandTotal,
    totalPaid,
    paymentStatus,
    payments,
    addonsTotal,
    servicePrice,
    salePrice,
    addonsCount,
}: PaymentLinkCardProps) {
    const [isPending, startTransition] = useTransition();
    const [paymentLink, setPaymentLink] = useState<string | null>(null);
    const [qrOpen, setQrOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const isFullyPaid = paymentStatus === "PAID" || balanceDue <= 0;

    const handleGenerateLink = () => {
        startTransition(async () => {
            const { data: result, error } = await tryCatch(initializePayment(bookingId));
            if (error) {
                toast.error("Failed to generate payment link");
                return;
            }
            if (result?.status === "success" && result.data) {
                setPaymentLink(result.data.paymentUrl);
                toast.success("Payment link generated!");
            } else {
                toast.error(result?.message || "Failed to generate payment link");
            }
        });
    };

    const handleCopy = async () => {
        if (!paymentLink) return;
        await navigator.clipboard.writeText(paymentLink);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Payments & Billing</CardTitle>
                <CardDescription>
                    {isFullyPaid ? "All payments completed" : `${payments.length} payment${payments.length !== 1 ? "s" : ""} recorded`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Financial summary */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Service Price</span>
                        <span>{formatCurrency(servicePrice)}</span>
                    </div>
                    {salePrice != null && salePrice !== servicePrice && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sale Price</span>
                            <span className="text-green-600 font-medium">{formatCurrency(salePrice)}</span>
                        </div>
                    )}
                    {addonsCount > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Add-ons ({addonsCount})</span>
                            <span>{formatCurrency(addonsTotal)}</span>
                        </div>
                    )}
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="text-green-600 font-medium">{formatCurrency(totalPaid)}</span>
                </div>
                {balanceDue > 0 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Balance Due</span>
                        <span className="text-destructive font-bold">{formatCurrency(balanceDue)}</span>
                    </div>
                )}

                {/* Payment Status */}
                {isFullyPaid && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <CheckCircle2Icon className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Fully Paid</span>
                    </div>
                )}

                {/* Generate Payment Link */}
                {!isFullyPaid && (
                    <>
                        <Separator />
                        {paymentLink ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Payment Link</p>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-xs break-all">
                                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <a
                                        href={paymentLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 text-primary hover:underline truncate"
                                    >
                                        {paymentLink}
                                    </a>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleCopy}>
                                        {copied ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                        {copied ? "Copied!" : "Copy Link"}
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQrOpen(true)}>
                                        <QrCodeIcon className="h-3.5 w-3.5" />
                                        QR Code
                                    </Button>
                                    <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm" className="gap-1.5">
                                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <Button onClick={handleGenerateLink} disabled={isPending} className="w-full gap-2">
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                                Generate Payment Link
                            </Button>
                        )}
                    </>
                )}

                {/* Payment History */}
                {payments.length > 0 && (
                    <>
                        <Separator />
                        <p className="text-sm font-medium">Payment History</p>
                        <div className="space-y-2">
                            {payments.map(payment => (
                                <div key={payment.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                                    <div className="flex items-center gap-2.5">
                                        <div className="rounded-md bg-muted p-1.5">
                                            <CreditCardIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{formatCurrency(Number(payment.amount))}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {payment.method} · {format(new Date(payment.paymentDate), "MMM d, yyyy")}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={statusVariants[payment.status] || "outline"} className="text-[10px] capitalize">
                                        {payment.status.toLowerCase()}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>

            {/* QR Code Dialog */}
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                <DialogContent className="sm:max-w-[340px]">
                    <DialogHeader>
                        <DialogTitle>Payment QR Code</DialogTitle>
                        <DialogDescription>Scan to pay {formatCurrency(balanceDue)}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-4">
                        {paymentLink && (
                            <div className="p-4 bg-white rounded-xl">
                                <QRCodeSVG value={paymentLink} size={200} />
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground text-center">
                            Share this QR code with the client for easy payment
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
