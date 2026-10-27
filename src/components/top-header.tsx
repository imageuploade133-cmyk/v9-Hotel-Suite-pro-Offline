'use client';

import * as React from 'react';

interface TopHeaderProps {
    icon: React.ReactNode;
    name: string;
    description?: string;
}

export function TopHeader({ icon, name, description }: TopHeaderProps) {
    return (
        <div className="flex items-center gap-4">
          <div className="text-primary">{icon}</div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              {name}
            </h1>
            {description && (
                <p className="text-muted-foreground">
                    {description}
                </p>
            )}
          </div>
        </div>
    )
}
