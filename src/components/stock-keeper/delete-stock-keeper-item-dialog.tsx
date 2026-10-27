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
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import type { StockItem } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { useBranch } from '@/contexts/branch-context';

interface DeleteStockKeeperItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockItem | null;
  onSuccess: () => void;
}

export function DeleteStockKeeperItemDialog({ isOpen, onClose, item, onSuccess }: DeleteStockKeeperItemDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { getCollectionPath } = useBranch();

  const stockKeeperItemsCollection = React.useMemo(() => {
    return getCollectionPath('stockKeeperItems');
  }, [getCollectionPath]);

  const handleDelete = async () => {
    if (!firestore || !item) return;

    setIsDeleting(true);

    try {
      // In global mode, items may belong to different branches. Use the item's actual branchId
      // to determine the correct collection path for deleting.
      const actualCollectionPath = item.branchId
          ? `branches/${item.branchId}/stockKeeperItems`
          : stockKeeperItemsCollection;
      await deleteDoc(doc(firestore, actualCollectionPath, item.id));
      toast({
        variant: 'success',
        title: 'Item Deleted',
        description: `"${item.name}" has been removed from staging.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Item',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!item) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the staged item{' '}
            <span className="font-bold">{item?.name}</span>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Yes, delete item
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
