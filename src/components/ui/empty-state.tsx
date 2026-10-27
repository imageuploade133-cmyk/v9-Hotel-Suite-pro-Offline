'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, className, children }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-xl bg-card", className)}>
      {Icon && (
        <div className="mb-4 rounded-full bg-secondary p-4">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">{description}</p>
      {children}
    </div>
  );
}
