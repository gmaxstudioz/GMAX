import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react"
import { startOfMonth, subMonths, endOfMonth } from "date-fns";
import { calcTrend, TrendBadge, TrendFooter } from "@/components/web/trend-indicators";

type StudioWithCounts = {
    id: string;
    createdAt: Date;
    clients: { id: string; createdAt: Date }[];
    bookings: { id: string; createdAt: Date; bookingDate: Date; bookingStatus: string; paymentStatus: string; sessionCount: number; service: { price: number } | null }[];
    members: { id: string }[];
};


export function StudioStatsCards({ studioData }: { studioData: StudioWithCounts[] }) {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    // Flatten across all studios
    const allBookings = studioData.flatMap(s => s.bookings);
    const allClients = studioData.flatMap(s => s.clients);
    const allMembers = studioData.flatMap(s => s.members);

    // --- Total Studios ---
    const totalStudios = studioData.length;
    const thisMonthStudios = studioData.filter(s => new Date(s.createdAt) >= thisMonthStart).length;
    const prevMonthStudios = studioData.filter(s => {
        const d = new Date(s.createdAt);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const studiosTrend = calcTrend(thisMonthStudios, prevMonthStudios);

    // --- Total Clients (across all studios) ---
    const totalClients = allClients.length;
    const thisMonthClients = allClients.filter(c => new Date(c.createdAt) >= thisMonthStart).length;
    const prevMonthClients = allClients.filter(c => {
        const d = new Date(c.createdAt);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const clientsTrend = calcTrend(thisMonthClients, prevMonthClients);

    // --- Active Bookings ---
    const activeBookings = allBookings.filter(b => b.bookingStatus !== "COMPLETED" && b.bookingStatus !== "CANCELLED").length;
    const thisMonthBookings = allBookings.filter(b => new Date(b.createdAt) >= thisMonthStart).length;
    const prevMonthBookings = allBookings.filter(b => {
        const d = new Date(b.createdAt);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const bookingsTrend = calcTrend(thisMonthBookings, prevMonthBookings);

    // --- Total Revenue ---
    function getRevenue(bookings: typeof allBookings) {
        return bookings
            .filter(b => b.paymentStatus === "PAID")
            .reduce((sum, b) => {
                const sessionTotal = (b.service?.price || 0) * (b.sessionCount || 1);
                return sum + sessionTotal;
            }, 0);
    }

    const totalRevenue = getRevenue(allBookings);
    const thisMonthRevenue = getRevenue(allBookings.filter(b => new Date(b.bookingDate) >= thisMonthStart));
    const prevMonthRevenue = getRevenue(allBookings.filter(b => {
        const d = new Date(b.bookingDate);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }));
    const revenueTrend = calcTrend(thisMonthRevenue, prevMonthRevenue);

    return (
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Studios</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {totalStudios}
                    </CardTitle>
                    <CardAction>
                        <TrendBadge trend={studiosTrend} />
                    </CardAction>
                </CardHeader>
                <TrendFooter
                    trend={studiosTrend}
                    upText="New studios this month"
                    downText="Fewer studios added"
                    flatText="No new studios"
                    subtitle="Compared to last month"
                />
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Clients</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {totalClients.toLocaleString()}
                    </CardTitle>
                    <CardAction>
                        <TrendBadge trend={clientsTrend} />
                    </CardAction>
                </CardHeader>
                <TrendFooter
                    trend={clientsTrend}
                    upText="Client growth this month"
                    downText="Fewer new clients"
                    flatText="Client count steady"
                    subtitle="New clients vs last month"
                />
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Active Bookings</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {activeBookings.toLocaleString()}
                    </CardTitle>
                    <CardAction>
                        <TrendBadge trend={bookingsTrend} />
                    </CardAction>
                </CardHeader>
                <TrendFooter
                    trend={bookingsTrend}
                    upText="More bookings this month"
                    downText="Fewer bookings this month"
                    flatText="Bookings steady"
                    subtitle="New bookings vs last month"
                />
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Revenue</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        ₦{totalRevenue.toLocaleString()}
                    </CardTitle>
                    <CardAction>
                        <TrendBadge trend={revenueTrend} />
                    </CardAction>
                </CardHeader>
                <TrendFooter
                    trend={revenueTrend}
                    upText="Revenue up this month"
                    downText="Revenue down this month"
                    flatText="Revenue steady"
                    subtitle="Compared to last month"
                />
            </Card>
        </div>
    )
}
