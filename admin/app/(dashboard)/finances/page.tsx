import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Building2, CalendarDays, Camera, CircleDollarSign, Wallet, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
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

export const metadata: Metadata = {
    title: "Finances",
    description: "Track booking income and studio expenses.",
};

const REVENUE_CATEGORIES = ["Wedding", "Photography", "Videography", "Others"] as const;

function sumAmounts<T extends { amount: number }>(items: T[]) {
    return items.reduce((total, item) => total + item.amount, 0);
}

function isInPeriod(date: Date, start: Date, end: Date) {
    return date >= start && date <= end;
}

export default async function FinancesPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;
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
            where: inArray(schema.booking.studioId, studioIds),
            with: {
                service: { columns: { name: true, category: true } },
                client: { columns: { name: true } },
                studio: { columns: { name: true } },
                payments: { columns: { id: true, receiptNumber: true, method: true, amount: true, status: true, paymentDate: true } },
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
        booking.bookingStatus === "CANCELLED" ? [] : [{
                amount: Number(booking.totalAmount),
                date: new Date(booking.createdAt),
                studioId: booking.studioId,
                category: getRevenueCategory(booking.service?.name ?? "", booking.service?.category ?? "OTHERS"),
            }],
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
    const today = new Date().toISOString().slice(0, 10);
    const paymentTransactions = bookings.flatMap((booking) => booking.payments.map((payment) => ({
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        clientName: booking.client?.name ?? "N/A",
        studioName: booking.studio?.name ?? "N/A",
        serviceName: booking.service?.name ?? "N/A",
        method: payment.method,
        status: payment.status,
        amount: Number(payment.amount),
    }))).sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    const paidCount = paymentTransactions.filter((payment) => payment.status === "PAID").length;
    const pendingCount = paymentTransactions.filter((payment) => payment.status === "PENDING").length;
    const partiallyPaidCount = paymentTransactions.filter((payment) => payment.status === "PARTIALLY_PAID").length;
    const cancelledCount = paymentTransactions.filter((payment) => payment.status === "CANCELLED").length;
    const collectedAmount = sumAmounts(paymentTransactions.filter(
        (payment) => payment.status === "PAID" || payment.status === "PARTIALLY_PAID",
    ));

    return (
        <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-primary">Your business at a glance</p>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Finances</h1>
                    </div>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    See what your bookings bring in, compare studio performance, and keep track of every cashout.
                </p>
            </div>

            <FinanceTabs
                defaultTab={tab === "transactions" || tab === "cashouts" ? tab : "overview"}
                overview={
                    <>
                    <section aria-label="Income and expenses" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <MetricCard title="Booked revenue · all time" value={totalIncome} detail="From non-cancelled bookings" icon={<CircleDollarSign className="size-4" />} />
                <MetricCard title="Booked revenue · this month" value={thisMonthIncome} detail={`${formatPrice(monthExpenses)} spent this month`} icon={<CalendarDays className="size-4" />} />
                <MetricCard title="Booked revenue · this year" value={thisYearIncome} detail={`${formatPrice(yearExpenses)} spent this year`} icon={<ArrowUpRight className="size-4" />} />
                <MetricCard title="Collected · all time" value={collectedAmount} detail="From recorded booking payments" icon={<CheckCircle2 className="size-4" />} />
                <MetricCard title="Cashouts · all time" value={totalExpenses} detail={`${expenses.length} recorded expenses`} icon={<ArrowDownRight className="size-4" />} negative />
                <Card className="border-primary/20 bg-primary/[0.04]">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net after cashouts · all time</CardTitle>
                        <Wallet className="size-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-xl font-semibold tracking-tight ${totalIncome - totalExpenses < 0 ? "text-destructive" : ""}`}>
                            {formatPrice(totalIncome - totalExpenses)}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Booked revenue minus recorded cashouts</p>
                    </CardContent>
                </Card>
            </section>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Camera className="size-4 text-primary" />Booking revenue</CardTitle>
                            <CardDescription>
                                {formatPrice(totalIncome)} total from non-cancelled bookings, grouped by service category.
                            </CardDescription>
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
                            <CardDescription>Booked revenue and cashouts for each studio.</CardDescription>
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

                    </>
                }
                transactions={
                    <Card>
                        <CardHeader>
                            <CardTitle>Booking transactions</CardTitle>
                            <CardDescription>
                                Track payment status across your studios. Collected: <span className="font-semibold text-primary">{formatPrice(collectedAmount)}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <TransactionCount label="Paid" count={paidCount} icon={<CheckCircle2 className="size-4 text-green-500" />} />
                                <TransactionCount label="Pending" count={pendingCount} icon={<CalendarDays className="size-4 text-orange-500" />} />
                                <TransactionCount label="Partially paid" count={partiallyPaidCount} icon={<CircleDollarSign className="size-4 text-blue-500" />} />
                                <TransactionCount label="Cancelled" count={cancelledCount} icon={<ArrowDownRight className="size-4 text-destructive" />} />
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
                                        {paymentTransactions.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No transactions found.</TableCell></TableRow>
                                        ) : paymentTransactions.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell className="font-mono text-xs">{payment.receiptNumber}</TableCell>
                                                <TableCell>{format(new Date(payment.paymentDate), "MMM do, yyyy")}</TableCell>
                                                <TableCell>{payment.clientName}</TableCell>
                                                <TableCell>{payment.studioName}</TableCell>
                                                <TableCell className="max-w-[150px] truncate" title={payment.serviceName}>{payment.serviceName}</TableCell>
                                                <TableCell><Badge variant="outline">{payment.method}</Badge></TableCell>
                                                <TableCell>
                                                    <Badge variant={payment.status === "PAID" ? "default" : payment.status === "CANCELLED" ? "destructive" : "secondary"}>
                                                        {payment.status.replace(/_/g, " ")}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-primary">{formatPrice(payment.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                }
                cashouts={
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard title="Total cashouts" value={totalExpenses} detail={`${expenses.length} expenses recorded`} icon={<Wallet className="size-4" />} negative />
                            <MetricCard title="This month" value={monthExpenses} detail="Cashouts recorded this month" icon={<CalendarDays className="size-4" />} negative />
                            <MetricCard title="This year" value={yearExpenses} detail="Cashouts recorded this year" icon={<ArrowDownRight className="size-4" />} negative />
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Top category</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="truncate text-xl font-semibold">{expenseByCategory[0]?.category ?? "—"}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {expenseByCategory[0] ? formatPrice(expenseByCategory[0].amount) : "No expenses recorded"}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                        <Card>
                            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>Cashout history</CardTitle>
                                    <CardDescription>Review and edit expenses across your studios.</CardDescription>
                                </div>
                                <CashoutForm
                                    studios={studios}
                                    categories={expenseByCategory.map(({ category }) => category)}
                                    today={today}
                                />
                            </CardHeader>
                            <CardContent>
                                {expenseByCategory.length > 0 && (
                                    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {expenseByCategory.map(({ category, amount }) => (
                                            <div key={category} className="rounded-2xl border bg-muted/20 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-xs font-medium text-muted-foreground">{category}</span>
                                                    <span className="text-xs font-semibold tabular-nums">{formatPrice(amount)}</span>
                                                </div>
                                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-destructive/70"
                                                        style={{ width: `${Math.min(100, amount / Math.max(expenseByCategory[0].amount, 1) * 100)}%` }}
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
                                            {expenses.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-28 text-center">
                                                        <Wallet className="mx-auto size-5 text-muted-foreground" />
                                                        <p className="mt-2 text-sm font-medium">No cashouts yet</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">Add an expense to start tracking business spending.</p>
                                                    </TableCell>
                                                </TableRow>
                                            ) : expenses.map((cashout) => (
                                                <TableRow key={cashout.id}>
                                                    <TableCell className="whitespace-nowrap">{format(cashout.date, "MMM do, yyyy")}</TableCell>
                                                    <TableCell className="min-w-40">
                                                        <p className="font-medium">{cashout.description}</p>
                                                        {cashout.notes && <p className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground">{cashout.notes}</p>}
                                                    </TableCell>
                                                    <TableCell><Badge variant="outline">{cashout.category}</Badge></TableCell>
                                                    <TableCell>{studioNameById.get(cashout.studioId) ?? "Studio"}</TableCell>
                                                    <TableCell className="text-right font-semibold tabular-nums text-destructive">−{formatPrice(cashout.amount)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <CashoutForm
                                                            key={cashout.id}
                                                            cashout={{
                                                                ...cashout,
                                                                expenseDate: cashout.expenseDate,
                                                            }}
                                                            studios={studios}
                                                            categories={expenseByCategory.map(({ category }) => category)}
                                                            today={today}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
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
                <div className={`text-xl font-semibold tracking-tight ${negative ? "text-destructive" : ""}`}>{formatPrice(value)}</div>
                <CardDescription className="mt-1 text-xs">{detail}</CardDescription>
            </CardContent>
        </Card>
    );
}
