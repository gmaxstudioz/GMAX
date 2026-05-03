import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CirclePlusIcon, UsersIcon, WrenchIcon, Building2Icon, CalendarPlusIcon } from "lucide-react"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export async function SiteHeader() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  let canCreateStudio = false;
  let canCreateService = false;
  let canCreateClient = true; // All roles can create clients/bookings right now based on permissions.ts
  let canCreateBooking = true;

  if (session?.user) {
    const members = await prisma.member.findMany({
      where: { userId: session.user.id },
      select: { role: true }
    });
    
    canCreateStudio = members.some(m => ["owner", "developer"].includes(m.role));
    canCreateService = members.some(m => ["owner", "developer", "manager"].includes(m.role));
    
    // If they have NO roles, technically they can't create anything
    if (members.length === 0) {
      canCreateClient = false;
      canCreateBooking = false;
    }
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-full"
        />
        <h1 className="text-base font-medium">Dashboard</h1>
      </div>
      
      <div className="px-4 lg:px-6 flex items-center gap-2">
        {canCreateBooking && (
          <Button variant="outline" size="sm" className="hidden md:flex" asChild>
            <Link href="/bookings">
              <CalendarPlusIcon className="mr-2 h-4 w-4" />
              Add Booking
            </Link>
          </Button>
        )}
        {canCreateClient && (
          <Button variant="outline" size="sm" className="hidden md:flex" asChild>
            <Link href="/clients">
              <UsersIcon className="mr-2 h-4 w-4" />
              Add Client
            </Link>
          </Button>
        )}
        {canCreateService && (
          <Button variant="outline" size="sm" className="hidden md:flex" asChild>
            <Link href="/services">
              <WrenchIcon className="mr-2 h-4 w-4" />
              Add Service
            </Link>
          </Button>
        )}
        {canCreateStudio && (
          <Button size="sm" asChild>
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
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <CirclePlusIcon className="h-4 w-4" />
                  <span className="sr-only">Create New</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canCreateBooking && (
                  <DropdownMenuItem asChild>
                    <Link href="/bookings" className="cursor-pointer">
                      <CalendarPlusIcon className="mr-2 h-4 w-4" />
                      <span>Add Booking</span>
                    </Link>
                  </DropdownMenuItem>
                )}
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
