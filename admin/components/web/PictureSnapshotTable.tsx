import { Camera, Calendar, Layers, Image as ImageIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import type { PictureSnapshotItem } from "@/lib/actions/picture-snapshots";

interface PictureSnapshotTableProps {
  snapshots: PictureSnapshotItem[];
  title?: string;
  description?: string;
  maxRows?: number;
  allTimeTotal?: number;
}

export function PictureSnapshotTable({
  snapshots,
  title = "Pictures Snapped",
  description = "Daily breakdown of pictures snapped and cumulative running total to date.",
  maxRows = 30,
  allTimeTotal,
}: PictureSnapshotTableProps) {
  const rows = snapshots.slice(0, maxRows);

  const formatDisplayDate = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      if (isValid(parsed)) {
        return format(parsed, "MMM d, yyyy");
      }
    } catch {
      // Fallback
    }
    return dateStr;
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
        {allTimeTotal !== undefined && (
          <Badge variant="outline" className="px-2.5 py-1 text-xs font-semibold gap-1.5 self-start sm:self-auto">
            <ImageIcon className="size-3 text-primary" />
            <span>Total Pictures: <strong className="text-foreground">{allTimeTotal.toLocaleString()}</strong></span>
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[180px] font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    Date
                  </span>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Camera className="size-3.5 text-muted-foreground" />
                    Pictures Snapped
                  </span>
                </TableHead>
                <TableHead className="text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="size-3.5 text-muted-foreground" />
                    Total Snapped Till Date
                  </span>
                </TableHead>
                <TableHead className="text-right font-semibold text-muted-foreground">
                  Bookings
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                      <Camera className="size-6 text-muted-foreground/50" />
                      <span>No picture records found for this period.</span>
                      <span className="text-xs text-muted-foreground/70">
                        Pictures are recorded from bookings and bulk booking entries.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium whitespace-nowrap text-xs sm:text-sm">
                      {formatDisplayDate(row.date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge
                        variant={row.picturesOnDay > 0 ? "secondary" : "outline"}
                        className="font-mono text-xs"
                      >
                        {row.picturesOnDay.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary text-xs sm:text-sm font-mono">
                      {row.cumulativePictures.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {row.bookingCount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
