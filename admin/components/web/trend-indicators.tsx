import { Badge } from "@/components/ui/badge"
import { CardFooter } from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react"

export function calcTrend(current: number, previous: number) {
    if (previous === 0 && current === 0) return { pct: 0, direction: "flat" as const };
    if (previous === 0) return { pct: 100, direction: "up" as const };
    const pct = ((current - previous) / previous) * 100;
    if (pct > 0) return { pct: Math.round(pct * 10) / 10, direction: "up" as const };
    if (pct < 0) return { pct: Math.round(Math.abs(pct) * 10) / 10, direction: "down" as const };
    return { pct: 0, direction: "flat" as const };
}

export function TrendBadge({ trend }: { trend: { pct: number; direction: "up" | "down" | "flat" } }) {
    if (trend.direction === "flat") {
        return (
            <Badge variant="outline">
                <MinusIcon />
                0%
            </Badge>
        );
    }
    return (
        <Badge variant="outline">
            {trend.direction === "up" ? <TrendingUpIcon /> : <TrendingDownIcon />}
            {trend.direction === "up" ? "+" : "-"}{trend.pct}%
        </Badge>
    );
}

export function TrendFooter({ trend, upText, downText, flatText, subtitle }: {
    trend: { pct: number; direction: "up" | "down" | "flat" };
    upText: string;
    downText: string;
    flatText: string;
    subtitle: string;
}) {
    const text = trend.direction === "up" ? upText : trend.direction === "down" ? downText : flatText;
    const Icon = trend.direction === "up" ? TrendingUpIcon : trend.direction === "down" ? TrendingDownIcon : MinusIcon;
    return (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
                {text}{" "}
                <Icon className="size-4" />
            </div>
            <div className="text-muted-foreground">{subtitle}</div>
        </CardFooter>
    );
}
