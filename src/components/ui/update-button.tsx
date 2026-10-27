
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpdateButtonProps {
  onClick: () => Promise<void>;
  isVisible: boolean;
}

export function UpdateButton({ onClick, isVisible }: UpdateButtonProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleClick = async () => {
    setIsUpdating(true);
    try {
      await onClick();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 transition-all duration-300",
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
    )}>
      <Button
        onClick={handleClick}
        disabled={isUpdating}
        className="shadow-lg"
      >
        {isUpdating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Update Available
      </Button>
    </div>
  );
}
