
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Prisma } from "@/lib/generated/prisma/client";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react"
import { startOfMonth, subMonths, endOfMonth } from "date-fns";
import { calcTrend, TrendBadge, TrendFooter } from "@/components/web/trend-indicators";


type StudioWithRelations = Prisma.StudioGetPayload<{
  include: {
    members: {
        include: { user: true }
    },
    invitations: true,
    categories: {
      include: {
        services: true
      }
    },
    studioSessions: true,
    clients: {
        include: {
            bookings: true
        }
    },
    bookings: {
      include: {
        client: true,
        service: true
      }
    }
  }
}>;


export function StudioStatsCards({ data }: { data: StudioWithRelations }) {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    // --- Revenue ---
    function getRevenue(bookings: typeof data.bookings) {
        return bookings
            .filter(b => b.paymentStatus === "PAID")
            .reduce((sum, b) => {
                const sessionTotal = (b.service?.price || 0) * (b.sessionCount || 1);
                const addonsTotal = (b as any).addons?.reduce((aSum: number, a: any) => aSum + (a.salePrice ?? a.price ?? 0), 0) || 0;
                return sum + sessionTotal + addonsTotal;
            }, 0);
    }

    const totalRevenue = getRevenue(data.bookings);
    const thisMonthRevenue = getRevenue(data.bookings.filter(b => new Date(b.bookingDate) >= thisMonthStart));
    const prevMonthRevenue = getRevenue(data.bookings.filter(b => {
        const d = new Date(b.bookingDate);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }));
    const revenueTrend = calcTrend(thisMonthRevenue, prevMonthRevenue);

    // --- Active Bookings ---
    const activeBookings = data.bookings.filter(b => b.bookingStatus !== "COMPLETED" && b.bookingStatus !== "CANCELLED").length;
    const thisMonthBookings = data.bookings.filter(b => new Date(b.createdAt) >= thisMonthStart).length;
    const prevMonthBookings = data.bookings.filter(b => {
        const d = new Date(b.createdAt);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const bookingsTrend = calcTrend(thisMonthBookings, prevMonthBookings);

    // --- Clients ---
    const totalClients = data.clients.length;
    const thisMonthClients = data.clients.filter(c => new Date(c.createdAt) >= thisMonthStart).length;
    const prevMonthClients = data.clients.filter(c => {
        const d = new Date(c.createdAt);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const clientsTrend = calcTrend(thisMonthClients, prevMonthClients);

    // --- Completion Rate ---
    const completedBookings = data.bookings.filter(b => b.bookingStatus === "COMPLETED").length;
    const totalBookingsCount = data.bookings.length;
    const completionRate = totalBookingsCount > 0 ? Math.round((completedBookings / totalBookingsCount) * 100 * 10) / 10 : 0;

    const thisMonthCompleted = data.bookings.filter(b => b.bookingStatus === "COMPLETED" && new Date(b.bookingDate) >= thisMonthStart).length;
    const thisMonthTotal = data.bookings.filter(b => new Date(b.bookingDate) >= thisMonthStart).length;
    const thisMonthRate = thisMonthTotal > 0 ? (thisMonthCompleted / thisMonthTotal) * 100 : 0;

    const prevMonthCompleted = data.bookings.filter(b => {
        const d = new Date(b.bookingDate);
        return b.bookingStatus === "COMPLETED" && d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const prevMonthTotal = data.bookings.filter(b => {
        const d = new Date(b.bookingDate);
        return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;
    const prevMonthRate = prevMonthTotal > 0 ? (prevMonthCompleted / prevMonthTotal) * 100 : 0;
    const completionTrend = calcTrend(thisMonthRate, prevMonthRate);

    return (
        <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
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
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Active Bookings</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {activeBookings}
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
                    <CardDescription>Total Clients</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {totalClients}
                    </CardTitle>
                    <CardAction>
                        <TrendBadge trend={clientsTrend} />
                    </CardAction>
                </CardHeader>
                <TrendFooter
                    trend={clientsTrend}
                    upText="Client growth this month"
                    downText="Fewer new clients this month"
                    flatText="Client count steady"
                    subtitle="New clients vs last month"
                />
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Completion Rate</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {completionRate}%
                    </CardTitle>
                    <CardAction>
                        <TrendBadge trend={completionTrend} />
                    </CardAction>
                </CardHeader>
                <TrendFooter
                    trend={completionTrend}
                    upText="Completion rate improving"
                    downText="Completion rate declining"
                    flatText="Completion rate stable"
                    subtitle="Compared to last month"
                />
            </Card>
        </div>
    )
}
