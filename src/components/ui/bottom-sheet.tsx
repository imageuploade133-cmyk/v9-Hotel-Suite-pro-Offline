
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
      <SheetContent side="bottom" className="rounded-t-lg h-full max-h-[85vh]">
        {children}
      </SheetContent>
    </Sheet>
  );
}
