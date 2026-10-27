
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  getDocs,
  writeBatch,
  doc,
} from 'firebase/firestore';
import type { Menu } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitCompareArrows } from 'lucide-react';
import { Label } from '../ui/label';

interface SyncMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceMenu: Menu;
  allMenus: Menu[];
  onSuccess: () => void;
}

export function SyncMenuDialog({
  open,
  onOpenChange,
  sourceMenu,
  allMenus,
  onSuccess,
}: SyncMenuDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [targetMenuId, setTargetMenuId] = React.useState<string | null>(null);

  const handleSync = async () => {
    if (!firestore || !targetMenuId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a target menu.',
      });
      return;
    }
    setIsSyncing(true);

    try {
      const batch = writeBatch(firestore);

      // 1. Get all items and categories from source menu
      const sourceItemsQuery = query(collection(firestore, `menus/${sourceMenu.id}/items`));
      const sourceCategoriesQuery = query(collection(firestore, `menus/${sourceMenu.id}/categories`));

      const [sourceItemsSnapshot, sourceCategoriesSnapshot] = await Promise.all([
        getDocs(sourceItemsQuery),
        getDocs(sourceCategoriesQuery),
      ]);
      const sourceItems = sourceItemsSnapshot.docs.map(doc => ({ ...doc.data() }));
      const sourceCategories = sourceCategoriesSnapshot.docs.map(doc => ({ ...doc.data() }));

      // 2. Get all items and categories from target menu to check for duplicates
      const targetItemsQuery = query(collection(firestore, `menus/${targetMenuId}/items`));
      const targetCategoriesQuery = query(collection(firestore, `menus/${targetMenuId}/categories`));

      const [targetItemsSnapshot, targetCategoriesSnapshot] = await Promise.all([
        getDocs(targetItemsQuery),
        getDocs(targetCategoriesQuery),
      ]);
      const targetItemNames = new Set(targetItemsSnapshot.docs.map(doc => doc.data().name.toLowerCase()));
      const targetCategoryNames = new Set(targetCategoriesSnapshot.docs.map(doc => doc.data().name.toLowerCase()));

      // 3. Filter for only new items and categories
      const newItemsToAdd = sourceItems.filter(item => !targetItemNames.has(item.name.toLowerCase()));
      const newCategoriesToAdd = sourceCategories.filter(cat => !targetCategoryNames.has(cat.name.toLowerCase()));

      if (newItemsToAdd.length === 0 && newCategoriesToAdd.length === 0) {
        toast({
          title: 'No New Items to Sync',
          description: 'The target menu is already up-to-date with all items and categories from the source menu.',
        });
        setIsSyncing(false);
        onOpenChange(false);
        return;
      }

      // 4. Add only the new items and categories to the batch
      newItemsToAdd.forEach((itemData) => {
        const newItemRef = doc(collection(firestore, `menus/${targetMenuId}/items`));
        batch.set(newItemRef, itemData);
      });

      newCategoriesToAdd.forEach((catData) => {
        const newCatRef = doc(collection(firestore, `menus/${targetMenuId}/categories`));
        batch.set(newCatRef, catData);
      });

      await batch.commit();

      toast({
        variant: 'success',
        title: 'Menu Synced Successfully',
        description: `Added ${newItemsToAdd.length} new item(s) and ${newCategoriesToAdd.length} new category(s) to the target menu.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Menu: {sourceMenu.name}</DialogTitle>
          <DialogDescription>
            Copy all new items and categories from <strong>{sourceMenu.name}</strong> to another menu. Existing items with the same name will be skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="target-menu">Target Menu</Label>
                 <Select onValueChange={setTargetMenuId} disabled={isSyncing}>
                    <SelectTrigger id="target-menu">
                        <SelectValue placeholder="Select a menu to sync to..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allMenus.filter(m => m.id !== sourceMenu.id).map(menu => (
                            <SelectItem key={menu.id} value={menu.id}>
                                {menu.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSyncing}>
            Cancel
          </Button>
          <Button onClick={handleSync} loading={isSyncing} disabled={!targetMenuId}>
            <GitCompareArrows className="mr-2 h-4 w-4" />
            Confirm Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
