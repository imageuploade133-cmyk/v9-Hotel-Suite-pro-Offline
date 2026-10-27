
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
  pageName = 'pos-customers',
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
      accessorKey: 'totalSpent',
      header: () => <div className="text-right">Total Spent</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatCurrency(row.original.totalSpent ?? 0)}
        </div>
      ),
    },
    {
      accessorKey: 'totalPaid',
      header: () => <div className="text-right">Total Paid</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium text-green-600">
          {formatCurrency(row.original.totalPaid ?? 0)}
        </div>
      ),
    },
    {
      accessorKey: 'outstandingBalance',
      header: () => <div className="text-right">Balance Due</div>,
      cell: ({ row }) => {
        const balance = row.original.outstandingBalance ?? 0;
        return (
          <div className={`text-right font-bold ${balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
            {formatCurrency(balance)}
          </div>
        );
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
                  <Link href={`/${pageName}/${customer.id}`}>
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
				  disabled={customer.name === 'Walk-in Customer'}
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
