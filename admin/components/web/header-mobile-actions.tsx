"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import {
  CirclePlusIcon,
  UsersIcon,
  WrenchIcon,
  Building2Icon,
  CalendarPlusIcon,
} from "lucide-react";
import { AddBookingDialog, StudioForBooking } from "./bookings/AddBookingDialog";

interface HeaderMobileActionsProps {
  canCreateBooking: boolean;
  canCreateClient: boolean;
  canCreateService: boolean;
  canCreateStudio: boolean;
  studios?: StudioForBooking[];
}

export function HeaderMobileActions({
  canCreateBooking,
  canCreateClient,
  canCreateService,
  canCreateStudio,
  studios,
}: HeaderMobileActionsProps) {
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ size: "sm" })}>
          <CirclePlusIcon className="h-4 w-4" />
          <span className="sr-only">Create New</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canCreateBooking && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setBookingDialogOpen(true);
              }}
              className="cursor-pointer"
            >
              <CalendarPlusIcon className="mr-2 h-4 w-4 text-primary" />
              <span>Add Booking</span>
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

      {canCreateBooking && (
        <AddBookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          studios={studios}
        />
      )}
    </>
  );
}
