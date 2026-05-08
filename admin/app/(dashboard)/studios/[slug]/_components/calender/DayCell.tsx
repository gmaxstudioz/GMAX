import { CalendarBooking } from "@/lib/schemas/calendar";
import { BookingPerDay } from "@/lib/schemas/booking";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { BookingChip } from "./BookingChip";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

const MAX_VISIBLE = 3;

type Props = {
    day: BookingPerDay
    bookings: CalendarBooking[]
}

export function DayCell({ day, bookings }: Props ) {
    const { setNodeRef, isOver } = useDroppable({
        id: day.key,
    });
    const pathname = usePathname();

    const visibleBookings = bookings.slice(0, MAX_VISIBLE);
    const overflow = bookings.length - MAX_VISIBLE;

    // Context aware linking
    // Ensure clicking on the day or the "more" button leads to the specific Day page
    const targetUrl = pathname === "/bookings" 
        ? `/bookings/date/${day.key}` 
        : `${pathname}/bookings/${day.key}`;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "p-2 border rounded-lg min-h-[100px] transition-colors flex flex-col gap-2 relative group",
                isOver ? "bg-blue-50 dark:bg-blue-950/20" : "",
                !day.isCurrentMonth ? "opacity-50" : ""
            )}
        >
            <Link href={targetUrl} className="absolute inset-0 z-0 hidden group-hover:block rounded-lg ring-2 ring-primary/20 pointer-events-auto" title={`View bookings for ${day.key}`}></Link>
            
            <Button
                variant="secondary"
                size="icon"
                asChild
                className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full hover:bg-accent self-end z-10"
            >
                <Link href={targetUrl}>{day.date.getDate()}</Link>
            </Button>

            <div className="z-10 flex flex-col gap-2">
                {visibleBookings.map((booking) => (
                    <BookingChip key={booking.id} booking={booking} dateKey={day.key} />
                ))}
            </div>

            {overflow > 0 && (
                <Link
                    href={targetUrl}
                    className="text-xs text-muted-foreground p-1 hover:underline z-10"
                >
                    +{overflow} more
                </Link>
            )}
        </div>
    )
}