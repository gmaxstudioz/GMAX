import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Building2Icon } from "lucide-react"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import * as schema from "@/lib/schema"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { GlobalSearch } from "./global-search"
import { NotificationArea } from "../NotificationArea"
import { AddBookingDialog } from "./bookings/AddBookingDialog"
import { HeaderMobileActions } from "./header-mobile-actions"

export async function SiteHeader() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  let canCreateStudio = false;
  let canCreateService = false;
  let canCreateClient = true; // All roles can create clients/bookings right now based on permissions.ts
  let canCreateBooking = true;

  if (session?.user) {
    const members = await db.query.member.findMany({
      where: eq(schema.member.userId, session.user.id),
      columns: { role: true, studioId: true }
    });
    
    canCreateStudio = members.some((m: { role: string }) => ["owner", "developer"].includes(m.role));
    canCreateService = members.some((m: { role: string }) => ["owner", "developer", "manager"].includes(m.role));
    
    // If they have NO roles, or their only roles are photographer/videographer, they can't create clients/bookings
    if (members.length === 0 || members.every((m: { role: string }) => ["photographer", "videographer"].includes(m.role))) {
      canCreateClient = false;
      canCreateBooking = false;
    }

    const bookingRoles = ["owner", "admin", "manager", "receptionist", "developer"];
    const eligibleStudioIds = members
      .filter((m: { role: string }) => bookingRoles.includes(m.role))
      .map((m: { studioId: string }) => m.studioId);

    if (eligibleStudioIds.length === 0) {
      canCreateBooking = false;
    }
  }

  return (
    <header className="@container/header flex h-(--header-height) shrink-0 items-center justify-between border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex flex-1 items-center min-w-0 gap-1 px-2 sm:px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-full hidden md:block"
        />
        <div className="hidden md:block shrink-0">
          <h1 className="text-base font-medium">Dashboard</h1>
        </div>
        <div className="ml-auto flex-1 min-w-[100px] md:ml-4 lg:ml-8 max-w-xs sm:max-w-sm">
          <GlobalSearch />
        </div>
      </div>
      
      <div className="shrink-0 px-2 sm:px-4 lg:px-6 flex items-center gap-1.5 sm:gap-2">
        <NotificationArea />

        {/* Desktop Add Booking Button */}
        {canCreateBooking && (
          <div className="hidden @4xl/header:flex items-center">
            <AddBookingDialog />
          </div>
        )}

        {canCreateStudio && (
          <Button size="sm" variant="outline" asChild className="hidden @4xl/header:flex">
            <Link href="/studios/create">
              <Building2Icon className="mr-2 h-4 w-4" />
              Create Studio
            </Link>
          </Button>
        )}
        
        {/* Mobile Dropdown for small screens */}
        <div className="@4xl/header:hidden">
          {(canCreateBooking || canCreateClient || canCreateService || canCreateStudio) && (
            <HeaderMobileActions
              canCreateBooking={canCreateBooking}
              canCreateClient={canCreateClient}
              canCreateService={canCreateService}
              canCreateStudio={canCreateStudio}
            />
          )}
        </div>
      </div>
    </header>
  )
}
