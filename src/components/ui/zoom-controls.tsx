'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useZoom } from '@/contexts/zoom-context';
import { cn } from '@/lib/utils';

export function ZoomControls() {
  const { zoomLevel, zoomIn, zoomOut, resetZoom } = useZoom();

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <span className="text-xs font-medium min-w-[2.5rem] text-right">
                  {zoomLevel}%
                </span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to adjust zoom level</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-center text-xs font-semibold">
            Zoom Level: {zoomLevel}%
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Quick preset zoom levels */}
          <DropdownMenuItem onClick={() => resetZoom()}>
            <span className={cn('flex-1', zoomLevel === 100 && 'font-bold text-primary')}>
              100% (Default)
            </span>
            {zoomLevel === 100 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={zoomOut}>
            <span className="flex-1">Zoom Out (-10%)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={zoomIn}>
            <span className="flex-1">Zoom In (+10%)</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Zoom controls */}
          <div className="flex gap-2 px-2 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-1 h-8"
                  onClick={zoomOut}
                  disabled={zoomLevel <= 0}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom Out (Ctrl + -)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-1 h-8"
                  onClick={resetZoom}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset to 100% (Ctrl + 0)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-1 h-8"
                  onClick={zoomIn}
                  disabled={zoomLevel >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom In (Ctrl + +)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
