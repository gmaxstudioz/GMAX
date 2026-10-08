"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, isSameDay, startOfDay, addMinutes, isBefore, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";


export function DateTimeSlotPicker({
    selectedDate,
    onDateChange,
    proposedDuration,
    bookings,
}: {
    selectedDate: Date | null;
    onDateChange: (date: Date | null) => void;
    proposedDuration: number;
    bookings: { bookingDate: Date | string; sessionCount: number; service?: { studioSession?: { duration?: number } } }[];
}) {
    // We separate the actual Date (Y-M-D) selected in the calendar from the exact Time selected
    // so we can display time slots for the chosen day.
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(
        selectedDate || new Date()
    );

    // If external value is cleared
    useEffect(() => {
        if (!selectedDate) {
            const t = setTimeout(() => setCalendarDate(undefined), 0);
            return () => clearTimeout(t);
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

            // Cannot book in the past (disabled for admin to allow backdating)
            // if (isBefore(curr, now)) {
            //     curr = addMinutes(curr, 30);
            //     continue;
            // }

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
        <div className="space-y-4">
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
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={calendarDate}
                        onSelect={handleDateSelect}
                    />
                </PopoverContent>
            </Popover>

            <div className="space-y-3">
                <span className="text-sm font-medium text-foreground uppercase tracking-wider">
                    Available Times
                </span>
                <div className="grid grid-cols-3 gap-3">
                    {proposedDuration > 0 ? (
                        calendarDate ? (
                            availableTimeSlots.length > 0 ? (
                                availableTimeSlots.map((slot) => {
                                    const isSelected = selectedDate && selectedDate.getTime() === slot.getTime();
                                    return (
                                        <button
                                            type="button"
                                            key={slot.toISOString()}
                                            onClick={() => handleTimeSelect(slot)}
                                            className={cn(
                                                "py-2.5 px-3 text-sm font-medium rounded-xl border transition-all",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                                                    : "bg-card hover:border-primary/50 border-border"
                                            )}
                                        >
                                            {format(slot, "h:mm a")}
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="col-span-3 text-sm text-muted-foreground py-3 bg-muted/30 text-center rounded-xl border border-dashed border-border">
                                    No available slots for this duration
                                </div>
                            )
                        ) : (
                            <div className="col-span-3 text-sm text-muted-foreground py-3 bg-muted/30 text-center rounded-xl border border-dashed border-border">
                                Select a date to view times
                            </div>
                        )
                    ) : (
                        <div className="col-span-3 text-sm text-muted-foreground py-3 bg-muted/30 text-center rounded-xl border border-dashed border-border">
                            Select a service and session count first
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
