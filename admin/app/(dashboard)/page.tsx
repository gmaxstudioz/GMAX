import type { Metadata } from "next";
import { ChartAreaInteractive } from "@/components/web/chart-area-interactive"
import { DataTable } from "@/components/web/data-table"
import { SectionCards } from "@/components/web/section-cards"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BriefcaseIcon, CheckCircleIcon, ClockIcon } from "lucide-react"

import data from "./data.json"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "View your studio analytics, performance metrics, and recent activity at a glance.",
};

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  let isOnlyMinorRole = false;
  const minorRoleStats = { total: 0, completed: 0, pending: 0 };

  if (session?.user) {
    const members = await prisma.member.findMany({
      where: { userId: session.user.id },
      select: { role: true }
    });
    
    const adminRoles = ["owner", "developer", "manager"];
    const hasAdminRole = members.some(m => adminRoles.includes(m.role));
    isOnlyMinorRole = members.length > 0 && !hasAdminRole;

    if (isOnlyMinorRole) {
      const myBookings = await prisma.booking.findMany({
        where: { member: { userId: session.user.id } }
      });
      minorRoleStats.total = myBookings.length;
      minorRoleStats.completed = myBookings.filter(b => b.bookingStatus === "COMPLETED").length;
      minorRoleStats.pending = myBookings.filter(b => b.bookingStatus === "PENDING").length;
    }
  }

  if (isOnlyMinorRole) {
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

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
    </div>
  )
}
