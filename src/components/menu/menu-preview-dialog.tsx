
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

interface MenuPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
}

export function MenuPreviewDialog({
  open,
  onOpenChange,
  menuId,
}: MenuPreviewDialogProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = React.useState(Date.now()); // To force re-render

  React.useEffect(() => {
    if (open) {
      setIsLoading(true);
      setIframeKey(Date.now()); // Change key to force iframe reload
    }
  }, [open]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const menuUrl = `/menus/${menuId}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-4">
        <DialogHeader className="p-2">
          <DialogTitle>Live Menu Preview</DialogTitle>
          <DialogDescription>
            This is what your customers will see. Any changes you save will be reflected here after a refresh.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[9/16] w-full max-w-sm mx-auto rounded-lg border-4 border-foreground bg-muted overflow-hidden flex-1">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
              <Loader2 className="absolute h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {menuId && (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={menuUrl}
              className="w-full h-full"
              onLoad={handleIframeLoad}
              title={`Live menu preview`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
