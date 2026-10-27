'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './card';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';
import { DynamicIcon } from './dynamic-icon';
import type { LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<LucideProps> | string;
  description?: string;
  isLoading?: boolean;
  className?: string;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  icon,
  description,
  isLoading,
  className,
  iconClassName,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('flex flex-col justify-between', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-3/5" />
          {description && <Skeleton className="mt-2 h-3 w-4/5" />}
        </CardContent>
      </Card>
    );
  }

  const IconComponent = typeof icon === 'string'
      ? <DynamicIcon iconName={icon} className={cn("h-4 w-4 text-muted-foreground", iconClassName)} />
      : React.createElement(icon, { className: cn("h-4 w-4 text-muted-foreground", iconClassName) });

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {IconComponent}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
