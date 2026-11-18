"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { format, parseISO, isValid } from "date-fns"
import type { DateRange } from "react-day-picker"
import { CalendarIcon, CheckIcon, Loader2, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type DateRangePreset = "7d" | "30d" | "90d" | "month" | "year" | "all" | "custom"

interface PresetOption {
  value: DateRangePreset
  label: string
  shortLabel: string
}

const PRESETS: PresetOption[] = [
  { value: "7d", label: "Last 7 days", shortLabel: "7D" },
  { value: "30d", label: "Last 30 days", shortLabel: "30D" },
  { value: "90d", label: "Last 90 days", shortLabel: "90D" },
  { value: "month", label: "This month", shortLabel: "Month" },
  { value: "year", label: "This year", shortLabel: "Year" },
  { value: "all", label: "All time", shortLabel: "All" },
]

export function FinanceDateRangePicker({
  currentRange,
  startDateStr,
  endDateStr,
  rangeLabel,
}: {
  currentRange: DateRangePreset
  startDateStr: string
  endDateStr: string
  rangeLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isPending, startTransition] = React.useTransition()
  const [popoverOpen, setPopoverOpen] = React.useState(false)

  // Local calendar range selection while popover is open
  const [localRange, setLocalRange] = React.useState<DateRange | undefined>(undefined)

  const defaultFrom = parseISO(startDateStr)
  const defaultTo = parseISO(endDateStr)
  const calendarRange: DateRange = localRange ?? {
    from: isValid(defaultFrom) ? defaultFrom : new Date(),
    to: isValid(defaultTo) ? defaultTo : new Date(),
  }

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open)
    if (!open) {
      setLocalRange(undefined)
    }
  }

  const buildUrl = (preset: DateRangePreset, from?: string, to?: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (preset === "30d") {
      params.delete("range")
      params.delete("from")
      params.delete("to")
    } else if (preset === "custom" && from && to) {
      params.set("range", "custom")
      params.set("from", from)
      params.set("to", to)
    } else {
      params.set("range", preset)
      params.delete("from")
      params.delete("to")
    }

    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const navigateTo = (preset: DateRangePreset, from?: string, to?: string) => {
    const url = buildUrl(preset, from, to)
    startTransition(() => {
      router.push(url)
    })
  }

  const selectPreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setPopoverOpen(true)
      return
    }
    navigateTo(preset)
  }

  const applyCustomRange = () => {
    if (!calendarRange?.from) return
    const from = format(calendarRange.from, "yyyy-MM-dd")
    const to = calendarRange.to ? format(calendarRange.to, "yyyy-MM-dd") : from
    navigateTo("custom", from, to)
    setPopoverOpen(false)
    setLocalRange(undefined)
  }

  const applyPopoverPreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      return
    }
    navigateTo(preset)
    setPopoverOpen(false)
    setLocalRange(undefined)
  }

  const resetToDefault = () => {
    navigateTo("30d")
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick preset pills for desktop */}
      <div className={cn(
        "hidden sm:flex items-center rounded-lg border bg-card p-0.5 shadow-xs transition-opacity",
        isPending && "opacity-80"
      )}>
        {PRESETS.map((p) => {
          const isActive = currentRange === p.value
          return (
            <button
              key={p.value}
              type="button"
              disabled={isPending}
              onClick={() => selectPreset(p.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer disabled:cursor-not-allowed",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {p.shortLabel}
            </button>
          )
        })}
      </div>

      {/* Select dropdown for mobile */}
      <div className="sm:hidden">
        <Select
          value={currentRange}
          disabled={isPending}
          onValueChange={(val) => selectPreset(val as DateRangePreset)}
        >
          <SelectTrigger className="h-8 w-32 text-xs bg-card">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
            <SelectItem value="custom" className="text-xs">
              Custom range...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date range picker popover */}
      <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            className={cn(
              "h-8 px-2.5 text-xs font-medium gap-1.5 bg-card shadow-xs",
              currentRange === "custom" && "border-primary/50 text-primary font-semibold"
            )}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <CalendarIcon className="size-3.5 text-muted-foreground" />
            )}
            <span>{rangeLabel}</span>
            {currentRange === "custom" && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                Custom
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Select date range</span>
              <span className="text-[11px] text-muted-foreground">
                {calendarRange?.from ? (
                  calendarRange.to ? (
                    `${format(calendarRange.from, "MMM d, yyyy")} – ${format(calendarRange.to, "MMM d, yyyy")}`
                  ) : (
                    format(calendarRange.from, "MMM d, yyyy")
                  )
                ) : (
                  "Select start date"
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => applyPopoverPreset("7d")}
              >
                Last 7d
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => applyPopoverPreset("30d")}
              >
                Last 30d
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => applyPopoverPreset("month")}
              >
                This month
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => applyPopoverPreset("year")}
              >
                This year
              </Button>
            </div>
          </div>

          <Calendar
            mode="range"
            selected={calendarRange}
            onSelect={setLocalRange}
            numberOfMonths={1}
          />

          <div className="p-3 border-t flex items-center justify-between gap-2 bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!calendarRange?.from}
              onClick={applyCustomRange}
            >
              <CheckIcon className="size-3" />
              Apply Range
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reset button if custom or non-default */}
      {currentRange !== "30d" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          onClick={resetToDefault}
          title="Reset to last 30 days"
        >
          <RotateCcwIcon className="size-3" />
          <span className="hidden md:inline">Reset</span>
        </Button>
      )}

      {/* Loading indicator */}
      {isPending && (
        <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary font-medium bg-primary/10 rounded-md animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          <span>Updating...</span>
        </span>
      )}
    </div>
  )
}
