"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deliverBooking } from "@/lib/actions/delivery";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeliverAssetsButton({ 
    bookingId, 
    isDelivered, 
    hasOutstandingBalance,
    balanceDue 
}: { 
    bookingId: string;
    isDelivered?: boolean;
    hasOutstandingBalance?: boolean;
    balanceDue?: number;
}) {
    const [isPending, setIsPending] = useState(false);
    const [open, setOpen] = useState(false);

    async function handleDeliver() {
        setIsPending(true);
        try {
            if (hasOutstandingBalance) {
                // await sendBalanceDueReminder(bookingId); // we will implement this next
                const { sendBalanceDueReminder } = await import("@/lib/actions/delivery");
                await sendBalanceDueReminder(bookingId);
                toast.success("Payment reminder sent successfully.");
            } else {
                await deliverBooking(bookingId);
                toast.success(isDelivered ? "Notification resent successfully." : "Assets delivered successfully.");
            }
            setOpen(false);
        } catch (error) {
            console.error(error);
            const errMessage = error instanceof Error ? error.message : String(error);
            toast.error(hasOutstandingBalance ? `Failed to send reminder: ${errMessage}` : `Failed to deliver assets: ${errMessage}`);
        } finally {
            setIsPending(false);
        }
    }

    const title = hasOutstandingBalance 
        ? "Outstanding Balance" 
        : (isDelivered ? "Resend Notification?" : "Deliver Assets?");

    const description = hasOutstandingBalance
        ? `This client still owes ₦${balanceDue?.toLocaleString()}. Sending them their files now is not allowed until full payment is made. Would you like to send them a Payment Reminder with a link to pay the balance instead?`
        : (isDelivered 
            ? "Are you sure you want to resend the delivery notification? This will send another SMS and Email to the client with their unique download link."
            : "Are you sure you want to deliver these assets? This will send an SMS and Email to the client with their unique download link.");

    const confirmText = hasOutstandingBalance
        ? "Send Payment Reminder"
        : (isDelivered ? "Yes, Resend" : "Yes, Deliver");

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button className="bg-primary/90 hover:bg-primary">
                    <SendIcon className="w-4 h-4 mr-2" />
                    {isDelivered ? "Resend Delivery" : "Deliver Assets"}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className={hasOutstandingBalance ? "text-destructive" : ""}>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeliver(); }} disabled={isPending} className={hasOutstandingBalance ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}>
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isPending ? "Sending..." : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
