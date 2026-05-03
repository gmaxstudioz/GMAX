"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, isSameDay, startOfDay, addMinutes, isBefore, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DateTimeSlotPicker({
    selectedDate,
    onDateChange,
    proposedDuration,
    bookings,
}: {
    selectedDate: Date | null;
    onDateChange: (date: Date | null) => void;
    proposedDuration: number;
    bookings: any[];
}) {
    // We separate the actual Date (Y-M-D) selected in the calendar from the exact Time selected
    // so we can display time slots for the chosen day.
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(
        selectedDate || new Date()
    );

    // If external value is cleared
    useEffect(() => {
        if (!selectedDate) {
            setCalendarDate(undefined);
        }
    }, [selectedDate]);

    // Compute exactly which time slots are available for the selected `calendarDate`.
    const availableTimeSlots = useMemo(() => {
        if (!calendarDate || !proposedDuration) return [];
        
        // Studio open hours: 8:00 AM to 8:00 PM
        const openTime = addMinutes(startOfDay(calendarDate), 8 * 60);
        const closeTime = addMinutes(startOfDay(calendarDate), 20 * 60);

        // Filter bookings onto this specific day
        const todaysBookings = bookings.filter(b => isSameDay(new Date(b.bookingDate), calendarDate));
        
        // Map bookings into `[start, end]` intervals in ms
        const intervals = todaysBookings.map(b => {
            const start = new Date(b.bookingDate).getTime();
            const dur = b.service?.studioSession?.duration || 45;
            const end = start + (dur * b.sessionCount * 60 * 1000);
            return { start, end };
        });

        const intervalsSorted = intervals.sort((a, b) => a.start - b.start);

        // Generate 30-minute intervals
        const slots: Date[] = [];
        let curr = openTime;
        
        const now = new Date(); // To prevent booking in the past

        while (isBefore(curr, closeTime)) {
            const proposedEnd = addMinutes(curr, proposedDuration);
            
            // Cannot book if it spills past closing time
            if (!isBefore(proposedEnd, addMinutes(closeTime, 1))) {
                curr = addMinutes(curr, 30);
                continue;
            }

            // Cannot book in the past
            if (isBefore(curr, now)) {
                curr = addMinutes(curr, 30);
                continue;
            }

            // Check if this [curr, proposedEnd] overlaps with any existing booking interval
            const cStart = curr.getTime();
            const cEnd = proposedEnd.getTime();
            
            let overlaps = false;
            for (const interval of intervalsSorted) {
                // strict intersection check
                if (cStart < interval.end && cEnd > interval.start) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                slots.push(curr);
            }
            
            curr = addMinutes(curr, 30);
        }

        return slots;

    }, [calendarDate, proposedDuration, bookings]);


    const handleDateSelect = (date: Date | undefined) => {
        setCalendarDate(date);
        // Clear value when switching days so they must pick a new time slot
        if (selectedDate && date && !isSameDay(selectedDate, date)) {
            onDateChange(null);
        }
    };

    const handleTimeSelect = (timeSlot: Date) => {
        onDateChange(timeSlot);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP 'at' p") : <span>Pick a date & time</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex items-start" align="start">
                <Calendar
                    mode="single"
                    selected={calendarDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    disabled={(date) => isBefore(endOfDay(date), new Date())} // disable past days
                />

                {calendarDate && (
                    <div className="border-l h-[300px] w-[140px] p-3 flex flex-col gap-2">
                        <span className="text-sm font-semibold mb-2">Available Times</span>
                        <ScrollArea className="flex-1">
                            {proposedDuration > 0 ? (
                                availableTimeSlots.length > 0 ? (
                                    <div className="flex flex-col gap-2 pr-3 pb-4">
                                        {availableTimeSlots.map((slot) => {
                                            const isSelected = selectedDate && selectedDate.getTime() === slot.getTime();
                                            return (
                                                <Button
                                                    key={slot.toISOString()}
                                                    variant={isSelected ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => handleTimeSelect(slot)}
                                                    className="w-full text-xs"
                                                >
                                                    {format(slot, "h:mm a")}
                                                </Button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground pt-4">No available slots for this duration.</p>
                                )
                            ) : (
                                <p className="text-xs text-muted-foreground pt-4">Select a service and session count first.</p>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
