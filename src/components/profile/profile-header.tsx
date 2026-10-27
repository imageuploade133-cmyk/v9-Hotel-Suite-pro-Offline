
'use client';

import * as React from 'react';
import { getInitials } from '@/lib/helpers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/lib/types';

interface ProfileHeaderProps {
    userProfile: UserProfile;
}

export function ProfileHeader({ userProfile }: ProfileHeaderProps) {

    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <Avatar className="h-24 w-24 border-4 border-primary shadow-lg">
                <AvatarImage src={userProfile.photoURL || undefined} alt={userProfile.name} />
                <AvatarFallback className="text-3xl">{getInitials(userProfile.name)}</AvatarFallback>
            </Avatar>
            <div>
                <h1 className="text-3xl font-bold">{userProfile.name}</h1>
                <p className="text-muted-foreground">{userProfile.email}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <Badge variant="secondary">{userProfile.role}</Badge>
                </div>
            </div>
        </div>
    );
}
