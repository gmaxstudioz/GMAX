import { Camera, Calendar, Layers, Image as ImageIcon, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PictureSnapshotItem } from "@/lib/actions/picture-snapshots";

export interface PictureSnapshotCardProps {
  snapshots?: PictureSnapshotItem[];
  title?: string;
  description?: string;
  periodLabel?: string;
  periodPictures?: number;
  allTimeTotal?: number;
  bookingCount?: number;
  averagePictures?: number;
  growth?: number | null;
  growthDetail?: string;
  comparisonLabel?: string;
  studioName?: string;
  maxRows?: number;
  unavailable?: boolean;
}

export function PictureSnapshotCard({
  snapshots = [],
  title = "Pictures Snapped",
  description = "Summary of pictures snapped and deliverable metrics.",
  periodLabel,
  periodPictures,
  allTimeTotal,
  bookingCount,
  averagePictures,
  growth,
  growthDetail,
  comparisonLabel,
  studioName,
  unavailable = false,
}: PictureSnapshotCardProps) {
  if (unavailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="size-4 text-primary" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-28 flex flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Camera className="size-6 text-muted-foreground/50" />
          <span>Picture snapshots unavailable.</span>
        </CardContent>
      </Card>
    );
  }

  // Derive values if not explicitly provided
  const derivedPeriodPictures = periodPictures ?? snapshots.reduce((sum, s) => sum + s.picturesOnDay, 0);
  const derivedAllTimeTotal = allTimeTotal ?? snapshots[0]?.cumulativePictures ?? 0;
  const derivedBookingCount = bookingCount ?? snapshots.reduce((sum, s) => sum + s.bookingCount, 0);
  const derivedAverage =
    averagePictures ??
    (derivedBookingCount > 0 ? Math.round(derivedPeriodPictures / derivedBookingCount) : 0);

  const renderGrowthBadge = () => {
    if (growth === null) {
      return (
        <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
          {growthDetail ?? "No prior comparison"}
        </Badge>
      );
    }
    if (growth === undefined) {
      if (growthDetail) {
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
            {growthDetail}
          </Badge>
        );
      }
      return null;
    }
    if (growth === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground text-xs">
          <Minus className="size-3 mr-1" />
          0.0%
        </Badge>
      );
    }
    const isPositive = growth > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <Badge variant={isPositive ? "outline" : "destructive"} className="text-xs">
        <Icon className="size-3 mr-1" />
        {isPositive ? "+" : ""}{growth.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="size-4 text-primary" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {description}
          </CardDescription>
        </div>
        {derivedAllTimeTotal > 0 && (
          <Badge variant="outline" className="px-2.5 py-1 text-xs font-semibold gap-1.5 self-start sm:self-auto">
            <ImageIcon className="size-3 text-primary" />
            <span>Total Pictures: <strong className="text-foreground">{derivedAllTimeTotal.toLocaleString()}</strong></span>
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Pictures Snapped in Period */}
          <div className="rounded-lg border bg-card p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Camera className="size-3.5 text-primary" />
                {periodLabel ? `Pictures · ${periodLabel}` : "Pictures Snapped"}
              </span>
              {renderGrowthBadge()}
            </div>
            <div className="text-2xl font-semibold tracking-tight text-primary tabular-nums">
              {derivedPeriodPictures.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {growthDetail
                ? growthDetail
                : comparisonLabel
                  ? `Compared to ${comparisonLabel}`
                  : "Pictures recorded in period"}
            </p>
          </div>

          {/* Card 2: Cumulative All-Time */}
          <div className="rounded-lg border bg-card p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                All-Time Total
              </span>
              <Badge variant="secondary" className="text-xs font-normal">
                Lifetime
              </Badge>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {derivedAllTimeTotal.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {studioName ? `All-time total for ${studioName}` : "Cumulative pictures recorded"}
            </p>
          </div>

          {/* Card 3: Sessions with Pictures */}
          <div className="rounded-lg border bg-card p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                Sessions / Bookings
              </span>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                Recorded
              </Badge>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {derivedBookingCount.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {periodLabel ? `Bookings recorded in ${periodLabel.toLowerCase()}` : "Bookings recorded in period"}
            </p>
          </div>

          {/* Card 4: Average Deliverables */}
          <div className="rounded-lg border bg-card p-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Pace / Average
              </span>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                Per Session
              </Badge>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {derivedAverage.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Average pictures delivered per booking
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const PictureSnapshotTable = PictureSnapshotCard;
