'use client';

import * as React from 'react';

interface TopHeaderProps {
    icon: React.ReactNode;
    name: string;
    mobileName?: string;
    description?: string;
}

export function TopHeader({ icon, name, mobileName, description }: TopHeaderProps) {
    return (
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="shrink-0 text-primary [&>svg]:h-8 [&>svg]:w-8 sm:[&>svg]:h-10 sm:[&>svg]:w-10">{icon}</div>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-4xl">
              {mobileName ? (
                <>
                  <span className="sm:hidden">{mobileName}</span>
                  <span className="hidden sm:inline">{name}</span>
                </>
              ) : name}
            </h1>
            {description && (
                <p className="break-words text-sm text-muted-foreground sm:text-base">
                    {description}
                </p>
            )}
          </div>
        </div>
    )
}
