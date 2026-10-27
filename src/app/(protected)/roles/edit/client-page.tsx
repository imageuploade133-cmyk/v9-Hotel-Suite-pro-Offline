
'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  where,
  getDocs,
  updateDoc,
  query,
} from 'firebase/firestore';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Info, Redo } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import type { Role } from '@/lib/types';
import { PagePermission, STANDALONE_PERMISSIONS } from '@/lib/permissions';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/user-context';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_TEMPLATES } from '@/lib/role-templates';
import { Separator } from '@/components/ui/separator';
import { useBranch } from '@/contexts/branch-context';
import { getAvailablePermissions } from '@/lib/permission-categories';
import withAuth from '@/components/auth/withAuth';

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isGlobalRole: z.boolean().default(false),
  applicableBranches: z.array(z.string()).optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

function EditRolePageContent({ role }: { role: Role }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const { userProfile, dynamicPermissionGroups: contextDynamicGroups } = useUser();
    const { branches } = useBranch();

    const dynamicPermissionGroups = useMemo(() => contextDynamicGroups, [contextDynamicGroups]);
    const [openAccordions, setOpenAccordions] = React.useState<string[]>([]);

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: role.name || '',
            description: role.description || '',
            permissions: role.permissions || [],
            isGlobalRole: role.isGlobalRole || false,
            applicableBranches: role.applicableBranches || [],
        },
    });

    // Get filtered permissions based on role scope
    const isGlobalRole = form.watch('isGlobalRole');
    const applicableBranches = form.watch('applicableBranches');
    const availablePermissions = useMemo(() => getAvailablePermissions(isGlobalRole), [isGlobalRole]);

    // Filter permission groups to show only available permissions
    const filteredPermissionGroups = useMemo(() => {
        return dynamicPermissionGroups
            .map(group => ({
                ...group,
                permissions: group.permissions.filter((p: any) => {
                    // Always include custom status permissions (dynamic permissions like view:custom_status)
                    if (group.id === 'custom_statuses') {
                        return true;
                    }
                    return availablePermissions.includes(p.id);
                }),
            }))
            .filter((group: any) => group.permissions.length > 0);
    }, [dynamicPermissionGroups, availablePermissions]);

    React.useEffect(() => {
        if (role) {
            form.reset({
                name: role.name,
                description: role.description || '',
                permissions: role.permissions || [],
                isGlobalRole: role.isGlobalRole || false,
                applicableBranches: role.applicableBranches || [],
            });
            // Set initial open accordions based on existing permissions
            const initialOpen = dynamicPermissionGroups
                .filter(group => group.permissions.some(p => role.permissions?.includes(p.id)))
                .map(group => group.id);
            setOpenAccordions(initialOpen);
        }
     }, [role, form, dynamicPermissionGroups]);

    const onSubmit = async (values: RoleFormValues) => {
        if (!firestore || !userProfile || !role) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot save role.' });
            return;
        }
        setIsSaving(true);

        try {
            const batch = writeBatch(firestore);
            const roleRef = doc(firestore, 'roles', role.id);

            const dataToUpdate = {
                name: values.name,
                description: values.description,
                permissions: values.permissions,
                isGlobalRole: values.isGlobalRole || false,
                applicableBranches: values.isGlobalRole ? [] : (values.applicableBranches || []),
            };

            batch.update(roleRef, dataToUpdate as any);

            // --- Audit Log ---
            const changes = [];
            if (role.name !== dataToUpdate.name) {
                changes.push({ field: 'Name', before: role.name, after: dataToUpdate.name });
            }
            if ((role.description || '') !== (dataToUpdate.description || '')) {
                changes.push({ field: 'Description', before: role.description || 'Not set', after: dataToUpdate.description || 'Not set' });
            }
            const oldPerms = new Set(role.permissions);
            const newPerms = new Set(dataToUpdate.permissions);
            const added = [...newPerms].filter(p => !oldPerms.has(p));
            const removed = [...oldPerms].filter(p => !newPerms.has(p));

            if (added.length > 0) changes.push({ field: 'Permissions Added', before: '', after: added.join(', ') });
            if (removed.length > 0) changes.push({ field: 'Permissions Removed', before: removed.join(', '), after: '' });

            if (changes.length > 0) {
                const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
                batch.set(auditLogRef, {
                    timestamp: serverTimestamp(),
                    userId: userProfile.uid,
                    userName: userProfile.name,
                    changeType: 'Update',
                    entityType: 'Role',
                    entityId: role.id,
                    details: `Updated role: ${role.name}`,
                    changes,
                });
            }
            // --- End Audit Log ---

            // --- Update Staff & User Permissions ---
            const usersQuery = query(collection(firestore, 'users'), where('role', '==', role.name));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach(userDoc => {
                const userRef = doc(firestore, 'users', userDoc.id);
                batch.update(userRef, {
                    permissions: values.permissions,
                    ...(role.name !== values.name && { role: values.name })
                });
            });
            // --- End Update Staff & User Permissions ---

            await batch.commit();

            toast({ variant: 'success', title: 'Role Updated', description: `The "${values.name}" role has been updated. All staff with this role have been updated.` });
            router.push('/roles');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };

    const applyTemplate = (templateName: string) => {
        const template = ROLE_TEMPLATES.find(t => t.name === templateName);
        if (template) {
            form.setValue('permissions', template.permissions, { shouldDirty: true });

            const templatePerms = new Set(template.permissions);
            let groupsToOpen = dynamicPermissionGroups
                .filter(group => group.permissions.some((p: any) => templatePerms.has(p.id)))
                .map(group => group.id);

            // Special case for "Custom Status Only" template
            if (template.name === 'Custom Status Only') {
                groupsToOpen = ['custom_statuses'];
            }

            setOpenAccordions(groupsToOpen);

            toast({
                title: 'Template Applied',
                description: `Permissions for the "${template.name}" role have been set and relevant sections expanded.`
            });
        }
    };

    return (
         <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/roles">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                   <h1 className="text-3xl font-bold tracking-tight">Edit Role: {role.name}</h1>
                   <p className="text-muted-foreground">Update the details and permissions for this role.</p>
                </div>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Role Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Role Name</FormLabel>
                                    <FormControl><Input placeholder="e.g., Front Desk Manager" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Input placeholder="Briefly describe this role's responsibilities" {...field} value={field.value || ''}/></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <Separator />
                                <FormField
                                control={form.control}
                                name="isGlobalRole"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="font-normal cursor-pointer">
                                                Apply to All Branches
                                            </FormLabel>
                                            <p className="text-xs text-muted-foreground">
                                                Check this to make this role available to all branches
                                            </p>
                                        </div>
                                    </FormItem>
                                )}
                                />
                                {!form.watch('isGlobalRole') && branches.length > 0 && (
                                    <FormField
                                    control={form.control}
                                    name="applicableBranches"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Select Applicable Branches</FormLabel>
                                        <div className="space-y-3 pl-2">
                                            {branches.map((branch) => (
                                                <div key={branch.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`branch-${branch.id}`}
                                                        checked={field.value?.includes(branch.id) || false}
                                                        onCheckedChange={(checked) => {
                                                            const current = field.value || [];
                                                            if (checked) {
                                                                field.onChange([...current, branch.id]);
                                                            } else {
                                                                field.onChange(current.filter(id => id !== branch.id));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`branch-${branch.id}`} className="text-sm font-medium cursor-pointer">
                                                        {branch.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                )}
                        </CardContent>
                    </Card>
                    <Card>
                         <CardHeader>
                            <CardTitle>Permissions</CardTitle>
                            <CardDescription>Select a template as a starting point or manually configure permissions below.</CardDescription>
                         </CardHeader>
                         <CardContent className="space-y-6">
                                <div className="space-y-2">
                                     <FormLabel>Permission Templates</FormLabel>
                                     <div className="flex flex-wrap items-center gap-2">
                                        <Select onValueChange={applyTemplate}>
                                            <SelectTrigger className="w-full sm:w-[240px]">
                                                <SelectValue placeholder="Select a template..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLE_TEMPLATES.map(template => (
                                                    <SelectItem key={template.name} value={template.name}>{template.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('permissions', [], { shouldDirty: true })}>
                                            <Redo className="mr-2 h-4 w-4"/>
                                            Clear Selections
                                        </Button>
                                     </div>
                                </div>
                                <Separator />
                                <FormField
                                    control={form.control}
                                    name="permissions"
                                    render={() => (
                                        <FormItem>
                                            <div className="mb-4">
                                                <FormLabel className="text-base">Fine-grained Permissions</FormLabel>
                                                <FormMessage />
                                            </div>
                                            {isGlobalRole && (
                                                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                                                    <p className="text-sm text-amber-900 dark:text-amber-200">
                                                        <span className="font-semibold">Global Role:</span> This role has access to all permissions including administrative features.
                                                    </p>
                                                </div>
                                            )}
                                            {!isGlobalRole && applicableBranches && applicableBranches.length > 0 && (
                                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                                                    <p className="text-sm text-blue-900 dark:text-blue-200">
                                                        <span className="font-semibold">Branch-Specific Permissions:</span> Only permissions compatible with branch-level access are shown below.
                                                    </p>
                                                </div>
                                            )}
                                            <Accordion type="multiple" className="w-full" value={openAccordions} onValueChange={setOpenAccordions}>
                                                {filteredPermissionGroups.map((group) => (
                                                    <AccordionItem value={group.id} key={group.id}>
                                                        <AccordionTrigger>{group.name}</AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="space-y-3 pl-2">
                                                            {group.permissions.map((item: any) => {
                                                                const isStandalone = STANDALONE_PERMISSIONS.has(item.id);
                                                                const tooltipText = isStandalone
                                                                        ? "Standalone: This permission grants access to a specific page or feature on its own."
                                                                        : "Dependent: This action requires a corresponding page-view permission to be useful (e.g., 'Create Booking' needs 'View Bookings Page').";

                                                                return (
                                                                <FormField
                                                                    key={item.id}
                                                                    control={form.control}
                                                                    name="permissions"
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                                            <FormControl>
                                                                                <Checkbox
                                                                                    checked={field.value?.includes(item.id)}
                                                                                    onCheckedChange={(checked) => {
                                                                                        return checked
                                                                                        ? field.onChange([...(field.value || []), item.id])
                                                                                        : field.onChange(field.value?.filter((value) => value !== item.id))
                                                                                    }}
                                                                                />
                                                                            </FormControl>
                                                                            <div className="space-y-1 leading-none">
                                                                                <FormLabel className="font-normal flex items-center gap-2">
                                                                                    {item.description}
                                                                                    <Tooltip delayDuration={300}>
                                                                                        <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                                                                                        <TooltipContent><p className="max-w-xs">{tooltipText}</p></TooltipContent>
                                                                                    </Tooltip>
                                                                                </FormLabel>
                                                                            </div>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            )})}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </FormItem>
                                    )}
                                />
                         </CardContent>
                         <CardFooter className="flex justify-end gap-2">
                           <Button type="button" variant="ghost" asChild>
                             <Link href="/roles">Cancel</Link>
                           </Button>
                           <Button type="submit" loading={isSaving}>
                               Save Changes
                           </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

export default withAuth(EditRolePageContent, PagePermission.MANAGE_ROLES);
