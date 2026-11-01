
'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function BottomSheet({ open, onOpenChange, children }: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="inset-0 h-full max-h-none w-full rounded-none p-4 flex flex-col overflow-y-auto">
        {children}
      </SheetContent>
    </Sheet>
  );
}
