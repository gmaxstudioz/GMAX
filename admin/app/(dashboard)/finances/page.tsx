import type { Metadata } from "next";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Building2, CalendarDays, Camera, CircleDollarSign, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as schema from "@/lib/schema";
import { getRevenueCategory } from "@/lib/finance";
import { formatPrice } from "@/lib/formatters";
import { headers } from "next/headers";
import { CashoutForm } from "./_components/CashoutForm";

export const metadata: Metadata = {
    title: "Finances",
    description: "Track booking income and studio expenses.",
};

const REVENUE_CATEGORIES = ["Wedding", "Videography", "Photography", "Others"] as const;

function sumAmounts<T extends { amount: number }>(items: T[]) {
    return items.reduce((total, item) => total + item.amount, 0);
}

function isInPeriod(date: Date, start: Date, end: Date) {
    return date >= start && date <= end;
}

export default async function FinancesPage() {
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
    const managedStudioIds = [...new Set(
        memberships
            .filter((membership) => ["owner", "manager", "developer"].includes(membership.role))
            .map((membership) => membership.studioId),
    )];

    if (!isPlatformAdmin && managedStudioIds.length === 0) redirect("/");

    const studios = await db.query.studio.findMany({
        where: isPlatformAdmin ? undefined : inArray(schema.studio.id, managedStudioIds),
        columns: { id: true, name: true },
        orderBy: (studio, { asc }) => [asc(studio.name)],
    });
    const studioIds = studios.map((studio) => studio.id);

    if (studioIds.length === 0) {
        return (
            <div className="px-4 py-8 lg:px-6">
                <h1 className="text-2xl font-semibold">Finances</h1>
                <p className="mt-2 text-sm text-muted-foreground">No studios are available to report on.</p>
            </div>
        );
    }

    const [bookings, cashouts] = await Promise.all([
        db.query.booking.findMany({
            where: and(
                inArray(schema.booking.studioId, studioIds),
                ne(schema.booking.bookingStatus, "CANCELLED"),
            ),
            with: {
                service: { columns: { name: true, category: true } },
                payments: { columns: { amount: true, status: true, paymentDate: true } },
            },
        }),
        db.select({
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
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const income = bookings.flatMap((booking) =>
        booking.payments
            .filter((payment) => payment.status === "PAID" || payment.status === "PARTIALLY_PAID")
            .map((payment) => ({
                amount: Number(payment.amount),
                date: new Date(payment.paymentDate),
                studioId: booking.studioId,
                category: getRevenueCategory(booking.service?.name ?? "", booking.service?.category ?? "OTHERS"),
            })),
    );
    const expenses = cashouts.map((cashout) => ({
        ...cashout,
        amount: Number(cashout.amount),
        date: new Date(cashout.expenseDate),
    }));

    const totalIncome = sumAmounts(income);
    const thisMonthIncome = sumAmounts(income.filter((entry) => isInPeriod(entry.date, monthStart, now)));
    const thisYearIncome = sumAmounts(income.filter((entry) => isInPeriod(entry.date, yearStart, now)));
    const totalExpenses = sumAmounts(expenses);
    const monthExpenses = sumAmounts(expenses.filter((entry) => isInPeriod(entry.date, monthStart, endOfToday)));
    const yearExpenses = sumAmounts(expenses.filter((entry) => isInPeriod(entry.date, yearStart, endOfToday)));

    const incomeByCategory = REVENUE_CATEGORIES.map((category) => ({
        category,
        amount: sumAmounts(income.filter((entry) => entry.category === category)),
    }));
    const highestCategoryIncome = Math.max(...incomeByCategory.map((entry) => entry.amount), 1);
    const incomeByStudio = studios.map((studio) => {
        const studioIncome = income.filter((entry) => entry.studioId === studio.id);
        const studioExpenses = expenses.filter((entry) => entry.studioId === studio.id);
        return {
            ...studio,
            lifetime: sumAmounts(studioIncome),
            month: sumAmounts(studioIncome.filter((entry) => isInPeriod(entry.date, monthStart, now))),
            year: sumAmounts(studioIncome.filter((entry) => isInPeriod(entry.date, yearStart, now))),
            expenses: sumAmounts(studioExpenses),
        };
    });
    const expenseByCategory = [...new Set(expenses.map((expense) => expense.category))]
        .map((category) => ({
            category,
            amount: sumAmounts(expenses.filter((expense) => expense.category === category)),
        }))
        .sort((a, b) => b.amount - a.amount);
    const studioNameById = new Map(studios.map((studio) => [studio.id, studio.name]));
    const recentCashouts = expenses.slice(0, 30);
    const today = new Date().toISOString().slice(0, 10);

    return (
        <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-primary">Your business at a glance</p>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Finances</h1>
                    </div>
                    <CashoutForm
                        studios={studios}
                        categories={expenseByCategory.map(({ category }) => category)}
                        today={today}
                    />
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    See what your bookings bring in, compare studio performance, and keep track of every cashout.
                </p>
            </div>

            <section aria-label="Income and expenses" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard title="Income · all time" value={totalIncome} detail="Collected from paid bookings" icon={<CircleDollarSign className="size-4" />} />
                <MetricCard title="Income · this month" value={thisMonthIncome} detail={`${formatPrice(monthExpenses)} spent this month`} icon={<CalendarDays className="size-4" />} />
                <MetricCard title="Income · this year" value={thisYearIncome} detail={`${formatPrice(yearExpenses)} spent this year`} icon={<ArrowUpRight className="size-4" />} />
                <MetricCard title="Cashouts · all time" value={totalExpenses} detail={`${expenses.length} recorded expenses`} icon={<ArrowDownRight className="size-4" />} negative />
                <Card className="border-primary/20 bg-primary/[0.04]">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net · all time</CardTitle>
                        <Wallet className="size-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-xl font-semibold tracking-tight ${totalIncome - totalExpenses < 0 ? "text-destructive" : ""}`}>
                            {formatPrice(totalIncome - totalExpenses)}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Income minus recorded cashouts</p>
                    </CardContent>
                </Card>
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Camera className="size-4 text-primary" />Income by booking type</CardTitle>
                            <CardDescription>All collected booking payments, grouped by service.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {incomeByCategory.map(({ category, amount }) => (
                                <div key={category} className="space-y-2">
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="font-medium">{category}</span>
                                        <span className="tabular-nums text-muted-foreground">{formatPrice(amount)}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all"
                                            style={{ width: `${Math.min(100, amount / highestCategoryIncome * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-primary" />Studio performance</CardTitle>
                            <CardDescription>Collected income and cashouts for each studio.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Studio</TableHead>
                                            <TableHead className="text-right">All time</TableHead>
                                            <TableHead className="text-right">This month</TableHead>
                                            <TableHead className="text-right">This year</TableHead>
                                            <TableHead className="text-right">Cashouts</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {incomeByStudio.map((studio) => (
                                            <TableRow key={studio.id}>
                                                <TableCell className="min-w-32 font-medium">{studio.name}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatPrice(studio.lifetime)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatPrice(studio.month)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatPrice(studio.year)}</TableCell>
                                                <TableCell className="text-right tabular-nums text-muted-foreground">{formatPrice(studio.expenses)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {incomeByStudio.length === 0 && (
                                            <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No studios to report.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {expenseByCategory.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Cashouts by category</CardTitle>
                                <CardDescription>Where your expenses are going, all time.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {expenseByCategory.map(({ category, amount }) => (
                                    <div key={category} className="rounded-2xl border bg-muted/30 px-3 py-2">
                                        <p className="text-xs text-muted-foreground">{category}</p>
                                        <p className="mt-1 text-sm font-semibold tabular-nums">{formatPrice(amount)}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent cashouts</CardTitle>
                            <CardDescription>Latest recorded expenses across your studios.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentCashouts.length === 0 ? (
                                <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                                    <Wallet className="mx-auto size-5 text-muted-foreground" />
                                    <p className="mt-2 text-sm font-medium">No cashouts yet</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Expenses you add will appear here.</p>
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {recentCashouts.map((cashout) => (
                                        <li key={cashout.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{cashout.description}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {cashout.category} · {studioNameById.get(cashout.studioId) ?? "Studio"} ·{" "}
                                                    {cashout.date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                                                −{formatPrice(cashout.amount)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>
        </main>
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
                <div className={`text-xl font-semibold tracking-tight ${negative ? "text-destructive" : ""}`}>{formatPrice(value)}</div>
                <CardDescription className="mt-1 text-xs">{detail}</CardDescription>
            </CardContent>
        </Card>
    );
}
