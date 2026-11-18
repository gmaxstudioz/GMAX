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
import { TrendingUpIcon, TrendingDownIcon, MinusIcon, WalletIcon, CalendarIcon, UsersIcon, CheckCircleIcon, CameraIcon } from "lucide-react"

export interface DashboardMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  totalBookings: number;
  bookingsGrowth: number;
  activeClients: number;
  clientsGrowth: number;
  completionRate: number;
  completionRateGrowth: number;
  todayPictures?: number;
  totalPictures?: number;
  picturesGrowth?: number | null;
}

export function SectionCards({
  metrics,
  isToday = true,
  comparisonLabel = "yesterday",
}: {
  metrics: DashboardMetrics;
  isToday?: boolean;
  comparisonLabel?: string;
}) {
  const renderGrowthBadge = (growth: number) => {
    if (growth === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <MinusIcon className="size-3 mr-1" />
          0.0%
        </Badge>
      );
    }
    const isPositive = growth > 0;
    const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;
    return (
      <Badge variant={isPositive ? "outline" : "destructive"}>
        <Icon className="size-3 mr-1" />
        {isPositive ? "+" : ""}{growth.toFixed(1)}%
      </Badge>
    );
  };

  const renderGrowthFooter = (growth: number, labelPositive: string, labelNegative: string) => {
    if (growth === 0) {
      return (
        <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-muted-foreground">
          <span>Steady vs {comparisonLabel}</span>
          <MinusIcon className="size-3.5" />
        </div>
      );
    }
    const isPositive = growth > 0;
    const Icon = isPositive ? TrendingUpIcon : TrendingDownIcon;
    return (
      <div className="line-clamp-1 flex items-center gap-1.5 font-medium">
        <span>{isPositive ? labelPositive : labelNegative} {Math.abs(growth).toFixed(1)}%</span>
        <Icon className="size-4" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 dark:*:data-[slot=card]:bg-card">
      {/* Daily Revenue */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <WalletIcon className="size-4 text-muted-foreground"/> {isToday ? "Today's Revenue" : "Daily Revenue"}
          </CardDescription>
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
            Compared to {comparisonLabel}
          </div>
        </CardFooter>
      </Card>

      {/* Daily Bookings */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground"/> {isToday ? "Today's Bookings" : "Daily Bookings"}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.totalBookings.toLocaleString()}
          </CardTitle>
          <CardAction>
            {renderGrowthBadge(metrics.bookingsGrowth)}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {renderGrowthFooter(
            metrics.bookingsGrowth,
            `Up from ${comparisonLabel} by`,
            `Down from ${comparisonLabel} by`
          )}
          <div className="text-muted-foreground">
            Total bookings for {isToday ? "today" : "this day"}
          </div>
        </CardFooter>
      </Card>

      {/* Completion Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <CheckCircleIcon className="size-4 text-muted-foreground"/> Completion Rate
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.completionRate.toFixed(1)}%
          </CardTitle>
          <CardAction>
            {renderGrowthBadge(metrics.completionRateGrowth)}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {renderGrowthFooter(
            metrics.completionRateGrowth,
            `Up from ${comparisonLabel} by`,
            `Down from ${comparisonLabel} by`
          )}
          <div className="text-muted-foreground">
            Percent of completed bookings for {isToday ? "today" : "this day"}
          </div>
        </CardFooter>
      </Card>

      {/* Pictures Snapped */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <CameraIcon className="size-4 text-muted-foreground"/> {isToday ? "Pictures Today" : "Daily Pictures"}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {(metrics.todayPictures ?? 0).toLocaleString()}
          </CardTitle>
          <CardAction>
            {metrics.picturesGrowth === null ? (
              <Badge variant="outline" className="text-muted-foreground">No prior-day pictures</Badge>
            ) : (
              renderGrowthBadge(metrics.picturesGrowth ?? 0)
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground">
            <span>Total till date: <strong>{(metrics.totalPictures ?? 0).toLocaleString()}</strong></span>
          </div>
          <div className="text-muted-foreground">
            Cumulative pictures snapped till date
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
