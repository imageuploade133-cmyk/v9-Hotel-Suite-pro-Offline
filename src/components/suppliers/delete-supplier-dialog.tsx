'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import type { StockSupplier, StockItem } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';

interface DeleteSupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: StockSupplier | null;
  onSuccess: () => void;
}

export function DeleteSupplierDialog({ isOpen, onClose, supplier, onSuccess }: DeleteSupplierDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { getCollectionPath } = useBranch();

  const stockItemsQuery = React.useMemo(() => {
    if (!firestore || !supplier) return null;
    // Check stock items that reference this supplier
    // First check using supplierId (newer approach), then supplier name (legacy)
    return query(
      collection(firestore, getCollectionPath('stock')),
      where('supplierId', '==', supplier.id)
    );
  }, [firestore, supplier, getCollectionPath]);

  const { data: linkedItems, isLoading } = useCollection<StockItem>(stockItemsQuery);

  const handleDelete = async () => {
    if (!firestore || !supplier || !userProfile) return;

    if (!isLoading && linkedItems && linkedItems.length > 0) {
        toast({
            variant: 'destructive',
            title: 'Cannot Delete Supplier',
            description: `This supplier is linked to ${linkedItems.length} stock item(s). Please reassign them before deleting.`
        });
        return;
    }

    setIsDeleting(true);

    try {
      // Use the correct collection path based on branch context
      const actualCollectionPath = supplier.branchId
        ? `branches/${supplier.branchId}/suppliers`
        : 'suppliers';
      const docRef = doc(firestore, actualCollectionPath, supplier.id);
      await deleteDoc(docRef);

      toast({
        variant: 'success',
        title: 'Supplier Deleted',
        description: `"${supplier.name}" has been removed.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Supplier',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!supplier) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the supplier{' '}
            <span className="font-bold">{supplier.name}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
            disabled={isLoading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Yes, delete supplier
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
