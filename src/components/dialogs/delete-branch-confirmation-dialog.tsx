'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteBranchConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  branchName: string;
  isDeleting: boolean;
}

export function DeleteBranchConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  branchName,
  isDeleting,
}: DeleteBranchConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const isConfirmDisabled = confirmText !== 'delete';

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmText('');
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Branch</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the branch "{branchName}"?
            This action cannot be undone and all data associated with this branch will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm font-medium">
              Type <span className="font-bold text-destructive">delete</span> to confirm:
            </Label>
            <Input
              id="confirm-text"
              placeholder="Type 'delete' to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isConfirmDisabled && !isDeleting) {
                  onConfirm();
                }
              }}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isConfirmDisabled || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
