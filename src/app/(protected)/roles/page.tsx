
'use client';

import * as React from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  orderBy,
  writeBatch,
  getDocs,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, MoreHorizontal, Edit, Trash2, UserPlus, Users, PowerOff, Power, RefreshCw, Copy } from 'lucide-react';
import type { Role, UserProfile } from '@/lib/types';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from "@/components/ui/badge"
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TopHeader } from '@/components/top-header';
import { useBranch } from '@/contexts/branch-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


function RoleCard({
  role,
  users,
  onOpenActions,
  onToggleStatus,
  onResavePermissions,
  branches,
}: {
  role: Role;
  users: UserProfile[];
  onOpenActions: (role: Role) => void;
  onToggleStatus: (staff: UserProfile) => void;
  onResavePermissions: (role: Role) => void;
  branches: any[];
}) {
  const permissionsCount = role.permissions?.length || 0;
  const assignedUsers = users.filter(user => user.role === role.name);
  const applicableBranchNames = role.isGlobalRole
    ? []
    : role.applicableBranches?.map(id => branches.find(b => b.id === id)?.name).filter(Boolean) || [];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>{role.name}</CardTitle>
            {role.isGlobalRole && (
              <Badge variant="default" className="mt-2">Global Role</Badge>
            )}
            {applicableBranchNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {applicableBranchNames.map(name => (
                  <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => onOpenActions(role)}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>{role.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <h4 className="font-semibold text-sm mb-2">Permissions ({permissionsCount})</h4>
        <div className="flex flex-wrap gap-2">
          {role.permissions?.slice(0, 5).map(p => (
            <Badge key={p} variant="secondary">{p}</Badge>
          )) || <p className="text-xs text-muted-foreground">No permissions assigned.</p>}
          {permissionsCount > 5 && <Badge variant="outline">+{permissionsCount - 5} more</Badge>}
        </div>
      </CardContent>
       <CardFooter className="bg-muted/50 p-3 flex-col items-start gap-3">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h5 className="text-sm font-medium">Assigned Staff ({assignedUsers.length})</h5>
            </div>
            {assignedUsers.length > 0 && (
                <div className="flex items-center -space-x-2">
                    {assignedUsers.slice(0, 4).map(user => (
                        <Tooltip key={user.uid}>
                            <TooltipTrigger asChild>
                                <Avatar className="h-7 w-7 border-2 border-background">
                                    <AvatarImage src={user.photoURL || ''} alt={user.name} />
                                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent className="p-2">
                                <div className="text-center space-y-2">
                                    <p className="font-semibold">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                    <Button size="sm" variant="outline" className="h-7" onClick={() => onToggleStatus(user)}>
                                        <PowerOff className="mr-2 h-3 w-3"/>
                                        {(user as any).isActive ? 'Disable Account' : 'Enable Account'}
                                    </Button>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                    {assignedUsers.length > 4 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar className="h-7 w-7 border-2 border-background">
                                    <AvatarFallback>+{assignedUsers.length - 4}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>...and {assignedUsers.length - 4} more</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )}
        </div>
         <Button size="sm" className="w-full" onClick={() => onResavePermissions(role)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Resave Staff Permissions
        </Button>
       </CardFooter>
    </Card>
  );
}

function RolesPage() {
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { branches } = useBranch();
  const [staffToToggle, setStaffToToggle] = React.useState<UserProfile | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const [isResaving, setIsResaving] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const [actionsRole, setActionsRole] = React.useState<Role | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const [showCloneDialog, setShowCloneDialog] = React.useState(false);
  const [cloneNewName, setCloneNewName] = React.useState('');
  const [isCloning, setIsCloning] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const CONFIRM_DELETE_TEXT = "DELETE";

  const rolesQuery = React.useMemo(
    () => (firestore ? query(collection(firestore, 'roles'), orderBy('name')) : null),
    [firestore, reloadCounter]
  );
  const { data: roles, isLoading: areRolesLoading } = useCollection<Role>(rolesQuery);

  const usersQuery = React.useMemo(
    () => (firestore ? query(collection(firestore, 'users')) : null),
    [firestore, reloadCounter]
  );
  const { data: users, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const handleOpenActions = (role: Role) => {
    setActionsRole(role);
  };

  const handleCloneRole = async () => {
    if (!firestore || !actionsRole || !cloneNewName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a name for the new role.' });
      return;
    }

    setIsCloning(true);
    try {
      // Create new role data based on existing role
      const newRoleData = {
        name: cloneNewName.trim(),
        description: `${actionsRole.description} (Cloned)`,
        permissions: [...(actionsRole.permissions || [])],
        isGlobalRole: actionsRole.isGlobalRole || false,
        applicableBranches: actionsRole.isGlobalRole ? [] : [...(actionsRole.applicableBranches || [])],
        createdAt: serverTimestamp(),
      };

      // Add the new role to Firestore
      const rolesCollection = collection(firestore, 'roles');
      await addDoc(rolesCollection, newRoleData);

      toast({
        variant: 'success',
        title: 'Role Cloned',
        description: `"${actionsRole.name}" has been cloned as "${cloneNewName}".`
      });

      // Reset and close dialogs
      setShowCloneDialog(false);
      setCloneNewName('');
      setActionsRole(null);
      setReloadCounter(prev => prev + 1);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to clone role.'
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleModalClose = () => {
    setActionsRole(null);
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (!firestore || !actionsRole || isDeleting) return;
    const activeUsersInRole = (users || []).filter(user => user.role === actionsRole.name && (user as any).isActive);

    if (activeUsersInRole.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete Role',
        description: `This role is assigned to ${activeUsersInRole.length} active staff member(s). Please reassign or disable them first.`,
        duration: 8000,
      });
      handleModalClose();
      return;
    }

    setIsDeleting(true);

    try {
      await deleteDoc(doc(firestore, 'roles', actionsRole.id));
      toast({
        variant: 'success',
        title: 'Role Deleted',
        description: `The role "${actionsRole.name}" has been permanently removed.`,
      });
      handleModalClose();
      setReloadCounter(c => c + 1);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Role',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!firestore || !staffToToggle) return;

    setIsTogglingStatus(true);
    const userRef = doc(firestore, 'users', staffToToggle.uid);
    const newStatus = !(staffToToggle as any).isActive;

    try {
        await updateDoc(userRef, { isActive: newStatus });
        toast({
            variant: 'success',
            title: 'Status Updated',
            description: `${staffToToggle.name}'s account has been ${newStatus ? 'activated' : 'disabled'}.`
        });
        setReloadCounter(c => c + 1);
    } catch(error: any) {
        toast({
            variant: 'destructive',
            title: 'Error Updating Status',
            description: error.message
        });
    } finally {
        setIsTogglingStatus(false);
        setStaffToToggle(null);
    }
  }

  const handleResavePermissions = async (role: Role) => {
    if (!firestore || !users) return;

    setIsResaving(true);
    toast({ title: 'Syncing Permissions...', description: `Applying "${role.name}" permissions to all assigned staff.` });

    const assignedUsers = users.filter(user => user.role === role.name);

    if (assignedUsers.length === 0) {
        toast({ variant: 'default', title: 'No Staff to Update', description: `No staff members are currently assigned the "${role.name}" role.` });
        setIsResaving(false);
        return;
    }

    try {
        const batch = writeBatch(firestore);
        assignedUsers.forEach(user => {
            const userRef = doc(firestore, 'users', user.uid);
            batch.update(userRef, { permissions: role.permissions || [] });
        });
        await batch.commit();

        toast({ variant: 'success', title: 'Permissions Synced', description: `Successfully updated permissions for ${assignedUsers.length} staff member(s).` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
    } finally {
        setIsResaving(false);
    }
  };


  const isLoading = areRolesLoading || areUsersLoading;


  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <TopHeader name="Roles & Permissions" icon={<Shield />} />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
                <Link href="/staff">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Manage Staff
                </Link>
            </Button>
            <Button asChild>
                <Link href="/roles/create">
                    <Plus className="mr-2 h-4 w-4" /> New Role
                </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        ) : roles && roles.length > 0 && users ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
                <RoleCard
                key={role.id}
                role={role}
                users={users}
                onOpenActions={handleOpenActions}
                onToggleStatus={setStaffToToggle}
                onResavePermissions={handleResavePermissions}
                branches={branches}
                />
            ))}
            </div>
        ) : (
            <EmptyState
                icon={Shield}
                title="No Roles Defined"
                description="Get started by creating a role for your staff."
                className="py-20"
            >
                <Button asChild className="mt-4">
                    <Link href="/roles/create">
                        <Plus className="mr-2 h-4 w-4" /> Create First Role
                    </Link>
                </Button>
            </EmptyState>
        )}
      </div>

      <Dialog open={!!actionsRole} onOpenChange={handleModalClose}>
        <DialogContent>
          {actionsRole && (
            <>
              <DialogHeader>
                  <DialogTitle>{showDeleteConfirm ? 'Confirm Deletion' : `Actions for "${actionsRole.name}"`}</DialogTitle>
                  {!showDeleteConfirm && <DialogDescription>{actionsRole.description || 'No description available.'}</DialogDescription>}
              </DialogHeader>

              {showCloneDialog ? (
                <div className="py-4 space-y-4">
                  <DialogDescription>
                    Create a copy of "{actionsRole.name}" with all its permissions and settings. Give it a new name to get started.
                  </DialogDescription>
                  <div>
                    <Label htmlFor="clone-name" className="font-semibold">New Role Name</Label>
                    <Input
                      id="clone-name"
                      placeholder="e.g., Branch Manager Copy"
                      value={cloneNewName}
                      onChange={(e) => setCloneNewName(e.target.value)}
                      autoComplete="off"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      The new role will have: {actionsRole.isGlobalRole ? 'Global access' : `Access to ${actionsRole.applicableBranches?.length || 0} branch(es)`}
                    </p>
                  </div>
                </div>
              ) : !showDeleteConfirm && !showCloneDialog ? (
                <div className="grid gap-3 py-4">
                  <Button variant="outline" asChild>
                    <Link href={`/roles/edit?id=${actionsRole.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Role
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setShowCloneDialog(true)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone Role
                  </Button>
                  <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Role
                  </Button>
                </div>
              ) : (
                <div className="py-4 space-y-4">
                  <DialogDescription>
                      This action cannot be undone. This will permanently delete the role "{actionsRole.name}".
                  </DialogDescription>
                  <div>
                    <Label htmlFor="delete-confirm" className="text-destructive font-semibold">Type "{CONFIRM_DELETE_TEXT}" to confirm.</Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                {showCloneDialog ? (
                  <>
                    <Button variant="ghost" onClick={() => {
                      setShowCloneDialog(false);
                      setCloneNewName('');
                    }}>Cancel</Button>
                    <Button
                      onClick={handleCloneRole}
                      disabled={!cloneNewName.trim() || isCloning}
                      loading={isCloning}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Clone Role
                    </Button>
                  </>
                ) : !showDeleteConfirm ? (
                  <Button variant="ghost" onClick={handleModalClose}>Close</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Go Back</Button>
                    <Button
                      variant="destructive"
                      onClick={confirmDelete}
                      disabled={deleteConfirmText !== CONFIRM_DELETE_TEXT || isDeleting}
                      loading={isDeleting}
                    >
                      Confirm Deletion
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

       {staffToToggle && (
        <AlertDialog open={!!staffToToggle} onOpenChange={() => setStaffToToggle(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to {(staffToToggle as any).isActive ? 'disable' : 'activate'} the account for <span className="font-bold">{staffToToggle.name}</span>?
                        {(staffToToggle as any).isActive && " Disabling the account will prevent them from logging in."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isTogglingStatus}>Cancel</AlertDialogCancel>
                    <Button onClick={handleToggleStatus} loading={isTogglingStatus}>
                        Confirm
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export default withAuth(RolesPage, PagePermission.MANAGE_ROLES);
