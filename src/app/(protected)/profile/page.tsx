
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { useUser } from '@/contexts/user-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileForm } from '@/components/profile/profile-form';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { RecentActivityCard } from '@/components/profile/recent-activity-card';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Check, Shield } from 'lucide-react';

function ProfilePage() {
    const { userProfile, loading: isUserLoading, dynamicPermissionGroups } = useUser();

    if (isUserLoading || !userProfile) {
        return (
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <Skeleton className="h-64 w-full rounded-lg" />
                        <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                    <div className="space-y-8">
                        <Skeleton className="h-48 w-full rounded-lg" />
                        <Skeleton className="h-80 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <ProfileHeader userProfile={userProfile} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <ProfileForm />
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-6 w-6" />
                                Assigned Permissions
                            </CardTitle>
                            <CardDescription>
                                As an authenticated user, you have access to all features.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="multiple" className="w-full" defaultValue={dynamicPermissionGroups.map(g => g.id)}>
                                {dynamicPermissionGroups.map((group) => {
                                    if (group.permissions.length === 0) return null;
                                    return (
                                        <AccordionItem value={group.id} key={group.id}>
                                            <AccordionTrigger>{group.name}</AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-2 pl-4">
                                                    {group.permissions.map((permission: any) => (
                                                        <div key={permission.id} className="flex items-center gap-3 text-sm">
                                                            <Check className="h-4 w-4 text-green-500" />
                                                            <span>{permission.description}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>
                        </CardContent>
                    </Card>
                    <UpdatePasswordForm />
                </div>

                <div className="space-y-8">
                    <RecentActivityCard />
                    <ThemeSwitcher />
                </div>
            </div>
        </div>
    );
}

export default withAuth(ProfilePage, PagePermission.MANAGE_OWN_PROFILE);
