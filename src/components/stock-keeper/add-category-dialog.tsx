
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function AddCategoryDialog({ open, onOpenChange, onCategoryAdded }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryAdded: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name.trim()) {
        toast({ variant: 'destructive', title: 'Category name cannot be empty.' });
        return;
    }
    setIsSaving(true);
    const success = await onCategoryAdded(name);
    setIsSaving(false);
    if (success) {
        onOpenChange(false);
        setName('');
    }
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Create New Category</DialogTitle>
                  <DialogDescription>
                      Add a new category to organize your stock items.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                  <Label htmlFor="category-name">Category Name</Label>
                  <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Soft Drinks" />
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button onClick={handleSubmit} loading={isSaving}>Create</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
  )
}
