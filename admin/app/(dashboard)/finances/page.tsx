import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
    ArrowDownRight,
    BookOpen,
    Building2,
    CalendarDays,
    Camera,
    CheckCircle2,
    CircleDollarSign,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import {
    differenceInCalendarDays,
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfYear,
    format,
    isValid,
    parseISO,
    startOfDay,
    startOfMonth,
    startOfYear,
    subDays,
    subMonths,
    subYears,
} from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { getRevenueCategory } from "@/lib/finance";
import { formatPrice } from "@/lib/formatters";
import { headers } from "next/headers";
import { CashoutForm } from "./_components/CashoutForm";
import { FinanceTabs } from "./_components/FinanceTabs";
import { ChartAreaInteractive, type ChartDataPoint } from "@/components/web/chart-area-interactive";
import { FinanceDateRangePicker, type DateRangePreset } from "./_components/FinanceDateRangePicker";
import { OverviewStudioSelector } from "@/components/web/overview-studio-selector";

export const metadata: Metadata = {
    title: "Finances",
    description: "Track booking income, revenue trends, and studio expenses.",
};

const REVENUE_CATEGORIES = ["Wedding", "Photography", "Videography", "Others"] as const;
const ACADEMY_REVENUE_CATEGORY = "Academy";

interface PageProps {
    searchParams: Promise<{
        tab?: string;
        range?: string;
        from?: string;
        to?: string;
        studio?: string;
    }>;
}

function sumAmounts<T extends { amount: number }>(items: T[]) {
    return items.reduce((total, item) => total + item.amount, 0);
}

function parseDate(dateVal: string | Date | null | undefined): Date | null {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
        return isNaN(dateVal.getTime()) ? null : dateVal;
    }
    const str = String(dateVal).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    const dIso = new Date(str.replace(" ", "T") + (str.endsWith("Z") ? "" : "Z"));
    if (!isNaN(dIso.getTime())) return dIso;
    return null;
}

function isInRange(dateVal: string | Date | null | undefined, start: Date, end: Date): boolean {
    const d = parseDate(dateVal);
    if (!d) return false;
    const time = d.getTime();
    return time >= start.getTime() && time <= end.getTime();
}

export default async function FinancesPage({ searchParams }: PageProps) {
    const resolvedSearchParams = await searchParams;
    const tab = resolvedSearchParams?.tab;
    const rangeParam = resolvedSearchParams?.range;
    const fromParam = resolvedSearchParams?.from;
    const toParam = resolvedSearchParams?.to;
    const requestedStudio = resolvedSearchParams?.studio;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const [user, memberships] = await Promise.all([
        db.query.user.findFirst({
            where: eq(schema.user.id, session.user.id),
            columns: { role: true },
        }),
        db.query.member.findMany({
            where: eq(schema.member.userId, session.user.id),
            columns: { role: true, studioId: true },
        }),
    ]);

    const isPlatformAdmin = user?.role === "admin";
    const isOwner = memberships.some((m) => m.role === "owner");
    const isDeveloper = memberships.some((m) => m.role === "developer");
    const isGlobalAdmin = isPlatformAdmin || isOwner || isDeveloper;

    const canViewAcademyRevenue = isGlobalAdmin;

    const receptionistStudioIds = [
        ...new Set(
            memberships
                .filter((membership) => membership.role === "receptionist")
                .map((membership) => membership.studioId),
        ),
    ];
    const managerMemberships = memberships.filter((m) => m.role === "manager");
    const isManager = !isGlobalAdmin && managerMemberships.length > 0;

    const managedStudioIds = [
        ...new Set(
            memberships
                .filter((membership) => ["owner", "manager", "developer"].includes(membership.role))
                .map((membership) => membership.studioId),
        ),
    ];
    const isReceptionistOnly = !isPlatformAdmin && managedStudioIds.length === 0 && receptionistStudioIds.length > 0;
    const accessibleStudioIds = isReceptionistOnly ? receptionistStudioIds : managedStudioIds;

    if (!isPlatformAdmin && accessibleStudioIds.length === 0) redirect("/");

    const allAccessibleStudios = await db.query.studio.findMany({
        where: isPlatformAdmin ? undefined : inArray(schema.studio.id, accessibleStudioIds),
        columns: { id: true, name: true, slug: true },
        orderBy: (studio, { asc }) => [asc(studio.name)],
    });

    // Determine studio filtering
    let selectedStudio: { id: string; name: string; slug: string } | null = null;
    let studioIds: string[] = [];

    if (isManager) {
        if (allAccessibleStudios.length > 0) {
            const matched = requestedStudio
                ? allAccessibleStudios.find((s) => s.slug === requestedStudio || s.id === requestedStudio)
                : null;
            selectedStudio = matched || allAccessibleStudios[0];
            studioIds = [selectedStudio.id];
        }
    } else if (isGlobalAdmin) {
        if (requestedStudio && requestedStudio !== "all") {
            const matched = allAccessibleStudios.find((s) => s.slug === requestedStudio || s.id === requestedStudio);
            if (matched) {
                selectedStudio = matched;
                studioIds = [matched.id];
            } else {
                studioIds = allAccessibleStudios.map((s) => s.id);
            }
        } else {
            studioIds = allAccessibleStudios.map((s) => s.id);
        }
    } else {
        studioIds = allAccessibleStudios.map((s) => s.id);
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    if (studioIds.length === 0) {
        return (
            <div className="px-4 py-8 lg:px-6">
                <h1 className="text-2xl font-semibold">Finances</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {isReceptionistOnly
                        ? "No studios are available to record a cashout for."
                        : "No studios are available to report on."}
                </p>
            </div>
        );
    }

    if (isReceptionistOnly) {
        return (
            <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add a cashout</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Record a cashout for your studio.</p>
                </div>
                <div>
                    <CashoutForm
                        studios={allAccessibleStudios.map((s) => ({ id: s.id, name: s.name }))}
                        categories={[]}
                        today={todayStr}
                    />
                </div>
            </main>
        );
    }

    // === DATE RANGE DETERMINATION ===
    const now = new Date();
    let rangePreset: DateRangePreset = "30d";
    let startDate: Date;
    let endDate: Date;
    let rangeLabel: string;
    let comparisonStartDate: Date | null = null;
    let comparisonEndDate: Date | null = null;
    let comparisonLabel: string | null = null;

    if (rangeParam === "7d") {
        rangePreset = "7d";
        startDate = startOfDay(subDays(now, 6));
        endDate = endOfDay(now);
        rangeLabel = "Last 7 days";
        comparisonStartDate = startOfDay(subDays(startDate, 7));
        comparisonEndDate = endOfDay(subDays(startDate, 1));
        comparisonLabel = "previous 7 days";
    } else if (rangeParam === "90d") {
        rangePreset = "90d";
        startDate = startOfDay(subDays(now, 89));
        endDate = endOfDay(now);
        rangeLabel = "Last 90 days";
        comparisonStartDate = startOfDay(subDays(startDate, 90));
        comparisonEndDate = endOfDay(subDays(startDate, 1));
        comparisonLabel = "previous 90 days";
    } else if (rangeParam === "month") {
        rangePreset = "month";
        startDate = startOfMonth(now);
        endDate = endOfDay(now);
        rangeLabel = "This month";
        comparisonStartDate = startOfMonth(subMonths(now, 1));
        comparisonEndDate = endOfMonth(subMonths(now, 1));
        comparisonLabel = "last month";
    } else if (rangeParam === "year") {
        rangePreset = "year";
        startDate = startOfYear(now);
        endDate = endOfDay(now);
        rangeLabel = "This year";
        comparisonStartDate = startOfYear(subYears(now, 1));
        comparisonEndDate = endOfYear(subYears(now, 1));
        comparisonLabel = "last year";
    } else if (rangeParam === "all") {
        rangePreset = "all";
        startDate = new Date(2020, 0, 1);
        endDate = endOfDay(now);
        rangeLabel = "All time";
        comparisonStartDate = null;
        comparisonEndDate = null;
        comparisonLabel = null;
    } else if (rangeParam === "custom" || fromParam) {
        rangePreset = "custom";
        const parsedFrom = fromParam ? parseISO(fromParam) : null;
        const parsedTo = toParam ? parseISO(toParam) : parsedFrom;

        if (parsedFrom && isValid(parsedFrom)) {
            startDate = startOfDay(parsedFrom);
            endDate = parsedTo && isValid(parsedTo) ? endOfDay(parsedTo) : endOfDay(parsedFrom);
            if (startDate.getTime() > endDate.getTime()) {
                const temp = startDate;
                startDate = startOfDay(endDate);
                endDate = endOfDay(temp);
            }
            if (format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")) {
                rangeLabel = format(startDate, "MMM d, yyyy");
            } else {
                rangeLabel = `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;
            }
            const diffDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
            comparisonStartDate = startOfDay(subDays(startDate, diffDays));
            comparisonEndDate = endOfDay(subDays(startDate, 1));
            comparisonLabel = `previous ${diffDays} days`;
        } else {
            rangePreset = "30d";
            startDate = startOfDay(subDays(now, 29));
            endDate = endOfDay(now);
            rangeLabel = "Last 30 days";
            comparisonStartDate = startOfDay(subDays(startDate, 30));
            comparisonEndDate = endOfDay(subDays(startDate, 1));
            comparisonLabel = "previous 30 days";
        }
    } else {
        // Default: 30 days
        rangePreset = "30d";
        startDate = startOfDay(subDays(now, 29));
        endDate = endOfDay(now);
        rangeLabel = "Last 30 days";
        comparisonStartDate = startOfDay(subDays(startDate, 30));
        comparisonEndDate = endOfDay(subDays(startDate, 1));
        comparisonLabel = "previous 30 days";
    }

    // === FETCH FINANCIAL DATA ===
    const [bookings, cashouts, academyStudents] = await Promise.all([
        db.query.booking.findMany({
            where: inArray(schema.booking.studioId, studioIds),
            with: {
                service: { columns: { name: true, category: true } },
                client: { columns: { name: true } },
                studio: { columns: { name: true } },
                payments: {
                    columns: {
                        id: true,
                        receiptNumber: true,
                        method: true,
                        amount: true,
                        status: true,
                        paymentDate: true,
                    },
                },
            },
        }),
        db
            .select({
                id: schema.cashout.id,
                studioId: schema.cashout.studioId,
                description: schema.cashout.description,
                category: schema.cashout.category,
                amount: schema.cashout.amount,
                expenseDate: schema.cashout.expenseDate,
                notes: schema.cashout.notes,
            })
            .from(schema.cashout)
            .where(inArray(schema.cashout.studioId, studioIds))
            .orderBy(desc(schema.cashout.expenseDate)),
        canViewAcademyRevenue
            ? db.query.academyStudent.findMany({
                  where: eq(schema.academyStudent.paymentStatus, "SUCCESS"),
                  columns: { amountPaid: true, updatedAt: true },
              })
            : Promise.resolve([]),
    ]);

    // Format expenses
    const expenses = cashouts.map((cashout) => ({
        ...cashout,
        amount: Number(cashout.amount || 0),
        date: parseDate(cashout.expenseDate) ?? new Date(cashout.expenseDate),
    }));

    // Non-cancelled bookings
    const validBookings = bookings.filter((b) => b.bookingStatus !== "CANCELLED");

    // All-time income items
    const allIncome = validBookings.map((b) => ({
        amount: Number(b.totalAmount || 0),
        date: parseDate(b.bookingDate) ?? new Date(b.bookingDate),
        studioId: b.studioId,
        category: getRevenueCategory(b.service?.name ?? "", b.service?.category ?? "OTHERS"),
    }));

    const isAllStudios = selectedStudio === null;
    const showAcademyRevenue = canViewAcademyRevenue && isAllStudios;

    const allAcademyIncome = academyStudents.map((student) => ({
        amount: Number(student.amountPaid || 0),
        date: parseDate(student.updatedAt) ?? new Date(student.updatedAt),
        category: ACADEMY_REVENUE_CATEGORY,
    }));
    const activeAcademyIncome = showAcademyRevenue ? allAcademyIncome : [];

    // All-time totals
    const totalRevenueAllTime = sumAmounts(allIncome) + sumAmounts(activeAcademyIncome);
    const totalExpensesAllTime = sumAmounts(expenses);
    const netAllTime = totalRevenueAllTime - totalExpensesAllTime;

    // === FILTERED RANGE CALCULATIONS ===
    const isAllTime = rangePreset === "all";
    const rangeIncome = isAllTime ? allIncome : allIncome.filter((entry) => isInRange(entry.date, startDate, endDate));
    const rangeAcademyIncome = isAllTime ? activeAcademyIncome : activeAcademyIncome.filter((entry) => isInRange(entry.date, startDate, endDate));
    const rangeRevenue = isAllTime ? totalRevenueAllTime : sumAmounts(rangeIncome) + sumAmounts(rangeAcademyIncome);

    const rangeExpensesList = isAllTime ? expenses : expenses.filter((entry) => isInRange(entry.date, startDate, endDate));
    const rangeExpenses = isAllTime ? totalExpensesAllTime : sumAmounts(rangeExpensesList);
    const rangeNet = isAllTime ? netAllTime : rangeRevenue - rangeExpenses;

    // Comparison period calculation for growth trend
    let revenueGrowth: number | null = null;
    let growthDetail = isAllTime ? "all time total" : `${rangeLabel.toLowerCase()} total`;
    if (!isAllTime && comparisonStartDate && comparisonEndDate) {
        const prevIncome = allIncome.filter((entry) => isInRange(entry.date, comparisonStartDate!, comparisonEndDate!));
        const prevAcademy = activeAcademyIncome.filter((entry) => isInRange(entry.date, comparisonStartDate!, comparisonEndDate!));
        const prevRevenue = sumAmounts(prevIncome) + sumAmounts(prevAcademy);

        if (prevRevenue > 0) {
            revenueGrowth = ((rangeRevenue - prevRevenue) / prevRevenue) * 100;
            const sign = revenueGrowth >= 0 ? "+" : "";
            growthDetail = `${sign}${revenueGrowth.toFixed(1)}% vs ${comparisonLabel}`;
        } else if (rangeRevenue > 0) {
            revenueGrowth = 100;
            growthDetail = `+100% vs ${comparisonLabel}`;
        } else {
            revenueGrowth = 0;
            growthDetail = `0% vs ${comparisonLabel}`;
        }
    }

    // Payment transactions
    const paymentTransactions = bookings
        .flatMap((booking) =>
            booking.payments.map((payment) => ({
                id: payment.id,
                receiptNumber: payment.receiptNumber,
                paymentDate: payment.paymentDate,
                clientName: booking.client?.name ?? "N/A",
                studioName: booking.studio?.name ?? "N/A",
                serviceName: booking.service?.name ?? "N/A",
                method: payment.method,
                status: payment.status,
                amount: Number(payment.amount || 0),
            })),
        )
        .sort((a, b) => {
            const timeA = parseDate(a.paymentDate)?.getTime() ?? 0;
            const timeB = parseDate(b.paymentDate)?.getTime() ?? 0;
            return timeB - timeA;
        });

    const allCollected =
        sumAmounts(paymentTransactions.filter((p) => p.status === "PAID" || p.status === "PARTIALLY_PAID")) +
        sumAmounts(activeAcademyIncome);

    const rangePayments = isAllTime
        ? paymentTransactions
        : paymentTransactions.filter((p) => isInRange(p.paymentDate, startDate, endDate));
    const rangeCollected = isAllTime
        ? allCollected
        : sumAmounts(rangePayments.filter((p) => p.status === "PAID" || p.status === "PARTIALLY_PAID")) +
          sumAmounts(rangeAcademyIncome);

    // Transaction stats for the range
    const rangePaidCount = rangePayments.filter((p) => p.status === "PAID").length;
    const rangePendingCount = rangePayments.filter((p) => p.status === "PENDING").length;
    const rangePartiallyPaidCount = rangePayments.filter((p) => p.status === "PARTIALLY_PAID").length;
    const rangeCancelledCount = rangePayments.filter((p) => p.status === "CANCELLED").length;

    // === BUILD DAILY CHART DATA FOR RANGE ===
    const chartDataMap = new Map<string, number>();

    if (isAllTime) {
        let earliestDate = now;
        rangeIncome.forEach((item) => {
            if (item.date.getTime() < earliestDate.getTime()) {
                earliestDate = item.date;
            }
        });
        rangeAcademyIncome.forEach((item) => {
            if (item.date.getTime() < earliestDate.getTime()) {
                earliestDate = item.date;
            }
        });
        const chartStart = startOfDay(earliestDate);
        const intervalDays = eachDayOfInterval({ start: chartStart, end: endDate });
        intervalDays.forEach((d) => {
            chartDataMap.set(format(d, "yyyy-MM-dd"), 0);
        });
    } else {
        const diffDays = differenceInCalendarDays(endDate, startDate);
        if (diffDays <= 365) {
            const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
            intervalDays.forEach((d) => {
                chartDataMap.set(format(d, "yyyy-MM-dd"), 0);
            });
        } else {
            const intervalDays = eachDayOfInterval({ start: subDays(endDate, 365), end: endDate });
            intervalDays.forEach((d) => {
                chartDataMap.set(format(d, "yyyy-MM-dd"), 0);
            });
        }
    }

    rangeIncome.forEach((item) => {
        const key = format(item.date, "yyyy-MM-dd");
        if (chartDataMap.has(key)) {
            chartDataMap.set(key, chartDataMap.get(key)! + item.amount);
        }
    });

    rangeAcademyIncome.forEach((item) => {
        const key = format(item.date, "yyyy-MM-dd");
        if (chartDataMap.has(key)) {
            chartDataMap.set(key, chartDataMap.get(key)! + item.amount);
        }
    });

    const chartData: ChartDataPoint[] = Array.from(chartDataMap.entries())
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Revenue by source for range
    const incomeByCategory = [
        ...REVENUE_CATEGORIES.map((category) => ({
            category,
            amount: sumAmounts(rangeIncome.filter((entry) => entry.category === category)),
        })),
        ...(showAcademyRevenue
            ? [
                  {
                      category: `${ACADEMY_REVENUE_CATEGORY} (All Studios)`,
                      amount: sumAmounts(rangeAcademyIncome),
                  },
              ]
            : []),
    ];
    const highestCategoryIncome = Math.max(...incomeByCategory.map((entry) => entry.amount), 1);

    // Studio performance breakdown
    const incomeByStudio = allAccessibleStudios
        .filter((s) => studioIds.includes(s.id))
        .map((studio) => {
            const studioLifetimeIncome = allIncome.filter((entry) => entry.studioId === studio.id);
            const studioRangeIncome = rangeIncome.filter((entry) => entry.studioId === studio.id);
            const studioRangeExpenses = rangeExpensesList.filter((entry) => entry.studioId === studio.id);
            const studioLifetimeExpenses = expenses.filter((entry) => entry.studioId === studio.id);

            const rangeRevenueStudio = sumAmounts(studioRangeIncome);
            const rangeExpensesStudio = sumAmounts(studioRangeExpenses);
            return {
                id: studio.id,
                name: studio.name,
                rangeRevenue: rangeRevenueStudio,
                rangeExpenses: rangeExpensesStudio,
                rangeNet: rangeRevenueStudio - rangeExpensesStudio,
                lifetime: sumAmounts(studioLifetimeIncome),
                lifetimeExpenses: sumAmounts(studioLifetimeExpenses),
            };
        });

    // Expense by category for range
    const expenseByCategory = [...new Set(rangeExpensesList.map((expense) => expense.category))]
        .map((category) => ({
            category,
            amount: sumAmounts(rangeExpensesList.filter((expense) => expense.category === category)),
        }))
        .sort((a, b) => b.amount - a.amount);

    const studioNameById = new Map(allAccessibleStudios.map((studio) => [studio.id, studio.name]));
    const studioDisplayName = selectedStudio ? selectedStudio.name : "All Studios";

    return (
        <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
            {/* Header & Controls */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Finances</h1>
                            <Badge variant="outline" className="px-2 py-0.5 text-xs font-semibold">
                                {studioDisplayName}
                            </Badge>
                        </div>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            {selectedStudio
                                ? `Financial tracking and revenue trend for ${selectedStudio.name}.`
                                : "Financial tracking and revenue trend across all studios."}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {allAccessibleStudios.length > 1 && (
                            <OverviewStudioSelector
                                studios={allAccessibleStudios}
                                selectedStudioSlug={selectedStudio?.slug ?? null}
                                showAllOption={isGlobalAdmin}
                                isManager={isManager}
                            />
                        )}
                        <FinanceDateRangePicker
                            currentRange={rangePreset}
                            startDateStr={format(startDate, "yyyy-MM-dd")}
                            endDateStr={format(endDate, "yyyy-MM-dd")}
                            rangeLabel={rangeLabel}
                        />
                    </div>
                </div>
            </div>

            <FinanceTabs
                defaultTab={tab === "transactions" || tab === "cashouts" ? tab : "overview"}
                overview={
                    <div className="flex flex-col gap-6">
                        {/* Selected Period Metrics & All-time reference */}
                        <section
                            aria-label="Income and expenses"
                            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
                        >
                            <MetricCard
                                title={`Revenue · ${rangeLabel}`}
                                value={rangeRevenue}
                                detail={growthDetail}
                                icon={
                                    revenueGrowth !== null && revenueGrowth < 0 ? (
                                        <TrendingDown className="size-4 text-destructive" />
                                    ) : (
                                        <TrendingUp className="size-4 text-primary" />
                                    )
                                }
                            />
                            <MetricCard
                                title={`Collected · ${rangeLabel}`}
                                value={rangeCollected}
                                detail={
                                    showAcademyRevenue
                                        ? "Booking payments and paid Academy in period"
                                        : "Booking payments collected in period"
                                }
                                icon={<CheckCircle2 className="size-4" />}
                            />
                            <MetricCard
                                title={`Cashouts · ${rangeLabel}`}
                                value={rangeExpenses}
                                detail={`${rangeExpensesList.length} expenses recorded in period`}
                                icon={<ArrowDownRight className="size-4" />}
                                negative
                            />
                            <Card className="border-primary/20 bg-primary/[0.04]">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Net profit · {rangeLabel}
                                    </CardTitle>
                                    <Wallet className="size-4 text-primary" />
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className={`text-xl font-semibold tracking-tight ${rangeNet < 0 ? "text-destructive" : ""}`}
                                    >
                                        {formatPrice(rangeNet)}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Revenue minus recorded cashouts
                                    </p>
                                </CardContent>
                            </Card>
                            <MetricCard
                                title="Total revenue · all time"
                                value={totalRevenueAllTime}
                                detail={
                                    showAcademyRevenue
                                        ? "Bookings and paid Academy (all time)"
                                        : selectedStudio
                                          ? `All-time bookings for ${selectedStudio.name}`
                                          : "Bookings all time (Academy is owner-only)"
                                }
                                icon={<CircleDollarSign className="size-4" />}
                            />
                            <Card>
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Net after cashouts · all time
                                    </CardTitle>
                                    <Wallet className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className={`text-xl font-semibold tracking-tight ${netAllTime < 0 ? "text-destructive" : ""}`}
                                    >
                                        {formatPrice(netAllTime)}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        All-time revenue minus all cashouts
                                    </p>
                                </CardContent>
                            </Card>
                        </section>

                        {/* Revenue Trend Chart */}
                        <ChartAreaInteractive
                            data={chartData}
                            title={`Revenue Trend · ${rangeLabel}`}
                            description={`Daily revenue breakdown for ${rangeLabel}`}
                            totalAmount={rangeRevenue}
                        />

                        {/* Revenue by source */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Camera className="size-4 text-primary" />
                                    Revenue by source · {rangeLabel}
                                </CardTitle>
                                <CardDescription>
                                    {showAcademyRevenue
                                        ? `${formatPrice(rangeRevenue)} in ${rangeLabel.toLowerCase()} from bookings and paid Academy registrations (all studios).`
                                        : selectedStudio
                                          ? `${formatPrice(rangeRevenue)} in ${rangeLabel.toLowerCase()} from bookings for ${selectedStudio.name}.`
                                          : `${formatPrice(rangeRevenue)} in ${rangeLabel.toLowerCase()} from bookings. Academy revenue is visible to owners and developers.`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {incomeByCategory.map(({ category, amount }) => (
                                    <div key={category} className="space-y-2">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="flex items-center gap-2 font-medium">
                                                {category.startsWith(ACADEMY_REVENUE_CATEGORY) && (
                                                    <BookOpen className="size-3.5 text-primary" />
                                                )}
                                                {category}
                                            </span>
                                            <span className="tabular-nums text-muted-foreground">
                                                {formatPrice(amount)}
                                                {rangeRevenue > 0 && (
                                                    <span className="ml-2 text-xs text-muted-foreground/80">
                                                        ({((amount / rangeRevenue) * 100).toFixed(0)}%)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{
                                                    width: `${Math.min(100, (amount / highestCategoryIncome) * 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Studio performance */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="size-4 text-primary" />
                                    Studio performance
                                </CardTitle>
                                <CardDescription>
                                    Booked revenue, cashouts, and net profit for each studio during {rangeLabel}.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Studio</TableHead>
                                                <TableHead className="text-right">Revenue ({rangeLabel})</TableHead>
                                                <TableHead className="text-right">Cashouts ({rangeLabel})</TableHead>
                                                <TableHead className="text-right">Net ({rangeLabel})</TableHead>
                                                <TableHead className="text-right">All time</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {incomeByStudio.map((studio) => (
                                                <TableRow key={studio.id}>
                                                    <TableCell className="min-w-32 font-medium">
                                                        {studio.name}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                                                        {formatPrice(studio.rangeRevenue)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {formatPrice(studio.rangeExpenses)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-medium tabular-nums ${studio.rangeNet < 0 ? "text-destructive" : ""}`}
                                                    >
                                                        {formatPrice(studio.rangeNet)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {formatPrice(studio.lifetime)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {incomeByStudio.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                                                        No studios to report.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                }
                transactions={
                    <Card>
                        <CardHeader>
                            <CardTitle>Booking transactions · {rangeLabel}</CardTitle>
                            <CardDescription>
                                Showing transactions for {rangeLabel}. Collected in period:{" "}
                                <span className="font-semibold text-primary">{formatPrice(rangeCollected)}</span>
                                {rangePreset !== "all" && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        (All-time collected: {formatPrice(allCollected)})
                                    </span>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <TransactionCount
                                    label="Paid"
                                    count={rangePaidCount}
                                    icon={<CheckCircle2 className="size-4 text-green-500" />}
                                />
                                <TransactionCount
                                    label="Pending"
                                    count={rangePendingCount}
                                    icon={<CalendarDays className="size-4 text-orange-500" />}
                                />
                                <TransactionCount
                                    label="Partially paid"
                                    count={rangePartiallyPaidCount}
                                    icon={<CircleDollarSign className="size-4 text-blue-500" />}
                                />
                                <TransactionCount
                                    label="Cancelled"
                                    count={rangeCancelledCount}
                                    icon={<ArrowDownRight className="size-4 text-destructive" />}
                                />
                            </div>
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Receipt No.</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Studio</TableHead>
                                            <TableHead>Service</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rangePayments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                    No transactions found for {rangeLabel}.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            rangePayments.map((payment) => (
                                                <TableRow key={payment.id}>
                                                    <TableCell className="font-mono text-xs">
                                                        {payment.receiptNumber}
                                                    </TableCell>
                                                    <TableCell>
                                                        {format(
                                                            parseDate(payment.paymentDate) ?? new Date(payment.paymentDate),
                                                            "MMM do, yyyy",
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{payment.clientName}</TableCell>
                                                    <TableCell>{payment.studioName}</TableCell>
                                                    <TableCell
                                                        className="max-w-[150px] truncate"
                                                        title={payment.serviceName}
                                                    >
                                                        {payment.serviceName}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{payment.method}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                payment.status === "PAID"
                                                                    ? "default"
                                                                    : payment.status === "CANCELLED"
                                                                      ? "destructive"
                                                                      : "secondary"
                                                            }
                                                        >
                                                            {payment.status.replace(/_/g, " ")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-primary">
                                                        {formatPrice(payment.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                }
                cashouts={
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title={`Cashouts · ${rangeLabel}`}
                                value={rangeExpenses}
                                detail={`${rangeExpensesList.length} expenses recorded in period`}
                                icon={<Wallet className="size-4" />}
                                negative
                            />
                            <MetricCard
                                title="Cashouts · all time"
                                value={totalExpensesAllTime}
                                detail={`${expenses.length} total recorded expenses`}
                                icon={<ArrowDownRight className="size-4" />}
                                negative
                            />
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Top category ({rangeLabel})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="truncate text-xl font-semibold">
                                        {expenseByCategory[0]?.category ?? "—"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {expenseByCategory[0]
                                            ? formatPrice(expenseByCategory[0].amount)
                                            : "No expenses recorded"}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Net after cashouts
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p
                                        className={`truncate text-xl font-semibold ${rangeNet < 0 ? "text-destructive" : ""}`}
                                    >
                                        {formatPrice(rangeNet)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Net for {rangeLabel}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                        <Card>
                            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>Cashout history · {rangeLabel}</CardTitle>
                                    <CardDescription>
                                        Review and edit expenses for your studios. Showing {rangeExpensesList.length} expenses in {rangeLabel}.
                                    </CardDescription>
                                </div>
                                <CashoutForm
                                    studios={allAccessibleStudios.map((s) => ({ id: s.id, name: s.name }))}
                                    categories={expenseByCategory.map(({ category }) => category)}
                                    today={todayStr}
                                />
                            </CardHeader>
                            <CardContent>
                                {expenseByCategory.length > 0 && (
                                    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {expenseByCategory.map(({ category, amount }) => (
                                            <div key={category} className="rounded-2xl border bg-muted/20 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-xs font-medium text-muted-foreground">
                                                        {category}
                                                    </span>
                                                    <span className="text-xs font-semibold tabular-nums">
                                                        {formatPrice(amount)}
                                                    </span>
                                                </div>
                                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-destructive/70"
                                                        style={{
                                                            width: `${Math.min(
                                                                100,
                                                                (amount / Math.max(expenseByCategory[0].amount, 1)) * 100,
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Studio</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="w-16 text-right">Edit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rangeExpensesList.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-28 text-center">
                                                        <Wallet className="mx-auto size-5 text-muted-foreground" />
                                                        <p className="mt-2 text-sm font-medium">No cashouts in {rangeLabel}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Add an expense or select a different date range.
                                                        </p>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                rangeExpensesList.map((cashout) => (
                                                    <TableRow key={cashout.id}>
                                                        <TableCell className="whitespace-nowrap">
                                                            {format(cashout.date, "MMM do, yyyy")}
                                                        </TableCell>
                                                        <TableCell className="min-w-40">
                                                            <p className="font-medium">{cashout.description}</p>
                                                            {cashout.notes && (
                                                                <p className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground">
                                                                    {cashout.notes}
                                                                </p>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{cashout.category}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {studioNameById.get(cashout.studioId) ?? "Studio"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold tabular-nums text-destructive">
                                                            −{formatPrice(cashout.amount)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <CashoutForm
                                                                key={cashout.id}
                                                                cashout={{
                                                                    ...cashout,
                                                                    expenseDate: cashout.expenseDate,
                                                                }}
                                                                studios={allAccessibleStudios.map((s) => ({
                                                                    id: s.id,
                                                                    name: s.name,
                                                                }))}
                                                                categories={expenseByCategory.map(({ category }) => category)}
                                                                today={todayStr}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                }
            />
        </main>
    );
}

function TransactionCount({ label, count, icon }: { label: string; count: number; icon: React.ReactNode }) {
    return (
        <div className="rounded-2xl border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {icon}
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums">{count}</p>
        </div>
    );
}

function MetricCard({
    title,
    value,
    detail,
    icon,
    negative = false,
}: {
    title: string;
    value: number;
    detail: string;
    icon: React.ReactNode;
    negative?: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <span className={negative ? "text-destructive" : "text-primary"}>{icon}</span>
            </CardHeader>
            <CardContent>
                <div className={`text-xl font-semibold tracking-tight ${negative ? "text-destructive" : ""}`}>
                    {formatPrice(value)}
                </div>
                <CardDescription className="mt-1 text-xs">{detail}</CardDescription>
            </CardContent>
        </Card>
    );
}
