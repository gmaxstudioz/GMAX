"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export interface ChartDataPoint {
  date: string;
  revenue: number;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--primary)",
  }
} satisfies ChartConfig

export function ChartAreaInteractive({ data }: { data: ChartDataPoint[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState<string | null>(null)
  const selectedTimeRange = timeRange ?? (isMobile ? "7d" : "90d")

  const referenceDate = React.useMemo(
    () => data.reduce(
      (latest, item) => item.date > latest ? item.date : latest,
      new Date().toISOString().slice(0, 10),
    ),
    [data],
  )

  const filteredData = data.filter((item) => {
    let daysToShow = 90
    if (selectedTimeRange === "30d") {
      daysToShow = 30
    } else if (selectedTimeRange === "7d") {
      daysToShow = 7
    }
    const startDate = new Date(`${referenceDate}T00:00:00.000Z`)
    startDate.setUTCDate(startDate.getUTCDate() - daysToShow + 1)
    const startDateKey = startDate.toISOString().slice(0, 10)
    return item.date >= startDateKey && item.date <= referenceDate
  })

  const formatChartDate = (value: string | number) =>
    new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Revenue</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Revenue for the last {selectedTimeRange === '90d' ? '3 months' : selectedTimeRange === '30d' ? '30 days' : '7 days'}
          </span>
          <span className="@[540px]/card:hidden">Last {selectedTimeRange.replace('d', ' days')}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={selectedTimeRange}
            onValueChange={(val) => val && setTimeRange(val)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={selectedTimeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-revenue)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-revenue)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatChartDate}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="revenue"
              type="natural"
              fill="url(#fillRevenue)"
              stroke="var(--color-revenue)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
