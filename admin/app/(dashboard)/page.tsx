import type { Metadata } from "next";
import { ChartAreaInteractive } from "@/components/web/chart-area-interactive"
import { DataTable } from "@/components/web/data-table"
import { SectionCards } from "@/components/web/section-cards"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import * as schema from "@/lib/schema"
import { eq, inArray, and, not, desc } from "drizzle-orm"
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
    where: eq(schema.member.userId, session.user.id),
    columns: { role: true, studioId: true }
  });
  
  const adminRoles = ["owner", "developer", "manager"];
  const hasAdminRole = members.some((m: any) => adminRoles.includes(m.role));
  const isOnlyMinorRole = members.length > 0 && !hasAdminRole;

  if (isOnlyMinorRole) {
    if (members.some((m) => m.role === "receptionist")) {
      redirect("/finances?tab=cashouts");
    }

    const photoVideoRoles = ["photographer", "videographer"];
    const isPhotoVideoRole = members.every((m: any) => photoVideoRoles.includes(m.role));

    if (isPhotoVideoRole) {
      redirect("/my-tasks");
    }

    if (members.length > 0) {
      const primaryStudioId = members[0].studioId;
      const studio = await db.query.studio.findFirst({
        where: eq(schema.studio.id, primaryStudioId)
      });
      if (studio) {
        redirect(`/studios/${studio.slug}`);
      }
    }
    
    redirect("/my-tasks");
  }

  // === ADMIN DATA AGGREGATION ===
  const studioIds = members.filter((m: any) => adminRoles.includes(m.role)).map((m: any) => m.studioId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ninetyDaysAgo = new Date(todayUtc);
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 89);

  // Fetch all bookings for metrics (exclude cancelled ones from positive metrics if desired, but let's include all non-cancelled)
  let allRelevantBookings: any[] = [];
  if (studioIds.length > 0) {
    allRelevantBookings = await db.query.booking.findMany({
      where: and(
        inArray(schema.booking.studioId, studioIds),
        not(eq(schema.booking.bookingStatus, "CANCELLED"))
      ),
      with: { client: true, service: true }
    });
  }

  const recentBookings = allRelevantBookings.filter((b: any) => {
    const bookingTimestamp = new Date(b.bookingDate).getTime();
    return bookingTimestamp >= thirtyDaysAgo.getTime() && bookingTimestamp <= now.getTime();
  });
  const previousBookings = allRelevantBookings.filter((b: any) => {
    const bookingTimestamp = new Date(b.bookingDate).getTime();
    return bookingTimestamp >= sixtyDaysAgo.getTime() && bookingTimestamp < thirtyDaysAgo.getTime();
  });

  const totalRevenueRecent = recentBookings.reduce((sum: any, b: any) => sum + Number(b.totalAmount), 0);
  const totalRevenuePrev = previousBookings.reduce((sum: any, b: any) => sum + Number(b.totalAmount), 0);
  const revenueGrowth = totalRevenuePrev === 0 ? (totalRevenueRecent > 0 ? 100 : 0) : ((totalRevenueRecent - totalRevenuePrev) / totalRevenuePrev) * 100;

  const totalBookingsRecent = recentBookings.length;
  const totalBookingsPrev = previousBookings.length;
  const bookingsGrowth = totalBookingsPrev === 0 ? (totalBookingsRecent > 0 ? 100 : 0) : ((totalBookingsRecent - totalBookingsPrev) / totalBookingsPrev) * 100;

  const clientBookingCounts = new Map<string, number>();
  allRelevantBookings.forEach((booking: any) => {
    clientBookingCounts.set(booking.clientId, (clientBookingCounts.get(booking.clientId) ?? 0) + 1);
  });
  const repeatClientIds = new Set(
    [...clientBookingCounts].filter(([, bookingCount]) => bookingCount > 1).map(([clientId]) => clientId),
  );
  const activeClientsRecent = new Set(
    recentBookings.filter((booking: any) => repeatClientIds.has(booking.clientId)).map((booking: any) => booking.clientId),
  ).size;
  const activeClientsPrev = new Set(
    previousBookings.filter((booking: any) => repeatClientIds.has(booking.clientId)).map((booking: any) => booking.clientId),
  ).size;
  const clientsGrowth = activeClientsPrev === 0 ? (activeClientsRecent > 0 ? 100 : 0) : ((activeClientsRecent - activeClientsPrev) / activeClientsPrev) * 100;

  const completedRecent = recentBookings.filter((b: any) => b.bookingStatus === "COMPLETED").length;
  const completedPrev = previousBookings.filter((b: any) => b.bookingStatus === "COMPLETED").length;
  const completionRateRecent = totalBookingsRecent === 0 ? 0 : (completedRecent / totalBookingsRecent) * 100;
  const completionRatePrev = totalBookingsPrev === 0 ? 0 : (completedPrev / totalBookingsPrev) * 100;
  const completionRateGrowth = completionRateRecent - completionRatePrev;

  const metrics = {
    totalRevenue: allRelevantBookings.reduce((sum: any, b: any) => sum + Number(b.totalAmount), 0),
    revenueGrowth,
    totalBookings: allRelevantBookings.length,
    bookingsGrowth,
    activeClients: repeatClientIds.size,
    clientsGrowth,
    completionRate: allRelevantBookings.length === 0 ? 0 : (allRelevantBookings.filter((b: any) => b.bookingStatus === "COMPLETED").length / allRelevantBookings.length) * 100,
    completionRateGrowth
  };

  // Chart Data (last 90 days aggregated by day)
  const bookingsLast90Days = allRelevantBookings.filter((b: any) => new Date(b.bookingDate) >= ninetyDaysAgo);
  const chartDataMap = new Map<string, number>();
  
  for (let i = 0; i < 90; i++) {
      const d = new Date(todayUtc);
      d.setUTCDate(todayUtc.getUTCDate() - i);
      chartDataMap.set(d.toISOString().split('T')[0], 0);
  }

  bookingsLast90Days.forEach((b: any) => {
      const dateStr = new Date(b.bookingDate).toISOString().split('T')[0];
      if (chartDataMap.has(dateStr)) {
          chartDataMap.set(dateStr, chartDataMap.get(dateStr)! + Number(b.totalAmount));
      }
  });

  const chartData = Array.from(chartDataMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

  // Recent Bookings for Data Table
  let rawRecentBookings: any[] = [];
  if (studioIds.length > 0) {
    rawRecentBookings = await db.query.booking.findMany({
      where: inArray(schema.booking.studioId, studioIds),
      orderBy: [desc(schema.booking.bookingDate)],
      limit: 10,
      with: { client: true, service: true }
    });
  }

  const tableData = rawRecentBookings.map((b: any) => {
      const bookingDate = b.bookingDate ? new Date(b.bookingDate) : null;
      return {
          id: b.id,
          clientName: b.client?.name ?? 'Unknown',
          clientImage: b.client?.image ?? null,
          serviceName: b.service?.name ?? 'Unknown',
          bookingDate: bookingDate && Number.isFinite(bookingDate.getTime()) ? bookingDate.toISOString() : null,
          totalAmount: Number(b.totalAmount),
          bookingStatus: b.bookingStatus
      };
  });

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
