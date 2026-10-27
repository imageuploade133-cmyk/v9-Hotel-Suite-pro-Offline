"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Edit, Trash2 } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StockSupplier } from "@/lib/types"

type GetColumnsProps = {
  onEdit: (supplier: StockSupplier) => void;
  onDelete: (supplier: StockSupplier) => void;
};

export const getColumns = ({ onEdit, onDelete }: GetColumnsProps): ColumnDef<StockSupplier & { itemCount?: number }>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Supplier
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.category}</span>
        </div>
    ),
  },
  {
    accessorKey: "contactPerson",
    header: "Contact Person",
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "itemCount",
    header: "Linked Items",
    cell: ({ row }) => <div className="text-center">{row.original.itemCount || 0}</div>,
  },
  {
    accessorKey: "createdAt",
    header: "Date Added",
    cell: ({ row }) => {
      const date = (row.original.createdAt as any)?.toDate();
      return date ? format(date, 'PPP') : 'N/A';
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const supplier = row.original

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
              <DropdownMenuItem onClick={() => onEdit(supplier)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Supplier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-500 focus:bg-red-50 focus:text-red-500"
                onClick={() => onDelete(supplier)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Supplier
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
