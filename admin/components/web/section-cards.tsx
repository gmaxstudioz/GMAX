"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon, WalletIcon, CalendarIcon, UsersIcon, CheckCircleIcon } from "lucide-react"

export interface DashboardMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  totalBookings: number;
  bookingsGrowth: number;
  activeClients: number;
  clientsGrowth: number;
  completionRate: number;
  completionRateGrowth: number;
}

export function SectionCards({ metrics }: { metrics: DashboardMetrics }) {
  const renderGrowthBadge = (growth: number) => {
    const isPositive = growth >= 0;
    const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;
    return (
      <Badge variant={isPositive ? "outline" : "destructive"}>
        <Icon className="size-3 mr-1" />
        {isPositive ? "+" : ""}{growth.toFixed(1)}%
      </Badge>
    );
  };

  const renderGrowthFooter = (growth: number, labelPositive: string, labelNegative: string) => {
    const isPositive = growth >= 0;
    const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;
    return (
      <div className="line-clamp-1 flex gap-2 font-medium">
        {isPositive ? labelPositive : labelNegative} {Math.abs(growth).toFixed(1)}%
        <Icon className="size-4" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {/* Total Revenue */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><WalletIcon className="size-4 text-muted-foreground"/> Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ₦{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </CardTitle>
          <CardAction>
            {renderGrowthBadge(metrics.revenueGrowth)}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {renderGrowthFooter(metrics.revenueGrowth, "Trending up", "Trending down")}
          <div className="text-muted-foreground">
            Compared to last 30 days
          </div>
        </CardFooter>
      </Card>

      {/* New Bookings */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><CalendarIcon className="size-4 text-muted-foreground"/> Total Bookings</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.totalBookings.toLocaleString()}
          </CardTitle>
          <CardAction>
            {renderGrowthBadge(metrics.bookingsGrowth)}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {renderGrowthFooter(metrics.bookingsGrowth, "Up from last month by", "Down from last month by")}
          <div className="text-muted-foreground">
            Total active bookings
          </div>
        </CardFooter>
      </Card>

      {/* Active Clients */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><UsersIcon className="size-4 text-muted-foreground"/> Active Clients</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.activeClients.toLocaleString()}
          </CardTitle>
          <CardAction>
            {renderGrowthBadge(metrics.clientsGrowth)}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {renderGrowthFooter(metrics.clientsGrowth, "Growing audience by", "Shrinking audience by")}
          <div className="text-muted-foreground">Unique clients who booked</div>
        </CardFooter>
      </Card>

      {/* Completion Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><CheckCircleIcon className="size-4 text-muted-foreground"/> Completion Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.completionRate.toFixed(1)}%
          </CardTitle>
          <CardAction>
            {renderGrowthBadge(metrics.completionRateGrowth)}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {renderGrowthFooter(metrics.completionRateGrowth, "Increased rate by", "Decreased rate by")}
          <div className="text-muted-foreground">Percent of COMPLETED bookings</div>
        </CardFooter>
      </Card>
    </div>
  )
}
