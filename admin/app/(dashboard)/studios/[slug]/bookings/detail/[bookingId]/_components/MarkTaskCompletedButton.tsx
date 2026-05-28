"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markTaskCompleted } from "@/lib/actions/booking";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { tryCatch } from "@/hooks/try-catch";

interface MarkTaskCompletedButtonProps {
    bookingId: string;
}

export function MarkTaskCompletedButton({ bookingId }: MarkTaskCompletedButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleComplete = () => {
        startTransition(async () => {
            const { data, error } = await tryCatch(markTaskCompleted(bookingId));
            if (error) {
                toast.error("Failed to mark task as completed");
                return;
            }
            if (data?.status === "success") {
                toast.success("Task marked as completed");
            } else {
                toast.error(data?.message || "Failed to mark task as completed");
            }
        });
    };

    return (
        <Button 
            onClick={handleComplete} 
            disabled={isPending}
            variant="outline"
            className="gap-2"
        >
            {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <CheckCircle2 className="w-4 h-4" />
            )}
            Mark Task Completed
        </Button>
    );
}
