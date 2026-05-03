"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarBooking } from "@/lib/schemas/calendar";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cva } from "class-variance-authority";

type Props = {
    booking: CalendarBooking
    dateKey: string
}

const bookingChipVariants = cva(
    "",
    {
        variants: {
            bookingStatus: {
                PENDING:   "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
                CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
                COMPLETED: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300",
                CANCELLED: "bg-red-100/60 text-red-700 border-red-200 opacity-60 dark:bg-red-950/30 dark:text-red-400",
            },
            isDragging: {
                true: "opacity-50",
                false: "",
            }
        },
        defaultVariants: {
            bookingStatus: "PENDING",
            isDragging: false,
        }
    }
);



export function BookingChip({ booking, dateKey }: Props) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: booking.id,
        data: { dateKey },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                "p-1 text-xs cursor-grab active:cursor-grabbing rounded-lg",
                bookingChipVariants({ bookingStatus: booking.bookingStatus, isDragging }),
                transform ? `translate-x-[${transform.x}px] translate-y-[${transform.y}px]` : ""
            )}
        >
            <CardContent className="flex flex-col items-center gap-1 px-1">
                <p className="font-bold truncate">{booking.client.name}</p>
                <Badge className="text-xs opacity-80 w-full truncate" variant="outline">{booking.service.name}</Badge>
            </CardContent>
        </Card>
    )
}