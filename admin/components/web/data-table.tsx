"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export interface RecentBooking {
  id: string;
  clientName: string;
  clientImage?: string | null;
  serviceName: string;
  bookingDate: string;
  totalAmount: number;
  bookingStatus: string;
}

const columns: ColumnDef<RecentBooking>[] = [
  {
    accessorKey: "clientName",
    header: "Client",
    cell: ({ row }) => {
      const client = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={client.clientImage || undefined} />
            <AvatarFallback className="text-[10px]">
              {client.clientName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{client.clientName}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "serviceName",
    header: "Service",
    cell: ({ row }) => (
      <div className="text-muted-foreground">{row.original.serviceName}</div>
    ),
  },
  {
    accessorKey: "bookingDate",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.original.bookingDate);
      return (
        <div className="text-sm">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "totalAmount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">
        ₦{row.original.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
    ),
  },
  {
    accessorKey: "bookingStatus",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.bookingStatus;
      let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
      
      if (status === "COMPLETED") variant = "default";
      if (status === "PENDING") variant = "secondary";
      if (status === "CANCELLED") variant = "destructive";

      return (
        <Badge variant={variant} className="px-2 py-0.5 text-[10px]">
          {status}
        </Badge>
      );
    },
  },
];

export function DataTable({ data }: { data: RecentBooking[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <h3 className="text-lg font-semibold tracking-tight">Recent Bookings</h3>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="h-10 text-xs uppercase tracking-wider">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No recent bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
