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
          <DropdownMenuItem onClick={() => zoomLevel !== 0 && (() => {
            while (zoomLevel > 0) zoomOut();
          })()}>
            <span className={cn('flex-1', zoomLevel === 0 && 'font-bold text-primary')}>
              0% (Minimum)
            </span>
            {zoomLevel === 0 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomLevel !== 50 && (() => {
            while (zoomLevel < 50) zoomIn();
            while (zoomLevel > 50) zoomOut();
          })()}>
            <span className={cn('flex-1', zoomLevel === 50 && 'font-bold text-primary')}>
              50%
            </span>
            {zoomLevel === 50 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomLevel !== 75 && (() => {
            while (zoomLevel < 75) zoomIn();
            while (zoomLevel > 75) zoomOut();
          })()}>
            <span className={cn('flex-1', zoomLevel === 75 && 'font-bold text-primary')}>
              75%
            </span>
            {zoomLevel === 75 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomLevel !== 100 && resetZoom()}>
            <span className={cn('flex-1', zoomLevel === 100 && 'font-bold text-primary')}>
              100% (Default)
            </span>
            {zoomLevel === 100 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomLevel !== 125 && (() => {
            while (zoomLevel < 125) zoomIn();
            while (zoomLevel > 125) zoomOut();
          })()}>
            <span className={cn('flex-1', zoomLevel === 125 && 'font-bold text-primary')}>
              125%
            </span>
            {zoomLevel === 125 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomLevel !== 150 && (() => {
            while (zoomLevel < 150) zoomIn();
            while (zoomLevel > 150) zoomOut();
          })()}>
            <span className={cn('flex-1', zoomLevel === 150 && 'font-bold text-primary')}>
              150%
            </span>
            {zoomLevel === 150 && <span className="ml-2 text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => zoomLevel !== 200 && (() => {
            while (zoomLevel < 200) zoomIn();
            while (zoomLevel > 200) zoomOut();
          })()}>
            <span className={cn('flex-1', zoomLevel === 200 && 'font-bold text-primary')}>
              200% (Maximum)
            </span>
            {zoomLevel === 200 && <span className="ml-2 text-xs">✓</span>}
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
