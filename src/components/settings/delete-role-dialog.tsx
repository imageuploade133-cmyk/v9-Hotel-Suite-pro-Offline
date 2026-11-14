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
import { useToast } from '@/hooks/use-toast';
import type { Role } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Button } from '../ui/button';
import { useUser } from '@/contexts/user-context';
import { logAuditEvent } from '@/lib/audit-log';

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}

export function DeleteRoleDialog({ open, onOpenChange, role }: DeleteRoleDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot delete role.'});
      return;
    }
    setIsDeleting(true);
    try {
      const roleRef = doc(firestore, 'roles', role.id);
      await deleteDoc(roleRef);
      void logAuditEvent(firestore, {
        action: 'Delete', module: 'Staff', entityType: 'Role', entityId: role.id, entityName: role.name,
        userId: user?.uid || userProfile?.uid || userProfile?.id || '', userName: userProfile?.name || user?.email || 'Unknown user',
        userEmail: userProfile?.email || user?.email || '', userRole: userProfile?.role || '',
        description: `Deleted staff role "${role.name}"`,
        details: { permissions: role.permissions || [], isGlobalRole: role.isGlobalRole || false },
        collectionName: 'roles', documentId: role.id,
      });

      toast({
        variant: 'success',
        title: 'Role Deleted',
        description: `The role "${role.name}" has been permanently removed.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting role',
        description: error.message || 'An unexpected error occurred. Make sure no staff members are assigned this role.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the role{' '}
            <span className="font-bold">{role.name}</span>. Staff members assigned to this role will lose their permissions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={isDeleting}
          >
            Yes, delete role
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
