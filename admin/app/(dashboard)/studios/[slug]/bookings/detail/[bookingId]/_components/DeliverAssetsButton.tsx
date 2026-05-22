"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deliverBooking } from "@/lib/actions/delivery";

export function DeliverAssetsButton({ bookingId }: { bookingId: string }) {
    const [isPending, setIsPending] = useState(false);

    async function handleDeliver() {
        if (!confirm("Are you sure you want to deliver these assets? This will send an SMS and Email to the client.")) return;
        
        setIsPending(true);
        try {
            await deliverBooking(bookingId);
            toast.success("Assets delivered successfully! Notifications have been sent.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to deliver assets. Please try again.");
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Button onClick={handleDeliver} disabled={isPending} className="bg-primary/90 hover:bg-primary">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SendIcon className="w-4 h-4 mr-2" />}
            Deliver Assets
        </Button>
    );
}
