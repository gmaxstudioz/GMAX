"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { rescheduleBooking } from "@/lib/actions/booking";
import { tryCatch } from "@/hooks/try-catch";
import { toast } from "sonner";
import { ClockIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface RescheduleTimePickerProps {
    bookingId: string;
    currentDate: Date;
}

export function RescheduleTimePicker({ bookingId, currentDate }: RescheduleTimePickerProps) {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    // Initialize with the current booking date and time
    const dateStr = format(new Date(currentDate), "yyyy-MM-dd");
    const timeStr = format(new Date(currentDate), "HH:mm");

    const [selectedDate, setSelectedDate] = useState(dateStr);
    const [selectedTime, setSelectedTime] = useState(timeStr);

    const handleReschedule = () => {
        startTransition(async () => {
            const newDateTime = `${selectedDate}T${selectedTime}:00`;
            const { data: result, error } = await tryCatch(rescheduleBooking(bookingId, newDateTime));

            if (error) {
                toast.error("An unexpected error occurred.");
                return;
            }

            if (result?.status === "success") {
                toast.success(result.message || "Booking rescheduled!");
                setOpen(false);
            } else {
                toast.error(result?.message || "Failed to reschedule.");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Change Time
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[360px]">
                <DialogHeader>
                    <DialogTitle>Reschedule Booking</DialogTitle>
                    <DialogDescription>
                        Choose a new date and time for this booking. Operating hours are 8:00 AM – 8:00 PM.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-2">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Date</label>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Time</label>
                        <Input
                            type="time"
                            value={selectedTime}
                            min="08:00"
                            max="20:00"
                            onChange={(e) => setSelectedTime(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Between 8:00 AM and 8:00 PM</p>
                    </div>
                    <Button onClick={handleReschedule} disabled={isPending} className="w-full">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm Reschedule
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
