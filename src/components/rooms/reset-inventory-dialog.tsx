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
import type { Room } from '@/lib/types';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResetInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  onConfirmReset: (room: Room) => void;
}

export function ResetInventoryDialog({
  open,
  onOpenChange,
  room,
  onConfirmReset,
}: ResetInventoryDialogProps) {
  const [isResetting, setIsResetting] = React.useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!room) return;
    setIsResetting(true);
    try {
      await onConfirmReset(room);
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong while resetting the inventory.',
      });
    } finally {
      setIsResetting(false);
      onOpenChange(false);
    }
  };

  if (!room) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will reset the inventory for{' '}
            <span className="font-bold">{room.name}</span>. The available rooms count will be set to the total, and booked rooms will be set to 0. All individual room statuses will be cleared and marked as "Vacant". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResetting}>Back</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isResetting}
            loading={isResetting}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Yes, Reset Inventory
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
