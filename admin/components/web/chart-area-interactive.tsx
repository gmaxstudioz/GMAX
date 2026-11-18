"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { formatPrice } from "@/lib/formatters"
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

function formatChartDate(value: unknown, options: Intl.DateTimeFormatOptions) {
  return new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-US", options)
}

export function ChartAreaInteractive({
  data,
  title = "Revenue Trend",
  description,
  totalAmount,
}: {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  totalAmount?: number;
}) {
  return (
    <Card className="@container/card">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description ?? "Daily revenue trend for the selected period"}
          </CardDescription>
        </div>
        {totalAmount !== undefined && (
          <CardAction className="self-center">
            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-medium text-muted-foreground">Revenue in Period</span>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-primary">
                {formatPrice(totalAmount)}
              </span>
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <AreaChart data={data}>
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
              tickFormatter={(value) =>
                formatChartDate(value, { month: "short", day: "numeric" })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    formatChartDate(value, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(value) => [
                    formatPrice(Number(value)),
                    "Revenue"
                  ]}
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

