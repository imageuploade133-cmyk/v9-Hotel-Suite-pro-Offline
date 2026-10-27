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
import { Loader2, Store, Trash2, ArrowLeft, Edit, Eye, EyeOff } from 'lucide-react';
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
    const newStatus = branch.status === 'active' ? 'hidden' : 'active';
    try {
        const branchRef = doc(db, "branches", branch.id);
        await updateDoc(branchRef, { status: newStatus });
        toast({ title: "Status Updated", description: `${branch.name} is now ${newStatus}.` });
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
        <div className="flex items-center gap-4">
             <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                <Link href="/dashboard"><ArrowLeft className="h-5 w-5"/></Link>
            </Button>
            <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-primary" />
                <h1 className="font-headline text-3xl font-semibold">Manage Branches</h1>
            </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>All Branches</CardTitle>
            <CardDescription>View, edit, and manage all business branches. Deleting a branch is permanent and cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[250px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        No branches found. <Link href="/branch/create" className="text-primary hover:underline">Create one now</Link>.
                      </TableCell>
                    </TableRow>
                  )}
                  {branches.map((branch) => (
                    <TableRow key={branch.id} className={cn(branch.status === 'hidden' && 'bg-muted/50 text-muted-foreground')}>
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
                      <TableCell className="font-medium">{branch.name}</TableCell>
                       <TableCell>{branch.address || 'N/A'}</TableCell>
                       <TableCell>
                          <Badge variant={branch.status === 'active' ? 'default' : 'secondary'} className={cn(branch.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')}>
                            {branch.status === 'active' ? <Eye className="mr-2 h-3.5 w-3.5" /> : <EyeOff className="mr-2 h-3.5 w-3.5" />}
                            {branch.status === 'active' ? 'Visible' : 'Hidden'}
                          </Badge>
                       </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Switch
                            checked={branch.status === 'active'}
                            onCheckedChange={() => toggleBranchStatus(branch)}
                            disabled={isProcessing}
                            aria-label={`Toggle visibility for ${branch.name}`}
                        />
                        <Button variant="outline" size="sm" onClick={() => handleEditInitiated(branch)} disabled={isProcessing}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteInitiated(branch)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
