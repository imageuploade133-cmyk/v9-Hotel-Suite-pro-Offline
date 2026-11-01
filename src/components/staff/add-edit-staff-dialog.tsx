
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Loader2, User, Mail, Shield, KeyRound, EyeOff, Eye, Phone, DollarSign, Sunrise, Sunset } from 'lucide-react';
import type { UserProfile, Role } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, updateDoc, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useAuth } from '../auth/auth-provider';
import { PERMISSION_GROUPS, PagePermission, DEFAULT_SYSTEM_ROLES } from '@/lib/permissions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BottomSheet } from '../ui/bottom-sheet';
import { ScrollArea } from '../ui/scroll-area';
import { useUser } from '@/contexts/user-context';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useBranch } from '@/contexts/branch-context';
import { Checkbox } from '../ui/checkbox';


const staffSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phoneNumber: z.string().optional(),
  accountType: z.enum(['Admin', 'Staff']),
  roleId: z.string().optional(),
  shift: z.enum(['Morning', 'Night', '24hrs']).optional(),
  password: z.string().optional(),
  monthlySalary: z.coerce.number().min(0, "Salary must be non-negative.").optional(),
  assignedBranches: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
    if (data.accountType === 'Staff' && !data.roleId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['roleId'],
            message: 'A role must be selected for Staff accounts.'
        })
    }
    if (data.accountType === 'Staff' && !data.shift) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['shift'],
            message: 'A shift must be assigned to Staff accounts.'
        })
    }
});

type StaffFormValues = z.infer<typeof staffSchema>;

interface AddEditStaffFormFieldsProps {
    form: ReturnType<typeof useForm<StaffFormValues>>;
    isEditMode: boolean;
}

function AddEditStaffFormFields({ form, isEditMode }: AddEditStaffFormFieldsProps) {
    const [showPassword, setShowPassword] = React.useState(false);
    const firestore = useFirestore();
    const { branches } = useBranch();

    const rolesQuery = React.useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'roles'));
    }, [firestore]);
    const { data: fetchedRoles } = useCollection<Role>(rolesQuery);
    const roles = (fetchedRoles && fetchedRoles.length > 0) ? fetchedRoles : (DEFAULT_SYSTEM_ROLES as Role[]);

    const accountType = form.watch('accountType');

    return (
        <Form {...form}>
          <form id="staff-form" className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl><Input placeholder="John Doe" className="pl-10" {...field} /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl><Input type="email" placeholder="name@example.com" className="pl-10" {...field} disabled={isEditMode} /></FormControl>
                  </div>
                  {isEditMode && <FormDescription className="text-xs">Email cannot be changed after creation.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl><Input type="tel" placeholder="+123456789" className="pl-10" {...field} value={field.value || ''} /></FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator/>
            <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Account Type</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                                <FormItem>
                                    <FormControl>
                                        <RadioGroupItem value="Staff" id="type-staff" className="sr-only peer" />
                                    </FormControl>
                                    <FormLabel htmlFor="type-staff" className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors", "peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary")}>
                                        Staff
                                    </FormLabel>
                                </FormItem>
                                <FormItem>
                                    <FormControl>
                                        <RadioGroupItem value="Admin" id="type-admin" className="sr-only peer" />
                                    </FormControl>
                                    <FormLabel htmlFor="type-admin" className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors", "peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary")}>
                                        Admin
                                    </FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                    </FormItem>
                )}
            />

            {accountType && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Role {accountType === 'Admin' ? '(Optional - leave empty for full admin access)' : '(Optional)'}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select a role" />
                            </div>
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no-role">{accountType === 'Admin' ? 'Full Admin Access' : 'No Role'}</SelectItem>
                          {roles?.map(role => (
                              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                    {accountType === 'Admin' && (!field.value || field.value === 'no-role') ? (
                        <FormDescription className="text-xs text-amber-600">Admin without a role gets FULL access to all features.</FormDescription>
                    ) : (
                        <FormDescription className="text-xs text-destructive">If no role is selected, the staff member can't log in but will be available for salary calculations.</FormDescription>
                    )}
                    <FormMessage />
                    </FormItem>
                )}
                />
                {accountType === 'Staff' && (
                <FormField
                    control={form.control}
                    name="shift"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <div className="flex items-center gap-2">
                                <Sunrise className="h-4 w-4 text-muted-foreground" />
                                <Sunset className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Assign a shift" />
                              </div>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="Morning">Morning Shift</SelectItem>
                              <SelectItem value="Night">Night Shift</SelectItem>
                              <SelectItem value="24hrs">24 Hours</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <FormField
                control={form.control}
                name="monthlySalary"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Monthly Salary (Optional)</FormLabel>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <FormControl><Input type="number" placeholder="Enter monthly salary" className="pl-10" {...field} value={field.value || ''} /></FormControl>
                    </div>
                    <FormDescription>The system will calculate the daily rate based on this salary and the configured payday.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <Separator />
            <FormField
              control={form.control}
              name="assignedBranches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Branches</FormLabel>
                  <FormDescription>
                    Select which branches this staff member can access. Leave empty to give access to all branches (Admin only).
                  </FormDescription>
                  <div className="space-y-2 mt-3 pb-6">
                    {branches && branches.length > 0 ? (
                      branches.map((branch) => (
                        <div key={branch.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`branch-${branch.id}`}
                            checked={field.value?.includes(branch.id) || false}
                            onCheckedChange={(checked) => {
                              const newValue = field.value || [];
                              if (checked) {
                                field.onChange([...newValue, branch.id]);
                              } else {
                                field.onChange(newValue.filter((id: string) => id !== branch.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`branch-${branch.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {branch.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No branches available</p>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditMode && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Password</FormLabel>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter a strong password"
                          className="pl-10"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
    );
}

interface AddEditStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: UserProfile | null;
  onSuccess: () => void;
}

export function AddEditStaffDialog({ open, onOpenChange, staffMember, onSuccess }: AddEditStaffDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const isEditMode = !!staffMember;
  const isMobile = useIsMobile();
  // All Firebase users have full admin access
  const canManageStaff = true;
  const formId = "staff-form-dialog";

  const rolesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roles'));
  }, [firestore]);
  const { data: roles } = useCollection<Role>(rolesQuery);

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', email: '', roleId: '', accountType: 'Staff', monthlySalary: 0, shift: 'Morning' },
  });

  React.useEffect(() => {
    if (open) {
      if (staffMember) {
        const role = roles?.find(r => r.name === staffMember.role);
        const accountType = staffMember.role === 'Admin' ? 'Admin' : 'Staff';
        form.reset({
          name: staffMember.name,
          email: staffMember.email,
          phoneNumber: staffMember.phoneNumber ?? '',
          accountType: accountType,
          roleId: role?.id || 'no-role',
          monthlySalary: staffMember.monthlySalary || 0,
          shift: staffMember.shift || 'Morning',
          assignedBranches: staffMember.assignedBranches || [],
        });
      } else {
        form.reset({ name: '', email: '', roleId: 'no-role', password: '', accountType: 'Staff', phoneNumber: '', monthlySalary: 0, shift: 'Morning', assignedBranches: [] });
      }
    }
  }, [open, staffMember, form, roles]);

  const onSubmit = async (data: StaffFormValues) => {
    if (!canManageStaff) {
        toast({ variant: 'destructive', title: 'Permission Denied' });
        return;
    }
    setIsSaving(true);
    try {
      if (isEditMode && staffMember) {
        if (!firestore) throw new Error("Database not connected.");
        const userRef = doc(firestore, 'users', staffMember.uid);

        let newRoleName = data.accountType === 'Admin' ? 'Admin' : 'Staff';
        let newPermissions: string[] = [];

        // For Staff account type, always use role permissions
        // For Admin account type, only give full permissions if no role is selected
        // If Admin selects a specific role, use that role's permissions (not full admin)
        if (data.roleId && data.roleId !== 'no-role') {
            const role = roles?.find(r => r.id === data.roleId);
            if (!role) throw new Error("Selected role not found.");
            newRoleName = role.name;
            newPermissions = role.permissions || [];
        } else if (data.accountType === 'Admin') {
            // Admin with no role selected gets full permissions
            newPermissions = PERMISSION_GROUPS.flatMap(group => group.permissions.map(p => p.id));
        } else {
            // Staff with no role selected gets no permissions
            newRoleName = 'Staff (No Role)';
            newPermissions = [];
        }

        await updateDoc(userRef, {
            name: data.name,
            phoneNumber: data.phoneNumber || null,
            role: newRoleName,
            permissions: newPermissions,
            monthlySalary: data.monthlySalary || 0,
            shift: data.accountType === 'Staff' ? data.shift : null,
            assignedBranches: data.assignedBranches || [],
        });

        toast({ variant: 'success', title: 'Staff Updated' });
        onSuccess();
      } else {
        if (!auth.user) throw new Error("Authentication service not available.");
        if (!data.password) {
            form.setError('password', { message: 'Password is required for new staff.' });
            setIsSaving(false);
            return;
        }

        let newUid = '';
        let createdOnline = false;

        try {
          if (auth.auth && navigator.onLine) {
            const userCredential = await createUserWithEmailAndPassword(auth.auth, data.email, data.password);
            const newUser = userCredential.user;
            newUid = newUser.uid;
            await updateProfile(newUser, { displayName: data.name, photoURL: null });
            createdOnline = true;
          } else {
            newUid = `offline_user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          }
        } catch (authError: any) {
          if (authError.code === 'auth/network-request-failed' || !navigator.onLine) {
            newUid = `offline_user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            console.warn('[Offline Mode] Network request failed. Registering staff account locally on Master PC.');
          } else {
            throw authError;
          }
        }

        if (!firestore) throw new Error("Database not connected.");

        let roleName = 'Staff (No Role)';
        let permissions: string[] = [];
        let isActive = false;

        if (data.roleId && data.roleId !== 'no-role') {
            const role = roles?.find(r => r.id === data.roleId);
            if (!role) throw new Error("Selected role not found.");
            roleName = role.name;
            permissions = role.permissions || [];
            isActive = true;
        } else if (data.accountType === 'Admin') {
            roleName = 'Admin';
            permissions = PERMISSION_GROUPS.flatMap(group => group.permissions.map(p => p.id));
            isActive = true;
        }

        const userProfile = {
          uid: newUid,
          name: data.name,
          email: data.email,
          role: roleName,
          photoURL: null,
          monthlySalary: data.monthlySalary || 0,
          shift: data.accountType === 'Staff' ? data.shift : null,
          isActive: isActive,
          permissions: permissions,
          assignedBranches: data.assignedBranches || [],
          pendingCloudAuthSync: !createdOnline,
          createdAt: serverTimestamp()
        };

        // Save staff profile in Firestore / Local Cache
        await setDoc(doc(firestore, 'users', newUid), userProfile);

        // Record mutation in Local Master Store for zero-delay LAN sync & background Cloud backup
        try {
          await fetch('/api/lan-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectionName: 'users',
              docId: newUid,
              action: 'set',
              data: {
                ...userProfile,
                pendingPasswordSync: data.password,
              },
            }),
          });
        } catch {
          // Saved locally in IndexedDB & LAN Store
        }

        toast({
          variant: 'success',
          title: createdOnline ? 'Staff Created' : 'Staff Created (Offline Mode)',
          description: createdOnline
            ? `Successfully created staff user ${data.name}.`
            : `Staff account ${data.name} saved locally. Will sync to Cloud Firestore when internet is connected.`
        });
        onSuccess();
      }
      onOpenChange(false);
    } catch (error: any) {
      let errorMessage = error.message || 'An unexpected error occurred.';
      if (error.code === 'auth/email-already-in-use') {
          errorMessage = 'This email address is already registered.';
      } else if (error.code === 'auth/weak-password') {
          errorMessage = 'The password is too weak. Please use at least 6 characters.';
      }
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDialog = () => {
    form.reset();
    onOpenChange(false);
  }

  const dialogTitle = isEditMode ? 'Edit' : 'Invite';
  const dialogDesc = isEditMode ? "Update the staff member's details." : "Create a new staff account and assign a role.";

  const renderContent = () => {
    if (!canManageStaff) {
        return (
            <Alert variant="destructive">
                <Shield-Alert className="h-4 w-4" />
                <AlertTitle>Permission Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to manage staff. Please contact an administrator.
                </AlertDescription>
            </Alert>
        )
    }
    if (isMobile) {
        return (
            <BottomSheet open={open} onOpenChange={handleCloseDialog}>
                <div className="p-4 flex flex-col h-full">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold">{dialogTitle} Staff Member</h2>
                        <p className="text-sm text-muted-foreground">{dialogDesc}</p>
                    </div>
                    <ScrollArea className="flex-1 -mx-4">
                        <div className="px-4">
                            <AddEditStaffFormFields form={form} isEditMode={isEditMode} />
                        </div>
                    </ScrollArea>
                    <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                        <Button type="button" variant="ghost" onClick={handleCloseDialog} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" form="staff-form" loading={isSaving} onClick={form.handleSubmit(onSubmit)}>
                            {isEditMode ? 'Save Changes' : 'Create Staff Member'}
                        </Button>
                    </div>
                </div>
            </BottomSheet>
        );
    }
    return (
        <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>{dialogTitle} Staff Member</DialogTitle>
            <DialogDescription>{dialogDesc}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] -mx-6 px-6 flex-1 min-h-0">
                <AddEditStaffFormFields form={form} isEditMode={isEditMode} />
            </ScrollArea>
            <DialogFooter>
            <Button variant="ghost" onClick={handleCloseDialog} disabled={isSaving}>Cancel</Button>
            <Button type="submit" form={formId} loading={isSaving} onClick={form.handleSubmit(onSubmit)}>
                {isEditMode ? 'Save Changes' : 'Create Staff Member'}
            </Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>
    );
  }

  return renderContent();
}
