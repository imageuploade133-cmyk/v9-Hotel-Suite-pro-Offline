'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { UserProfile, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowUpDown, Edit, Trash2, Power, PowerOff, Phone, DollarSign, Sunrise, Sunset, Wallet, Building } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Badge } from '../ui/badge';
import React from 'react';
import { useSettings } from "@/contexts/settings-context"
import { getDaysInMonth } from 'date-fns';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Shield } from 'lucide-react';

type Branch = {
  id: string;
  name: string;
};

type GetColumnsProps = {
  onEdit: (staff: UserProfile) => void;
  onDelete: (staff: UserProfile) => void;
  onToggleStatus: (staff: UserProfile) => void;
  onViewSalary: (staff: UserProfile) => void;
  roles: Role[] | null;
  currency: string;
  payday: number;
  branches?: Branch[];
};

export const getColumns = ({ onEdit, onDelete, onToggleStatus, onViewSalary, roles, currency, payday, branches }: GetColumnsProps): ColumnDef<UserProfile>[] => {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  const getDaysInCurrentPayPeriod = () => {
    const now = new Date();
    const isPastPayday = now.getDate() > payday;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    if (isPastPayday) {
        return new Date(currentYear, currentMonth + 1, 0).getDate();
    } else {
        return new Date(currentYear, currentMonth, 0).getDate();
    }
  };
  const daysInPayPeriod = getDaysInCurrentPayPeriod();

  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const staff = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={staff.photoURL} alt={staff.name} />
              <AvatarFallback>{getInitials(staff.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{staff.name}</span>
              <span className="text-xs text-muted-foreground">
                {staff.email}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const roleName = row.getValue("role") as string;
        const roleDetails = roles?.find(r => r.name === roleName);

        return (

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span>{roleName}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <h4 className="font-bold mb-2">{roleDetails?.name || roleName}</h4>
                        {roleDetails ? (
                            roleDetails.permissions.length > 0 ? (
                                <ul className="list-disc pl-4 text-xs space-y-1">
                                    {roleDetails.permissions.map(p => <li key={p}>{p}</li>)}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground">No permissions assigned to this role.</p>
                            )
                        ) : (
                             <p className="text-xs text-muted-foreground">Role details not found.</p>
                        )}
                    </TooltipContent>
                </Tooltip>

        )
      }
    },
     {
      accessorKey: "shift",
      header: "Shift",
      cell: ({ row }) => {
        const shift = row.original.shift;
        if (!shift) return null;
        const Icon = shift === 'Morning' ? Sunrise : Sunset;
        return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {shift}</div>
      }
    },
    {
      accessorKey: "assignedBranches",
      header: "Branches",
      cell: ({ row }) => {
        const assignedBranchIds = row.original.assignedBranches || [];
        const branchNames = assignedBranchIds
          .map(id => branches?.find(b => b.id === id)?.name)
          .filter(Boolean);

        if (assignedBranchIds.length === 0) {
          return (
            <Badge variant="secondary" className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
              All Branches
            </Badge>
          );
        }

        if (branchNames.length === 1) {
          return (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span>{branchNames[0]}</span>
            </div>
          );
        }

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{branchNames.length} branches</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <h4 className="font-bold mb-2">Assigned Branches</h4>
                <ul className="space-y-1">
                  {branchNames.map(name => (
                    <li key={name} className="text-xs">{name}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = (row.original as any).isActive;
        return <Badge variant={isActive ? 'success' : 'destructive'}>{isActive ? 'Active' : 'Disabled'}</Badge>
      }
    },
    {
        accessorKey: 'monthlySalary',
        header: 'Monthly Salary',
        cell: ({ row }) => {
            const salary = row.original.monthlySalary || 0;
            return <div className="font-semibold text-right">{formatCurrency(salary)}</div>;
        }
    },
    {
        id: 'perDayRate',
        header: 'Per Day Rate',
        cell: ({ row }) => {
            const monthlySalary = row.original.monthlySalary || 0;
            const perDayRate = monthlySalary > 0 ? monthlySalary / daysInPayPeriod : (row.original.perDayRate || 0);
            return <div className="text-right">{formatCurrency(perDayRate)}</div>;
        }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const staff = row.original
        const isActive = (staff as any).isActive;

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
                <DropdownMenuItem onClick={() => onEdit(staff)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Staff Member
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleStatus(staff)}>
                  {isActive ? (
                      <><PowerOff className="mr-2 h-4 w-4" /> Disable Account</>
                  ) : (
                      <><Power className="mr-2 h-4 w-4" /> Enable Account</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onViewSalary(staff)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  View Salary Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-500 focus:bg-red-50 focus:text-red-500"
                  onClick={() => onDelete(staff)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Staff Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
]
}
