'use client';

import * as React from 'react';
import { commitLocalFirstMutations } from '@/lib/lan-sync/sync-helper';
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
import { useUser } from '@/contexts/user-context';
import { logAuditEvent } from '@/lib/audit-log';

interface DeleteStockItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: StockItem | null;
  onSuccess: () => void;
  stockCollection?: string;
}

export function DeleteStockItemDialog({ isOpen, onClose, item, onSuccess, stockCollection = 'stock' }: DeleteStockItemDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, userProfile } = useUser();

  const handleDelete = async () => {
    if (!firestore || !item) return;

    setIsDeleting(true);

    try {
      // In global mode, items may belong to different branches. Use the item's actual branchId
      // to determine the correct collection path for deleting.
      const actualCollectionPath = item.branchId
          ? `branches/${item.branchId}/stock`
          : stockCollection;
      const itemRef = doc(firestore, actualCollectionPath, item.id);
      await commitLocalFirstMutations([{ collectionName: actualCollectionPath, docId: item.id, action: 'delete' }], `stock-item-delete:${item.id}:${Date.now()}`, () => deleteDoc(itemRef));
      void logAuditEvent(firestore, {
        action: 'Delete', module: 'Inventory', entityType: 'Stock Item',
        entityId: item.id, entityName: item.name,
        userId: user?.uid || userProfile?.uid || userProfile?.id || '',
        userName: userProfile?.name || user?.email || 'Unknown user',
        userEmail: userProfile?.email || user?.email || '', userRole: userProfile?.role || '',
        branchId: item.branchId || 'global',
        description: `Deleted inventory item "${item.name}"`,
        details: { quantity: item.quantity, costPrice: item.costPrice, sellingPrice: item.sellingPrice, category: item.category },
        collectionName: actualCollectionPath, documentId: item.id,
      });
      toast({
        variant: 'success',
        title: 'Item Deleted',
        description: `"${item.name}" has been removed from your inventory.`,
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
            This will permanently delete the stock item{' '}
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