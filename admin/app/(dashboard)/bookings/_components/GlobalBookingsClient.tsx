"use client";

import { CalenderGrid } from "../../studios/[slug]/_components/calender/Calender";
import { tryCatch } from "@/hooks/try-catch";
import { moveBooking } from "@/lib/actions/calendar";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarBooking } from "@/lib/schemas/calendar";

export function GlobalBookingsClient({ bookings, title = "Global Bookings", description = "Overview of all bookings across all studios" }: { bookings: CalendarBooking[], title?: string, description?: string }) {
    const now = new Date();

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="font-bold text-xl flex gap-2">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <CalenderGrid 
                    initialYear={now.getFullYear()} 
                    initialMonth={now.getMonth()} 
                    bookings={bookings} 
                    onMoveConfirm={async (bookingId, toDateKey) => {
                        const { error } = await tryCatch(moveBooking(bookingId, toDateKey));
                        if (error) {
                            toast.error("Failed to reschedule booking.");
                        } else {
                            toast.success(`Booking successfully moved to ${toDateKey}!`);
                        }
                    }} 
                />
            </CardContent>
        </Card>
    );
}
