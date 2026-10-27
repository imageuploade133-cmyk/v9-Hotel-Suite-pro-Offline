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
import type { UserProfile } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { useUser } from '@/contexts/user-context';

interface DeleteStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: UserProfile | null;
  onSuccess: () => void;
}

export function DeleteStaffDialog({ open, onOpenChange, staffMember, onSuccess }: DeleteStaffDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const handleDelete = async () => {
    if (!firestore || !staffMember) return;
    if (staffMember.uid === user?.uid) {
        toast({
            variant: 'destructive',
            title: "Action Prohibited",
            description: "You cannot delete your own account."
        });
        return;
    }

    setIsDeleting(true);

    try {
      // Note: Deleting a user from Firebase Auth requires admin privileges
      // and cannot be done from the client-side SDK for security reasons.
      // This will only delete the user's profile from Firestore.
      await deleteDoc(doc(firestore, 'users', staffMember.uid));

      toast({
        variant: 'success',
        title: 'Staff Member Deleted',
        description: `"${staffMember.name}" has been removed from the database.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Staff Member',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!staffMember) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the staff account for {' '}
            <span className="font-bold">{staffMember.name}</span>.
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
            Yes, delete staff
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
