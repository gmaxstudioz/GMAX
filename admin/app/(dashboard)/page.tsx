import type { Metadata } from "next";
import { ChartAreaInteractive } from "@/components/web/chart-area-interactive"
import { DataTable } from "@/components/web/data-table"
import { SectionCards } from "@/components/web/section-cards"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BriefcaseIcon, CheckCircleIcon, ClockIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "View your studio analytics, performance metrics, and recent activity at a glance.",
};

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const members = await prisma.member.findMany({
    where: { userId: session.user.id },
    select: { role: true, studioId: true }
  });
  
  const adminRoles = ["owner", "developer", "manager"];
  const hasAdminRole = members.some(m => adminRoles.includes(m.role));
  const isOnlyMinorRole = members.length > 0 && !hasAdminRole;

  if (isOnlyMinorRole) {
    const minorRoleStats = { total: 0, completed: 0, pending: 0 };
    const myBookings = await prisma.booking.findMany({
      where: { member: { userId: session.user.id } }
    });
    minorRoleStats.total = myBookings.length;
    minorRoleStats.completed = myBookings.filter(b => b.bookingStatus === "COMPLETED").length;
    minorRoleStats.pending = myBookings.filter(b => b.bookingStatus === "PENDING").length;

    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Welcome, {session?.user.name}!</h1>
        <p className="text-muted-foreground">Here is an overview of your tasks and assignments.</p>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assigned Tasks</CardTitle>
              <BriefcaseIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{minorRoleStats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <ClockIcon className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{minorRoleStats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{minorRoleStats.completed}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // === ADMIN DATA AGGREGATION ===
  const studioIds = members.filter(m => adminRoles.includes(m.role)).map(m => m.studioId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all bookings for metrics (exclude cancelled ones from positive metrics if desired, but let's include all non-cancelled)
  const allRelevantBookings = await prisma.booking.findMany({
    where: { studioId: { in: studioIds }, bookingStatus: { not: "CANCELLED" } },
    include: { client: true, service: true }
  });

  const recentBookings = allRelevantBookings.filter(b => b.createdAt >= thirtyDaysAgo);
  const previousBookings = allRelevantBookings.filter(b => b.createdAt >= sixtyDaysAgo && b.createdAt < thirtyDaysAgo);

  const totalRevenueRecent = recentBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const totalRevenuePrev = previousBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const revenueGrowth = totalRevenuePrev === 0 ? (totalRevenueRecent > 0 ? 100 : 0) : ((totalRevenueRecent - totalRevenuePrev) / totalRevenuePrev) * 100;

  const totalBookingsRecent = recentBookings.length;
  const totalBookingsPrev = previousBookings.length;
  const bookingsGrowth = totalBookingsPrev === 0 ? (totalBookingsRecent > 0 ? 100 : 0) : ((totalBookingsRecent - totalBookingsPrev) / totalBookingsPrev) * 100;

  const activeClientsRecent = new Set(recentBookings.map(b => b.clientId)).size;
  const activeClientsPrev = new Set(previousBookings.map(b => b.clientId)).size;
  const clientsGrowth = activeClientsPrev === 0 ? (activeClientsRecent > 0 ? 100 : 0) : ((activeClientsRecent - activeClientsPrev) / activeClientsPrev) * 100;

  const completedRecent = recentBookings.filter(b => b.bookingStatus === "COMPLETED").length;
  const completedPrev = previousBookings.filter(b => b.bookingStatus === "COMPLETED").length;
  const completionRateRecent = totalBookingsRecent === 0 ? 0 : (completedRecent / totalBookingsRecent) * 100;
  const completionRatePrev = totalBookingsPrev === 0 ? 0 : (completedPrev / totalBookingsPrev) * 100;
  const completionRateGrowth = completionRateRecent - completionRatePrev;

  const metrics = {
    totalRevenue: allRelevantBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0),
    revenueGrowth,
    totalBookings: allRelevantBookings.length,
    bookingsGrowth,
    activeClients: new Set(allRelevantBookings.map(b => b.clientId)).size,
    clientsGrowth,
    completionRate: allRelevantBookings.length === 0 ? 0 : (allRelevantBookings.filter(b => b.bookingStatus === "COMPLETED").length / allRelevantBookings.length) * 100,
    completionRateGrowth
  };

  // Chart Data (last 90 days aggregated by day)
  const bookingsLast90Days = allRelevantBookings.filter(b => b.createdAt >= ninetyDaysAgo);
  const chartDataMap = new Map<string, number>();
  
  // Pre-fill the map with 0s for the last 90 days
  for(let i=0; i<90; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      chartDataMap.set(d.toISOString().split('T')[0], 0);
  }

  bookingsLast90Days.forEach(b => {
      const dateStr = b.createdAt.toISOString().split('T')[0];
      if (chartDataMap.has(dateStr)) {
          chartDataMap.set(dateStr, chartDataMap.get(dateStr)! + Number(b.totalAmount));
      }
  });

  const chartData = Array.from(chartDataMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

  // Recent Bookings for Data Table
  const rawRecentBookings = await prisma.booking.findMany({
      where: { studioId: { in: studioIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { client: true, service: true }
  });

  const tableData = rawRecentBookings.map(b => ({
      id: b.id,
      clientName: b.client?.name ?? 'Unknown',
      clientImage: b.client?.image ?? null,
      serviceName: b.service?.name ?? 'Unknown',
      bookingDate: b.bookingDate && typeof b.bookingDate.getTime === 'function' && !isNaN(b.bookingDate.getTime()) 
          ? b.bookingDate.toISOString() 
          : new Date().toISOString(),
      totalAmount: Number(b.totalAmount),
      bookingStatus: b.bookingStatus
  }));

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards metrics={metrics} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={chartData} />
      </div>
      <DataTable data={tableData} />
    </div>
  )
}
