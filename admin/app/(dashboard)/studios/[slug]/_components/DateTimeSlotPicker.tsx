"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { format, startOfDay, addMinutes, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";

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
    // Controlled popover open state so calendar minimizes immediately when date is clicked
    const [popoverOpen, setPopoverOpen] = useState(false);

    // We separate the actual Date (Y-M-D) selected in the calendar from the exact Time selected
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

    // Compute time slots across the full day (6:00 AM to 11:30 PM)
    // Staff and owners are not limited by rigid operating hours or blocked by overlaps
    const availableTimeSlots = useMemo(() => {
        if (!calendarDate) return [];

        const openTime = addMinutes(startOfDay(calendarDate), 6 * 60);
        const closeTime = addMinutes(startOfDay(calendarDate), 23 * 60 + 30);
        const duration = proposedDuration > 0 ? proposedDuration : 45;
        const slotRangeStart = openTime.getTime();
        const slotRangeEnd = addMinutes(closeTime, duration).getTime();
        const todaysBookings = bookings.filter((booking) => {
            const start = new Date(booking.bookingDate).getTime();
            const duration = (booking.service?.studioSession?.duration || 45) * booking.sessionCount;
            const end = start + duration * 60 * 1000;
            return start < slotRangeEnd && end > slotRangeStart;
        });

        // Map bookings into `[start, end]` intervals in ms
        const intervals = todaysBookings.map(b => {
            const start = new Date(b.bookingDate).getTime();
            const dur = b.service?.studioSession?.duration || 45;
            const end = start + (dur * b.sessionCount * 60 * 1000);
            return { start, end };
        });

        // 6:00 AM to 11:30 PM (full day coverage)
        const slots: { slot: Date; overlaps: boolean }[] = [];
        let curr = openTime;

        while (isBefore(curr, closeTime) || curr.getTime() === closeTime.getTime()) {
            const proposedEnd = addMinutes(curr, duration);
            const cStart = curr.getTime();
            const cEnd = proposedEnd.getTime();

            // Check if this slot overlaps with an existing booking
            let overlaps = false;
            for (const interval of intervals) {
                if (cStart < interval.end && cEnd > interval.start) {
                    overlaps = true;
                    break;
                }
            }

            // Always add the slot — staff and owners are not blocked from scheduling
            slots.push({ slot: curr, overlaps });
            curr = addMinutes(curr, 30);
        }

        return slots;
    }, [calendarDate, proposedDuration, bookings]);

    const handleDateSelect = (date: Date | undefined) => {
        setCalendarDate(date);
        // Automatically minimize / close the calendar popover so user can immediately see and select time
        if (date) {
            setPopoverOpen(false);
            if (selectedDate) {
                // Apply existing time to the newly selected day
                const newDateTime = new Date(date);
                newDateTime.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                onDateChange(newDateTime);
            } else {
                // Default to 10:00 AM on chosen day
                const defaultTime = new Date(date);
                defaultTime.setHours(10, 0, 0, 0);
                onDateChange(defaultTime);
            }
        } else {
            onDateChange(null);
        }
    };

    const handleTimeSelect = (timeSlot: Date) => {
        onDateChange(timeSlot);
    };

    return (
        <div className="space-y-3">
            {/* Calendar Popover Trigger */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal h-9",
                            !selectedDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {selectedDate ? (
                            <span className="font-medium text-foreground">
                                {format(selectedDate, "PPP 'at' p")}
                            </span>
                        ) : (
                            <span>Pick a date & time</span>
                        )}
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

            {/* Time Slots & Custom Time */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Available Times
                    </span>
                    {selectedDate && (
                        <span className="text-xs font-medium text-primary">
                            {format(selectedDate, "h:mm a")}
                        </span>
                    )}
                </div>

                {calendarDate ? (
                    <div className="space-y-2.5">
                        {/* Scrollable Slots Grid */}
                        <div className="max-h-48 overflow-y-auto pr-1 border rounded-md p-2 bg-muted/10">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                {availableTimeSlots.map(({ slot, overlaps }) => {
                                    const isSelected = selectedDate && selectedDate.getTime() === slot.getTime();
                                    return (
                                        <button
                                            type="button"
                                            key={slot.toISOString()}
                                            onClick={() => handleTimeSelect(slot)}
                                            className={cn(
                                                "py-1.5 px-2 text-xs font-medium rounded-md border transition-all text-center flex flex-col items-center justify-center cursor-pointer",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                                                    : overlaps
                                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                                                    : "bg-card hover:border-primary/50 border-border"
                                            )}
                                        >
                                            <span>{format(slot, "h:mm a")}</span>
                                            {overlaps && (
                                                <span
                                                    className={cn(
                                                        "text-[9px] font-normal leading-none mt-0.5",
                                                        isSelected ? "text-primary-foreground/80" : "text-amber-600 dark:text-amber-400"
                                                    )}
                                                >
                                                    Occupied
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Time Input (Allows any time of day or night) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1.5 px-1">
                            <div className="flex items-center gap-2">
                                <ClockIcon className="size-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Custom Time:</span>
                                <Input
                                    type="time"
                                    value={selectedDate ? format(selectedDate, "HH:mm") : ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val) return;
                                        const [h, m] = val.split(":").map(Number);
                                        if (!isNaN(h) && !isNaN(m)) {
                                            const base = calendarDate || new Date();
                                            const updated = new Date(base);
                                            updated.setHours(h, m, 0, 0);
                                            setCalendarDate(base);
                                            onDateChange(updated);
                                        }
                                    }}
                                    className="h-7 text-xs w-28 font-mono"
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                Not limited by operating hours
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground py-4 text-center rounded-md border border-dashed bg-muted/20">
                        Select a date above to choose or enter a time
                    </div>
                )}
            </div>
        </div>
    );
}
