import type { Metadata } from "next";
import { ChartAreaInteractive } from "@/components/web/chart-area-interactive"
import { DataTable } from "@/components/web/data-table"
import { SectionCards } from "@/components/web/section-cards"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BriefcaseIcon, CheckCircleIcon, ClockIcon } from "lucide-react"
import { PostHogErrorTrackingTestButton } from "./_components/PostHogErrorTrackingTestButton"

import { redirect } from "next/navigation";

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
    redirect("/auth/login");
  }

  const members = await db.query.member.findMany({
    where: (member, { eq }) => eq(member.userId, session.user.id),
    columns: { id: true, role: true, studioId: true }
  });
  
  const adminRoles = ["owner", "developer", "manager"];
  const hasAdminRole = members.some(m => adminRoles.includes(m.role));
  const isOnlyMinorRole = members.length > 0 && !hasAdminRole;

  if (isOnlyMinorRole) {
    const minorRoleStats = { total: 0, completed: 0, pending: 0 };
    const userMemberIds = members.map(m => m.id);
    const myBookings = userMemberIds.length > 0 ? await db.query.booking.findMany({
      where: (booking, { inArray }) => inArray(booking.memberId, userMemberIds)
    }) : [];
    
    minorRoleStats.total = myBookings.length;
    minorRoleStats.completed = myBookings.filter(b => b.bookingStatus === "COMPLETED").length;
    minorRoleStats.pending = myBookings.filter(b => b.bookingStatus === "PENDING").length;

    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <h1 className="text-2xl font-bold">Welcome, {session?.user.name}!</h1>
        <p className="text-muted-foreground">Here is an overview of your tasks and assignments.</p>
        <PostHogErrorTrackingTestButton />
        
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
  const allRelevantBookings = studioIds.length > 0 ? await db.query.booking.findMany({
    where: (booking, { inArray, not, eq, and }) => and(inArray(booking.studioId, studioIds), not(eq(booking.bookingStatus, "CANCELLED"))),
    with: { client: true, service: true }
  }) : [];

  const recentBookings = allRelevantBookings.filter(b => new Date(b.createdAt).getTime() >= thirtyDaysAgo.getTime());
  const previousBookings = allRelevantBookings.filter(b => new Date(b.createdAt).getTime() >= sixtyDaysAgo.getTime() && new Date(b.createdAt).getTime() < thirtyDaysAgo.getTime());

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
  const bookingsLast90Days = allRelevantBookings.filter(b => new Date(b.createdAt).getTime() >= ninetyDaysAgo.getTime());
  const chartDataMap = new Map<string, number>();
  
  // Pre-fill the map with 0s for the last 90 days
  for(let i=0; i<90; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      chartDataMap.set(d.toISOString().split('T')[0], 0);
  }

  bookingsLast90Days.forEach(b => {
      const dateStr = b.createdAt ? String(b.createdAt).split("T")[0] : "";
      if (dateStr && chartDataMap.has(dateStr)) {
          chartDataMap.set(dateStr, chartDataMap.get(dateStr)! + Number(b.totalAmount));
      }
  });

  const chartData = Array.from(chartDataMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

  // Recent Bookings for Data Table
  const rawRecentBookings = studioIds.length > 0 ? await db.query.booking.findMany({
      where: (booking, { inArray }) => inArray(booking.studioId, studioIds),
      orderBy: (booking, { desc }) => [desc(booking.createdAt)],
      limit: 10,
      with: { client: true, service: true }
  }) : [];

  const tableData = rawRecentBookings.map(b => ({
      id: b.id,
      clientName: b.client?.name ?? 'Unknown',
      clientImage: b.client?.image ?? null,
      serviceName: b.service?.name ?? 'Unknown',
      bookingDate: b.bookingDate && typeof (b.bookingDate as any).getTime === 'function' && !isNaN((b.bookingDate as any).getTime()) 
          ? (b.bookingDate as any).toISOString() 
          : (typeof b.bookingDate === 'string' ? b.bookingDate : null),
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
