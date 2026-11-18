import type { Metadata } from "next";
import { DataTable } from "@/components/web/data-table"
import { SectionCards } from "@/components/web/section-cards"
import { OverviewDatePicker } from "@/components/web/overview-date-picker"
import { OverviewStudioSelector } from "@/components/web/overview-studio-selector"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import * as schema from "@/lib/schema"
import { eq, inArray, and, not, desc, gte, lte } from "drizzle-orm"
import { redirect } from "next/navigation";
import { format, parseISO, startOfDay, endOfDay, subDays, isValid, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { PictureSnapshotTable } from "@/components/web/PictureSnapshotTable";
import { getPictureSnapshots } from "@/lib/actions/picture-snapshots";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "View your studio analytics, performance metrics, and recent activity at a glance.",
};

interface PageProps {
  searchParams?: Promise<{
    date?: string;
    studio?: string;
  }>;
}

function parseBookingDate(dateVal: string | Date | null | undefined): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }
  const str = String(dateVal).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  const dIso = new Date(str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z'));
  if (!isNaN(dIso.getTime())) return dIso;
  return null;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/auth/login");
  }

  const [user, members] = await Promise.all([
    db.query.user.findFirst({
      where: eq(schema.user.id, session.user.id),
      columns: { role: true },
    }),
    db.query.member.findMany({
      where: eq(schema.member.userId, session.user.id),
      columns: { role: true, studioId: true }
    }),
  ]);
  
  const isPlatformAdmin = user?.role === "admin";
  const isOwner = members.some((m) => m.role === "owner");
  const isDeveloper = members.some((m) => m.role === "developer");
  const isGlobalAdmin = isPlatformAdmin || isOwner || isDeveloper;

  const managerMemberships = members.filter((m) => m.role === "manager");
  const isManager = !isGlobalAdmin && managerMemberships.length > 0;

  const hasManagementRole = isGlobalAdmin || isManager;
  const isOnlyMinorRole = !hasManagementRole && members.length > 0;

  if (isOnlyMinorRole) {
    if (members.some((m) => m.role === "receptionist")) {
      redirect("/finances?tab=cashouts");
    }

    const photoVideoRoles = ["photographer", "videographer"];
    const isPhotoVideoRole = members.every((m) => photoVideoRoles.includes(m.role));

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

  // === STUDIO ACCESS DETERMINATION ===
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedStudio = resolvedSearchParams?.studio;
  const dateParam = resolvedSearchParams?.date;

  let accessibleStudios: { id: string; name: string; slug: string }[] = [];

  if (isPlatformAdmin) {
    accessibleStudios = await db.query.studio.findMany({
      columns: { id: true, name: true, slug: true },
      orderBy: (s, { asc }) => [asc(s.name)]
    });
  } else if (isOwner || isDeveloper) {
    const ownerDeveloperManagerStudioIds = members
      .filter((m) => ["owner", "developer", "manager"].includes(m.role))
      .map((m) => m.studioId);
    if (ownerDeveloperManagerStudioIds.length > 0) {
      accessibleStudios = await db.query.studio.findMany({
        where: inArray(schema.studio.id, ownerDeveloperManagerStudioIds),
        columns: { id: true, name: true, slug: true },
        orderBy: (s, { asc }) => [asc(s.name)]
      });
    }
  } else if (isManager) {
    const managerStudioIds = managerMemberships.map((m) => m.studioId);
    if (managerStudioIds.length > 0) {
      accessibleStudios = await db.query.studio.findMany({
        where: inArray(schema.studio.id, managerStudioIds),
        columns: { id: true, name: true, slug: true },
        orderBy: (s, { asc }) => [asc(s.name)]
      });
    }
  }

  // For a manager: ALWAYS restrict to the studio they manage.
  // If multiple managed studios exist, let them toggle between them (defaulting to the first).
  // If global admin, default to all accessible studios unless a specific studio is chosen.
  let selectedStudio: { id: string; name: string; slug: string } | null = null;
  let studioIds: string[] = [];

  if (isManager) {
    if (accessibleStudios.length > 0) {
      const matched = requestedStudio && requestedStudio !== "all"
        ? accessibleStudios.find((s) => s.slug === requestedStudio || s.id === requestedStudio)
        : null;
      selectedStudio = matched || accessibleStudios[0];
      studioIds = [selectedStudio.id];
    }
  } else if (isGlobalAdmin) {
    if (requestedStudio && requestedStudio !== "all") {
      const matched = accessibleStudios.find((s) => s.slug === requestedStudio || s.id === requestedStudio);
      if (matched) {
        selectedStudio = matched;
        studioIds = [matched.id];
      } else {
        studioIds = accessibleStudios.map((s) => s.id);
      }
    } else {
      studioIds = accessibleStudios.map((s) => s.id);
    }
  }

  // If no studios accessible
  if (studioIds.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-8 px-4 lg:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          No studio assigned. Please contact your studio administrator to assign you to a studio.
        </p>
      </div>
    );
  }

  // Parse target date (defaults to today)
  const now = new Date();
  let targetDate = now;
  if (dateParam) {
    const parsed = parseISO(dateParam);
    if (isValid(parsed)) {
      targetDate = parsed;
    }
  }

  const isTodaySelected = isToday(targetDate);
  const targetDateStr = format(targetDate, "yyyy-MM-dd");
  const prevDate = subDays(targetDate, 1);
  const comparisonLabel = isTodaySelected ? "yesterday" : `previous day (${format(prevDate, "MMM d")})`;

  const targetDayStart = startOfDay(targetDate).getTime();
  const targetDayEnd = endOfDay(targetDate).getTime();
  const prevDayStart = startOfDay(prevDate).getTime();
  const prevDayEnd = endOfDay(prevDate).getTime();

  const prevDayStartDate = startOfDay(prevDate);
  const targetDayEndDate = endOfDay(targetDate);

  // Fetch bookings constrained to target and previous day, parallelized with recent bookings and picture snapshots
  const [allRelevantBookings, rawRecentBookings, pictureSnapshots] = await Promise.all([
    db.query.booking.findMany({
      where: and(
        inArray(schema.booking.studioId, studioIds),
        not(eq(schema.booking.bookingStatus, "CANCELLED")),
        gte(schema.booking.bookingDate, prevDayStartDate.toISOString()),
        lte(schema.booking.bookingDate, targetDayEndDate.toISOString())
      ),
      columns: {
        id: true,
        bookingDate: true,
        totalAmount: true,
        bookingStatus: true,
        clientId: true,
        extraPicturesCount: true,
      },
    }),
    db.query.booking.findMany({
      where: inArray(schema.booking.studioId, studioIds),
      orderBy: [desc(schema.booking.bookingDate)],
      limit: 10,
      with: { client: true, service: true }
    }),
    getPictureSnapshots(studioIds, { limit: 15 }),
  ]);

  // Filter bookings for target day and previous day
  const targetDayBookings = allRelevantBookings.filter((b) => {
    const d = parseBookingDate(b.bookingDate);
    if (!d) return false;
    const time = d.getTime();
    return time >= targetDayStart && time <= targetDayEnd;
  });

  const prevDayBookings = allRelevantBookings.filter((b) => {
    const d = parseBookingDate(b.bookingDate);
    if (!d) return false;
    const time = d.getTime();
    return time >= prevDayStart && time <= prevDayEnd;
  });

  // Calculate daily metrics
  const totalRevenueTarget = targetDayBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  const totalRevenuePrev = prevDayBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  const revenueGrowth = totalRevenuePrev === 0 
    ? (totalRevenueTarget > 0 ? 100 : 0) 
    : ((totalRevenueTarget - totalRevenuePrev) / totalRevenuePrev) * 100;

  const totalBookingsTarget = targetDayBookings.length;
  const totalBookingsPrev = prevDayBookings.length;
  const bookingsGrowth = totalBookingsPrev === 0 
    ? (totalBookingsTarget > 0 ? 100 : 0) 
    : ((totalBookingsTarget - totalBookingsPrev) / totalBookingsPrev) * 100;

  const activeClientsTarget = new Set(targetDayBookings.map((b) => b.clientId).filter(Boolean)).size;
  const activeClientsPrev = new Set(prevDayBookings.map((b) => b.clientId).filter(Boolean)).size;
  const clientsGrowth = activeClientsPrev === 0 
    ? (activeClientsTarget > 0 ? 100 : 0) 
    : ((activeClientsTarget - activeClientsPrev) / activeClientsPrev) * 100;

  const completedTarget = targetDayBookings.filter((b) => b.bookingStatus === "COMPLETED").length;
  const completedPrev = prevDayBookings.filter((b) => b.bookingStatus === "COMPLETED").length;
  const completionRateTarget = totalBookingsTarget === 0 ? 0 : (completedTarget / totalBookingsTarget) * 100;
  const completionRatePrev = totalBookingsPrev === 0 ? 0 : (completedPrev / totalBookingsPrev) * 100;
  const completionRateGrowth = completionRateTarget - completionRatePrev;

  // Pictures snapped calculation
  const picturesTarget = targetDayBookings.reduce((sum, b) => sum + (b.extraPicturesCount || 0), 0);
  const picturesPrev = prevDayBookings.reduce((sum, b) => sum + (b.extraPicturesCount || 0), 0);
  const picturesGrowth = picturesPrev === 0
    ? (picturesTarget > 0 ? 100 : 0)
    : ((picturesTarget - picturesPrev) / picturesPrev) * 100;

  const metrics = {
    totalRevenue: totalRevenueTarget,
    revenueGrowth,
    totalBookings: totalBookingsTarget,
    bookingsGrowth,
    activeClients: activeClientsTarget,
    clientsGrowth,
    completionRate: completionRateTarget,
    completionRateGrowth,
    todayPictures: picturesTarget,
    totalPictures: pictureSnapshots[0]?.cumulativePictures ?? 0,
    picturesGrowth,
  };

  const tableData = rawRecentBookings.map((b) => {
    const bookingDate = parseBookingDate(b.bookingDate);
    return {
      id: b.id,
      clientName: b.client?.name ?? 'Unknown',
      clientImage: b.client?.image ?? null,
      serviceName: b.service?.name ?? 'Unknown',
      bookingDate: bookingDate && Number.isFinite(bookingDate.getTime()) ? bookingDate.toISOString() : null,
      totalAmount: Number(b.totalAmount || 0),
      bookingStatus: b.bookingStatus
    };
  });

  const studioDisplayName = selectedStudio ? selectedStudio.name : "All Studios";

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 lg:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <Badge variant="outline" className="px-2 py-0.5 text-xs font-semibold">
              {studioDisplayName}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedStudio
              ? isTodaySelected 
                ? `Daily performance metrics and studio activity for ${selectedStudio.name} for today, ${format(targetDate, "EEEE, MMMM do, yyyy")}.`
                : `Performance metrics and studio activity for ${selectedStudio.name} for ${format(targetDate, "EEEE, MMMM do, yyyy")}.`
              : isTodaySelected
                ? `Daily performance metrics and studio activity across all studios for today, ${format(targetDate, "EEEE, MMMM do, yyyy")}.`
                : `Performance metrics and studio activity across all studios for ${format(targetDate, "EEEE, MMMM do, yyyy")}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accessibleStudios.length > 1 && (
            <OverviewStudioSelector
              studios={accessibleStudios}
              selectedStudioSlug={selectedStudio?.slug ?? null}
              showAllOption={isGlobalAdmin}
              isManager={isManager}
            />
          )}
          <OverviewDatePicker 
            selectedDateString={targetDateStr}
            todayDateString={format(now, "yyyy-MM-dd")}
            currentStudioSlug={selectedStudio?.slug ?? (isGlobalAdmin ? "all" : undefined)}
          />
        </div>
      </div>

      <SectionCards 
        metrics={metrics} 
        isToday={isTodaySelected} 
        comparisonLabel={comparisonLabel} 
      />

      <DataTable data={tableData} />

      <div className="px-4 lg:px-6">
        <PictureSnapshotTable
          snapshots={pictureSnapshots}
          title={`Pictures Snapped · ${studioDisplayName}`}
          description={`Daily breakdown of pictures snapped and cumulative running total to date across ${studioDisplayName}.`}
          allTimeTotal={pictureSnapshots[0]?.cumulativePictures ?? 0}
          maxRows={15}
        />
      </div>
    </div>
  )
}
