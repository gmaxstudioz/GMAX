import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { formatPrice } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { CreditCardIcon, CheckmarkCircle01Icon, Time01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

export const metadata: Metadata = {
    title: "Transactions",
    description: "Manage and track payments across your studios.",
};

export default async function TransactionsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const members = await prisma.member.findMany({
        where: { userId: session.user.id },
        select: { role: true, studioId: true }
    });
    
    // Check if user is an admin/manager
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some(m => adminRoles.includes(m.role));

    if (!hasAdminRole) {
        redirect("/");
    }

    const isSuperAdmin = members.some(m => ["owner", "developer"].includes(m.role));
    
    // Get the studios they manage if they are a manager
    const managedStudioIds = members.filter(m => m.role === "manager").map(m => m.studioId);

    // Fetch payments
    const payments = await prisma.payment.findMany({
        where: isSuperAdmin ? {} : {
            booking: {
                studioId: { in: managedStudioIds }
            }
        },
        include: {
            booking: {
                include: {
                    client: true,
                    studio: true,
                    service: true
                }
            }
        },
        orderBy: {
            paymentDate: "desc"
        }
    });

    // Calculate stats
    const paidCount = payments.filter(p => p.status === "PAID").length;
    const pendingCount = payments.filter(p => p.status === "PENDING").length;
    const partiallyPaidCount = payments.filter(p => p.status === "PARTIALLY_PAID").length;
    const cancelledCount = payments.filter(p => p.status === "CANCELLED").length;

    const totalAmountCollected = payments
        .filter(p => p.status === "PAID" || p.status === "PARTIALLY_PAID")
        .reduce((sum, p) => sum + Number(p.amount), 0);

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div>
                <h1 className="text-2xl font-bold">Transactions</h1>
                <p className="text-muted-foreground">Manage and track payments across your managed studios.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-green-500 h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{paidCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Completed payments</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                        <HugeiconsIcon icon={Time01Icon} className="text-orange-500 h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Partially Paid</CardTitle>
                        <HugeiconsIcon icon={CreditCardIcon} className="text-blue-500 h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{partiallyPaidCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Incomplete payments</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
                        <HugeiconsIcon icon={Cancel01Icon} className="text-red-500 h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{cancelledCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Failed or cancelled</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>
                        Total collected: <span className="font-bold text-primary">{formatPrice(totalAmountCollected)}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
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
                                {payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                            No transactions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    payments.map((payment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell className="font-mono text-xs">{payment.receiptNumber}</TableCell>
                                            <TableCell>{format(new Date(payment.paymentDate), "MMM do, yyyy")}</TableCell>
                                            <TableCell>{payment.booking?.client?.name || "N/A"}</TableCell>
                                            <TableCell>{payment.booking?.studio?.name || "N/A"}</TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={payment.booking?.service?.name}>
                                                {payment.booking?.service?.name || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{payment.method}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    payment.status === "PAID" ? "default" :
                                                    payment.status === "PENDING" ? "secondary" :
                                                    payment.status === "PARTIALLY_PAID" ? "secondary" :
                                                    "destructive"
                                                }>
                                                    {payment.status.replace(/_/g, " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-primary">
                                                {formatPrice(Number(payment.amount))}
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
    );
}
