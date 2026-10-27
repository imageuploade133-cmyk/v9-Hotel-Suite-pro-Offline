'use client';

import { ColumnDef } from "@tanstack/react-table"
import { getSafeDate } from "@/lib/helpers"
import { format } from "date-fns"

export const getSalesLogColumns = (currency: string): ColumnDef<any>[] => {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return [
    {
      accessorKey: "soldAt",
      header: "Date",
      cell: ({ row }) => format(getSafeDate(row.original.soldAt)!, 'PPp'),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => row.original.customerName || "Walk-in Customer",
    },
    {
      accessorKey: "itemName",
      header: "Item Name",
    },
    {
      accessorKey: "quantity",
      header: "Quantity Sold",
      cell: ({ row }) => <div className="text-center">{row.original.quantity}</div>
    },
    {
      accessorKey: "total",
      header: "Total Value",
      cell: ({ row }) => <div className="text-right font-semibold">{formatCurrency(row.original.total)}</div>,
    },
    {
      accessorKey: "soldByName",
      header: "Sold By",
    },
  ];
};
