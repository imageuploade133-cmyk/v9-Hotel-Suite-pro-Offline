'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useBranch } from '@/contexts/branch-context';
import { useUser } from '@/contexts/user-context';
import { useAuth } from '@/components/auth/auth-provider';
import { db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Store, Trash2, ArrowLeft, Edit, Eye, EyeOff, Search, PlusCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DeleteBranchConfirmationDialog } from '@/components/dialogs/delete-branch-confirmation-dialog';
import { EditBranchDialog, type BranchFormValues } from '@/components/dialogs/edit-branch-dialog';
import Link from 'next/link';
import type { Branch } from '@/lib/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function ManageBranchesPage() {
  const { branches, isLoadingBranches, selectBranch, currentBranchId } = useBranch();
  const { user } = useAuth();
  const { userProfile, loading: profileLoading } = useUser();
  const { toast } = useToast();

  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [branchToEdit, setBranchToEdit] = useState<Branch | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeBranchesCount = branches.filter((b) => b.status === 'active' || !b.status).length;
  const hiddenBranchesCount = branches.filter((b) => b.status === 'hidden').length;

  const filteredBranches = branches.filter((branch) => {
    const isBranchActive = branch.status === 'active' || !branch.status;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && isBranchActive) ||
      (statusFilter === 'hidden' && branch.status === 'hidden');

    const matchesSearch =
      !searchQuery ||
      branch.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.address?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const handleDeleteInitiated = (branch: Branch) => {
    setBranchToDelete(branch);
  };

  const handleEditInitiated = (branch: Branch) => {
    setBranchToEdit(branch);
  };

  const handleEditSubmit = async (values: BranchFormValues) => {
    if (!branchToEdit) return;
    setIsProcessing(true);
    try {
        const branchRef = doc(db, "branches", branchToEdit.id);
        await updateDoc(branchRef, {
            name: values.name,
            address: values.address || null,
            phoneNumber: values.phoneNumber || null,
            logoUrl: values.logoUrl || null,
        });
        toast({ title: "Branch Updated", description: `"${values.name}" has been updated.` });
        setBranchToEdit(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not update branch.' });
    } finally {
        setIsProcessing(false);
    }
  };

  const toggleBranchStatus = async (branch: Branch) => {
    setIsProcessing(true);
    const isCurrentlyActive = branch.status === 'active' || !branch.status;
    const newStatus = isCurrentlyActive ? 'hidden' : 'active';
    try {
        const branchRef = doc(db, "branches", branch.id);
        await updateDoc(branchRef, { status: newStatus });

        // If hiding the currently active branch, switch to global mode
        if (newStatus === 'hidden' && currentBranchId === branch.id) {
          selectBranch('global');
        }

        toast({
          title: newStatus === 'active' ? "Branch Unhidden" : "Branch Hidden",
          description: newStatus === 'active'
            ? `"${branch.name}" is now visible and active across the system.`
            : `"${branch.name}" is now hidden. You can unhide it here at any time.`,
        });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not update status.' });
    } finally {
        setIsProcessing(false);
    }
  };


  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;

    setIsProcessing(true);
    try {
      if (branchToDelete.id === currentBranchId) {
        selectBranch(null);
      }

      await deleteDoc(doc(db, 'branches', branchToDelete.id));

      toast({
        title: "Branch Deleted",
        description: `The branch "${branchToDelete.name}" has been permanently removed.`,
      });
      setBranchToDelete(null);
    } catch (error: any) {
      console.error("Error deleting branch:", error);
      toast({
        variant: 'destructive',
        title: 'Error Deleting Branch',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (profileLoading || isLoadingBranches) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // All Firebase users have full admin access

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild>
              <Link href="/dashboard"><ArrowLeft className="h-5 w-5"/></Link>
            </Button>
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h1 className="font-headline text-3xl font-semibold">Manage Branches</h1>
                <p className="text-sm text-muted-foreground">View, edit, hide/unhide, and manage all hotel branches.</p>
              </div>
            </div>
          </div>
          <Button asChild className="gap-2 shrink-0">
            <Link href="/branch/create">
              <PlusCircle className="h-4 w-4" /> Create New Branch
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Branches ({branches.length})</CardTitle>
                <CardDescription>
                  Hidden branches are excluded from regular staff and user menus, but remain safely stored and can be unhidden at any time.
                </CardDescription>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg border text-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-medium text-xs transition-colors',
                    statusFilter === 'all'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All ({branches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5',
                    statusFilter === 'active'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  Visible ({activeBranchesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('hidden')}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-medium text-xs transition-colors flex items-center gap-1.5',
                    statusFilter === 'hidden'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                  Hidden ({hiddenBranchesCount})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search branches by name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Logo</TableHead>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[300px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                        No branches found in database. <Link href="/branch/create" className="text-primary hover:underline font-medium">Create one now</Link>.
                      </TableCell>
                    </TableRow>
                  ) : filteredBranches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                        {statusFilter === 'hidden' ? (
                          <span>No hidden branches. All {branches.length} branches are currently visible.</span>
                        ) : statusFilter === 'active' ? (
                          <span>No visible branches found.</span>
                        ) : (
                          <span>No branches match your search &quot;{searchQuery}&quot;.</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBranches.map((branch) => {
                      const isBranchActive = branch.status === 'active' || !branch.status;
                      const isCurrentlySelected = currentBranchId === branch.id;

                      return (
                        <TableRow
                          key={branch.id}
                          className={cn(
                            !isBranchActive && 'bg-muted/40 opacity-80 transition-opacity hover:opacity-100'
                          )}
                        >
                          <TableCell>
                            {branch.logoUrl ? (
                              <div className="relative w-12 h-12 rounded-md overflow-hidden border bg-muted">
                                <Image
                                  src={branch.logoUrl}
                                  alt={branch.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                                <Store className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold flex items-center gap-2">
                                {branch.name}
                                {isCurrentlySelected && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary text-primary font-normal">
                                    Current
                                  </Badge>
                                )}
                              </span>
                              {branch.phoneNumber && (
                                <span className="text-xs text-muted-foreground">{branch.phoneNumber}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{branch.address || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={isBranchActive ? 'default' : 'secondary'}
                              className={cn(
                                'gap-1.5',
                                isBranchActive
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200'
                              )}
                            >
                              {isBranchActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              {isBranchActive ? 'Visible' : 'Hidden'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Dedicated Toggle Button */}
                              {isBranchActive ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleBranchStatus(branch)}
                                  disabled={isProcessing}
                                  className="text-muted-foreground hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs h-8"
                                  title="Hide this branch from user menus"
                                >
                                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleBranchStatus(branch)}
                                  disabled={isProcessing}
                                  className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs h-8 font-medium"
                                  title="Unhide this branch to make it visible across menus"
                                >
                                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Unhide Branch
                                </Button>
                              )}

                              <Switch
                                checked={isBranchActive}
                                onCheckedChange={() => toggleBranchStatus(branch)}
                                disabled={isProcessing}
                                aria-label={`Toggle visibility for ${branch.name}`}
                              />

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditInitiated(branch)}
                                disabled={isProcessing}
                                className="h-8 text-xs"
                              >
                                <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                              </Button>

                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteInitiated(branch)}
                                disabled={isProcessing}
                                className="h-8 text-xs"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <DeleteBranchConfirmationDialog
        isOpen={!!branchToDelete}
        onOpenChange={(open) => !open && setBranchToDelete(null)}
        onConfirm={handleConfirmDelete}
        branchName={branchToDelete?.name || ''}
        isDeleting={isProcessing}
      />

       <EditBranchDialog
        isOpen={!!branchToEdit}
        onOpenChange={(open) => !open && setBranchToEdit(null)}
        onSubmit={handleEditSubmit}
        branch={branchToEdit}
        isSubmitting={isProcessing}
      />
    </>
  );
}
