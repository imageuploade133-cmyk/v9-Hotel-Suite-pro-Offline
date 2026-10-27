
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, FileText, CreditCard, Phone } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { Timestamp } from 'firebase/firestore'
import Link from 'next/link';

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "../ui/checkbox"
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar"
import { getInitials } from "@/lib/helpers"
import type { Customer } from "@/lib/types"

type GetColumnsProps = {
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onViewImage: (imageUrl: string | undefined) => void;
  onPayCredit?: (customer: Customer & { outstandingBalance?: number }) => void;
  pageName?: string;
  currency?: string;
};

export const getColumns = ({
  onEdit,
  onDelete,
  onViewImage,
  onPayCredit,
  pageName = 'customers',
  currency = 'USD',
}: GetColumnsProps): ColumnDef<Customer & { totalSpent?: number; totalPaid?: number; outstandingBalance?: number; }>[] => {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  const columns: ColumnDef<Customer & { totalSpent?: number; totalPaid?: number; outstandingBalance?: number; }>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const customer = row.original
        return (
          <div className="flex items-center gap-3">
            <button
              className="relative flex-shrink-0"
              onClick={() => onViewImage(customer.photoURL)}
              disabled={!customer.photoURL}
            >
              <Avatar className="h-10 w-10 cursor-pointer transition-opacity hover:opacity-80">
                <AvatarImage src={customer.photoURL || undefined} alt={customer.name} />
                <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
              </Avatar>
            </button>
            <div className="flex flex-col">
              <Link href={`/${pageName}/${customer.id}`} className="font-medium hover:underline">{customer.name}</Link>
              <span className="text-xs text-muted-foreground">
                {customer.email}
              </span>
               {customer.phoneNumber && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {customer.phoneNumber}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "totalBookings",
      header: "Total Bookings",
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("totalBookings") as number}</div>
      ),
    },
    {
      accessorKey: "lastVisit",
      header: "Last Visit",
      cell: ({ row }) => {
        const rawLastVisit = row.getValue("lastVisit") as Date | Timestamp | null

        const getSafeDate = (date: any): Date | null => {
            if (!date) return null;
            if (date.toDate) return date.toDate(); // Firestore Timestamp
            return new Date(date);
        }

        const lastVisit = getSafeDate(rawLastVisit);

        if (!lastVisit) return <span className="text-muted-foreground">N/A</span>

        return (
          <div className="flex flex-col">
            <span>{format(lastVisit, "MMM d, yyyy")}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(lastVisit, { addSuffix: true })}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const customer = row.original

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/customers/${customer.id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      View Statement
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(customer)}>
                  Edit customer
                </DropdownMenuItem>
                {pageName === 'pos-customers' && onPayCredit && (
                  <DropdownMenuItem
                    onClick={() => onPayCredit(customer)}
                    disabled={(customer.outstandingBalance ?? 0) <= 0}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Credit
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-500 focus:bg-red-50 focus:text-red-500"
                  onClick={() => onDelete(customer)}
                >
                  Delete customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ];

  return columns;
};
