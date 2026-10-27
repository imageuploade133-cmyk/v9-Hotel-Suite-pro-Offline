

'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Shield, Info, Redo } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Role } from '@/lib/types';
import { PagePermission, STANDALONE_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/permissions';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/contexts/user-context';
import { useBranch } from '@/contexts/branch-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ROLE_TEMPLATES } from '@/lib/role-templates';
import { FormDescription } from '@/components/ui/form';
import { getAvailablePermissions } from '@/lib/permission-categories';

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isGlobalRole: z.boolean().default(false),
  applicableBranches: z.array(z.string()).optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export default function CreateRolePage() {
    const [isLoading, setIsLoading] = React.useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const router = useRouter();
    const { dynamicPermissionGroups } = useUser();
    const { branches } = useBranch();
    const [openAccordions, setOpenAccordions] = React.useState<string[]>([]);

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: '',
            description: '',
            permissions: [],
            isGlobalRole: false,
            applicableBranches: [],
        },
    });

    // Get filtered permissions based on role scope
    const isGlobalRole = form.watch('isGlobalRole');
    const applicableBranches = form.watch('applicableBranches');
    const availablePermissions = React.useMemo(() => getAvailablePermissions(isGlobalRole), [isGlobalRole]);

    // Filter permission groups to show only available permissions
    const filteredPermissionGroups = React.useMemo(() => {
        return (dynamicPermissionGroups || [])
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

    const onSubmit = async (values: RoleFormValues) => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot save role.' });
            return;
        }
        setIsLoading(true);

        try {
            const dataToSave = {
                ...values,
                isGlobalRole: values.isGlobalRole || false,
                applicableBranches: values.isGlobalRole ? [] : (values.applicableBranches || []),
                createdAt: serverTimestamp(),
            };
            const rolesCollection = collection(firestore, 'roles');
            await addDoc(rolesCollection, dataToSave);
            toast({ variant: 'success', title: 'Role Created', description: `The "${values.name}" role has been created.` });
            router.push('/roles');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    const applyTemplate = (templateName: string) => {
        const template = ROLE_TEMPLATES.find(t => t.name === templateName);
        if (template && dynamicPermissionGroups) {
            form.setValue('name', template.name, { shouldDirty: true });
            form.setValue('description', template.description, { shouldDirty: true });
            form.setValue('permissions', template.permissions, { shouldDirty: true });

            const templatePerms = new Set(template.permissions);
            let groupsToOpen = dynamicPermissionGroups
                .filter((group: any) => group.permissions.some((p: any) => templatePerms.has(p.id)))
                .map((group: any) => group.id);

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
                    <h1 className="text-3xl font-bold tracking-tight">Create New Role</h1>
                    <p className="text-muted-foreground">Define a new role and assign permissions to it.</p>
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
                                    <FormControl><Input placeholder="Briefly describe this role's responsibilities" {...field} /></FormControl>
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
                                            <FormDescription>
                                                Check this to make this role available to all branches
                                            </FormDescription>
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
                                            {filteredPermissionGroups && filteredPermissionGroups.map((group) => (
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
                                                                                    <TooltipContent><p>{tooltipText}</p></TooltipContent>
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
                           <Button type="submit" loading={isLoading}>
                               Create Role
                           </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    )
}
