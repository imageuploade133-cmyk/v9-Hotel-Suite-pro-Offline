'use client';

import * as React from 'react';
import { Users, Plus, Shield } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { StaffList } from '@/components/staff/staff-list';
import type { UserProfile } from '@/lib/types';
import { AddEditStaffDialog } from '@/components/staff/add-edit-staff-dialog';
import { DeleteStaffDialog } from '@/components/staff/delete-staff-dialog';
import { ViewStaffSalaryDialog } from '@/components/staff/view-staff-salary-dialog';
import Link from 'next/link';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { TopHeader } from '@/components/top-header';

function StaffPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [staffToToggle, setStaffToToggle] = React.useState<UserProfile | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);

  const [selectedStaff, setSelectedStaff] = React.useState<UserProfile | null>(null);
  const [staffToViewSalary, setStaffToViewSalary] = React.useState<UserProfile | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSuccess = () => {
    setReloadCounter(prev => prev + 1);
  };

  const handleEdit = (staff: UserProfile) => {
    setSelectedStaff(staff);
    setIsFormOpen(true);
  };

  const handleDelete = (staff: UserProfile) => {
    setSelectedStaff(staff);
    setIsDeleteOpen(true);
  };

  const handleViewSalary = (staff: UserProfile) => {
    setStaffToViewSalary(staff);
  };

  const handleConfirmToggleStatus = async () => {
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
        handleSuccess();
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

  const handleCloseDialogs = () => {
    setSelectedStaff(null);
    setStaffToToggle(null);
    setStaffToViewSalary(null);
    setIsFormOpen(false);
    setIsDeleteOpen(false);
  };


  return (
    <>
      <div className="flex h-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <TopHeader name="Staff Management" icon={<Users className="h-10 w-10" />} />
        </div>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Staff List</CardTitle>
                        <CardDescription>A list of all staff members in your hotel.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/roles">
                           <Button asChild variant="outline">
                                <div>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Manage Roles
                                </div>
                            </Button>
                        </Link>
                        <Button onClick={() => { setSelectedStaff(null); setIsFormOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            Invite New Staff
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <StaffList
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleStatus={setStaffToToggle}
                  onViewSalary={handleViewSalary}
                  reloadCounter={reloadCounter}
                />
            </CardContent>
        </Card>
      </div>

      <AddEditStaffDialog
        open={isFormOpen}
        onOpenChange={handleCloseDialogs}
        onSuccess={handleSuccess}
        staffMember={selectedStaff}
      />

       {selectedStaff && (
        <DeleteStaffDialog
          open={isDeleteOpen}
          onOpenChange={handleCloseDialogs}
          staffMember={selectedStaff}
          onSuccess={handleSuccess}
        />
      )}

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
                    <Button onClick={handleConfirmToggleStatus} loading={isTogglingStatus}>
                        Confirm
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      <ViewStaffSalaryDialog
        isOpen={!!staffToViewSalary}
        onClose={() => setStaffToViewSalary(null)}
        staff={staffToViewSalary}
      />
    </>
  );
}

export default withAuth(StaffPage, PagePermission.MANAGE_STAFF);