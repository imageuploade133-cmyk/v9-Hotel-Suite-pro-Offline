
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface GuestBillPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomNumber: string | null;
}

export function GuestBillPreviewDialog({
  open,
  onOpenChange,
  roomNumber,
}: GuestBillPreviewDialogProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = React.useState(Date.now());

  React.useEffect(() => {
    if (open) {
      setIsLoading(true);
      setIframeKey(Date.now());
    }
  }, [open]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const guestBillUrl = roomNumber ? `/guest-bill?room=${roomNumber}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-4">
        <DialogHeader className="p-2">
          <DialogTitle>Guest Bill Live Preview</DialogTitle>
          <DialogDescription>
            This is what the guest in Room {roomNumber} will see when they scan the QR code.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[9/16] w-full max-w-sm mx-auto rounded-lg border-4 border-foreground bg-muted overflow-hidden flex-1">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
              <Loader2 className="absolute h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {roomNumber && (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={guestBillUrl}
              className="w-full h-full"
              onLoad={handleIframeLoad}
              title={`Live guest bill preview for room ${roomNumber}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
