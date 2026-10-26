import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CirclePlusIcon, UsersIcon, WrenchIcon, Building2Icon, CalendarPlusIcon } from "lucide-react"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import * as schema from "@/lib/schema"
import { eq, inArray } from "drizzle-orm"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlobalSearch } from "./global-search"
import { NotificationArea } from "../NotificationArea"
import { AddBookingDialog, StudioForBooking } from "./bookings/AddBookingDialog"

export async function SiteHeader() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  let canCreateStudio = false;
  let canCreateService = false;
  let canCreateClient = true; // All roles can create clients/bookings right now based on permissions.ts
  let canCreateBooking = true;
  let studiosForBooking: StudioForBooking[] = [];

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

    if (canCreateBooking && eligibleStudioIds.length > 0) {
      const studios = await db.query.studio.findMany({
        where: inArray(schema.studio.id, eligibleStudioIds),
        with: {
          clients: {
            columns: { id: true, name: true, phone: true, email: true, image: true, type: true }
          },
          services: {
            with: {
              studioSession: true,
              serviceVariants: {
                with: { serviceDeliverables: true }
              }
            },
            orderBy: (services, { asc }) => [asc(services.category), asc(services.name)],
          },
          members: {
            with: {
              user: {
                columns: { id: true, name: true, email: true, image: true }
              }
            }
          },
          bookings: {
            where: (b, { gte }) => gte(b.bookingDate, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
            columns: {
              id: true,
              bookingDate: true,
              sessionCount: true,
              serviceId: true,
              bookingStatus: true,
              studioId: true
            }
          }
        }
      });

      studiosForBooking = JSON.parse(JSON.stringify(studios, (_key, value) =>
        value !== null && typeof value === "object" && typeof value.toNumber === "function"
          ? value.toNumber()
          : value
      )) as StudioForBooking[];
    }
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-full hidden md:block"
        />
        <div className="hidden md:block">
          <h1 className="text-base font-medium">Dashboard</h1>
        </div>
        <div className="ml-auto flex-1 md:ml-4 lg:ml-8 max-w-sm">
          <GlobalSearch />
        </div>
      </div>
      
      <div className="px-4 lg:px-6 flex items-center gap-2">
        <NotificationArea />

        {/* Desktop Add Booking Button */}
        {canCreateBooking && studiosForBooking.length > 0 && (
          <div className="hidden md:flex items-center">
            <AddBookingDialog studios={studiosForBooking} />
          </div>
        )}

        {canCreateStudio && (
          <Button size="sm" variant="outline" asChild className="hidden md:flex">
            <Link href="/studios/create">
              <Building2Icon className="mr-2 h-4 w-4" />
              Create Studio
            </Link>
          </Button>
        )}
        
        {/* Mobile Dropdown for small screens */}
        <div className="md:hidden">
          {(canCreateBooking || canCreateClient || canCreateService || canCreateStudio) && (
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ size: "sm" })}>
                  <CirclePlusIcon className="h-4 w-4" />
                  <span className="sr-only">Create New</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canCreateBooking && studiosForBooking.length > 0 ? (
                  <AddBookingDialog
                    studios={studiosForBooking}
                    trigger={
                      <div className="flex items-center w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm select-none">
                        <CalendarPlusIcon className="mr-2 h-4 w-4 text-primary" />
                        <span>Add Booking</span>
                      </div>
                    }
                  />
                ) : canCreateBooking ? (
                  <DropdownMenuItem asChild>
                    <Link href="/bookings" className="cursor-pointer">
                      <CalendarPlusIcon className="mr-2 h-4 w-4" />
                      <span>Add Booking</span>
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {canCreateClient && (
                  <DropdownMenuItem asChild>
                    <Link href="/clients" className="cursor-pointer">
                      <UsersIcon className="mr-2 h-4 w-4" />
                      <span>Add Client</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {canCreateService && (
                  <DropdownMenuItem asChild>
                    <Link href="/services" className="cursor-pointer">
                      <WrenchIcon className="mr-2 h-4 w-4" />
                      <span>Add Service</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {canCreateStudio && (
                  <DropdownMenuItem asChild>
                    <Link href="/studios/create" className="cursor-pointer">
                      <Building2Icon className="mr-2 h-4 w-4" />
                      <span>Create Studio</span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}

