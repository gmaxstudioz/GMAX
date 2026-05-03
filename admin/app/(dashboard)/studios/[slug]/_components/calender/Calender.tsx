"use client";

import { PendingMove } from "@/lib/schemas/booking";
import { CalendarBooking, getDaysInMonth, groupBookingsByDate } from "@/lib/schemas/calendar"
import { closestCenter, DndContext, DragEndEvent } from "@dnd-kit/core";
import { useState } from "react"
import { DayCell } from "./DayCell";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";

type Props = {
    initialYear: number
    initialMonth: number
    bookings: CalendarBooking[]
    onMoveConfirm: (bookingId: string, toDateKey: string) => Promise<void>
}

export function CalenderGrid({ initialYear, initialMonth, bookings, onMoveConfirm }: Props) {
    const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date(initialYear, initialMonth, 1));

    const currentYear = currentDate.getFullYear();
    const currentMonthNum = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(currentYear, currentMonthNum);
    const groupedBookings = groupBookingsByDate(bookings);

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (!over) return;

        const fromDateKey = active.data.current?.dateKey as string;
        const toDateKey = over.id as string;

        if (fromDateKey === toDateKey) return;

        const bookingId = active.id as string;

        setPendingMove({ bookingId, fromKey: fromDateKey, toKey: toDateKey });
    }

    return (
        <>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{format(currentDate, "MMMM yyyy")}</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-px">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="bg-background/20 p-2 text-xs font-medium text-muted-foreground text-center rounded-md">{day}</div>
                    ))}

                    {daysInMonth.map((day) => (
                        <DayCell key={day.key} day={day} bookings={groupedBookings[day.key] || []} />
                    ))}
                </div>
            </DndContext>

            <Dialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move Booking</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to move this booking to {pendingMove?.toKey}? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={() => {
                            if (pendingMove) {
                                onMoveConfirm(pendingMove.bookingId, pendingMove.toKey);
                                setPendingMove(null);
                            }
                        }}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}