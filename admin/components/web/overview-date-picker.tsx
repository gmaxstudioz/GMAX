"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, addDays, subDays } from "date-fns"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Loader2, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function OverviewDatePicker({
  selectedDateString,
  todayDateString,
  currentStudioSlug,
}: {
  selectedDateString: string; // Format: YYYY-MM-DD
  todayDateString?: string;   // Format: YYYY-MM-DD from server
  currentStudioSlug?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const serverTodayStr = todayDateString ?? format(new Date(), "yyyy-MM-dd");

  const selectedDate = React.useMemo(() => {
    const parsed = parseISO(selectedDateString);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [selectedDateString]);

  const isCurrentDayToday = selectedDateString === serverTodayStr;

  const buildUrl = (dateStr: string | null) => {
    const params = new URLSearchParams();
    if (dateStr) {
      params.set("date", dateStr);
    }
    if (currentStudioSlug && currentStudioSlug !== "all") {
      params.set("studio", currentStudioSlug);
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const navigateToDate = (newDate: Date) => {
    const formatted = format(newDate, "yyyy-MM-dd");

    startTransition(() => {
      if (formatted === serverTodayStr) {
        router.push(buildUrl(null));
      } else {
        router.push(buildUrl(formatted));
      }
    });
  };

  const goToToday = () => {
    startTransition(() => {
      router.push(buildUrl(null));
    });
  };

  const goToPreviousDay = () => {
    navigateToDate(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    navigateToDate(addDays(selectedDate, 1));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border bg-card p-0.5 shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={goToPreviousDay}
          title="Previous day"
          aria-label="Previous day"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              className={cn(
                "h-8 px-2.5 font-medium text-xs sm:text-sm gap-1.5",
                isCurrentDayToday && "font-semibold"
              )}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <CalendarIcon className="size-3.5 text-muted-foreground" />
              )}
              <span>{format(selectedDate, "EEE, MMM d, yyyy")}</span>
              {isCurrentDayToday && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-normal">
                  Today
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  navigateToDate(date);
                  setPopoverOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={goToNextDay}
          title="Next day"
          aria-label="Next day"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {!isCurrentDayToday && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="h-8 text-xs gap-1.5"
          onClick={goToToday}
        >
          <RotateCcwIcon className="size-3" />
          Reset to Today
        </Button>
      )}

      {isPending && (
        <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary font-medium bg-primary/10 rounded-md animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          <span>Updating...</span>
        </span>
      )}
    </div>
  );
}
