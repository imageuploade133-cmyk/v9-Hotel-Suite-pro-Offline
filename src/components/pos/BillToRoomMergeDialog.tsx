'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BedDouble, Plus, Merge, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { HeldSale, UnifiedItem } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { format } from 'date-fns';
import { getSafeDate } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface BillToRoomMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onMerge: () => void;
  existingTable: HeldSale | null;
  newItems: UnifiedItem[];
  roomNumber: string;
  guestName: string;
  isProcessing: boolean;
}

export function BillToRoomMergeDialog({
  isOpen,
  onClose,
  onCreateNew,
  onMerge,
  existingTable,
  newItems,
  roomNumber,
  guestName,
  isProcessing,
}: BillToRoomMergeDialogProps) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  // Calculate totals
  const existingTotal = existingTable?.cart.reduce(
    (sum, item) => sum + ((item.price || item.sellingPrice || 0) * item.sellQuantity),
    0
  ) || 0;

  const newItemsTotal = newItems.reduce(
    (sum, item) => sum + ((item.price || item.sellingPrice || 0) * item.sellQuantity),
    0
  );

  // Find items that will have quantities added (same item in both)
  const overlappingItems = React.useMemo(() => {
    if (!existingTable) return [];
    return newItems.filter(newItem =>
      existingTable.cart.some(existingItem => existingItem.id === newItem.id)
    );
  }, [existingTable, newItems]);

  // Find items that are new (not in existing table)
  const newUniqueItems = React.useMemo(() => {
    if (!existingTable) return newItems;
    return newItems.filter(newItem =>
      !existingTable.cart.some(existingItem => existingItem.id === newItem.id)
    );
  }, [existingTable, newItems]);

  const heldAt = existingTable?.heldAt ? getSafeDate(existingTable.heldAt) : null;

  const combinedTotal = existingTotal + newItemsTotal;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <BedDouble className="h-5 w-5 text-primary" />
            </div>
            Table Already Exists for Room {roomNumber}
          </DialogTitle>
          <DialogDescription className="text-sm mt-1">
            {guestName} already has a running table. Merge items together or create a new table.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {/* Room Info Banner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                <BedDouble className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{guestName}</p>
                <p className="text-xs text-muted-foreground">Room {roomNumber}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Combined Total</p>
                <p className="font-bold text-lg text-primary">{formatCurrency(combinedTotal)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Existing Table Info */}
              {existingTable && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Existing Table
                    </h4>
                    <Badge variant="secondary">{existingTable.cart.length} items</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Created {heldAt ? format(heldAt, 'MMM d, h:mm a') : 'Unknown'}
                  </p>
                  <ScrollArea className="h-32 rounded border bg-background">
                    <div className="p-2 space-y-1.5">
                      {existingTable.cart.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm items-center gap-2">
                          <span className="truncate text-xs">{item.name}</span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {item.sellQuantity} × {formatCurrency(item.price || item.sellingPrice || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-3 flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Current Total</span>
                    <span className="font-semibold text-sm">{formatCurrency(existingTotal)}</span>
                  </div>
                </div>
              )}

              {/* New Items Info */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    New Items
                  </h4>
                  <Badge variant="outline">{newItems.length} items</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Items from current sale
                </p>
                <ScrollArea className="h-32 rounded border bg-background">
                  <div className="p-2 space-y-1.5">
                    {newItems.map((item) => {
                      const isOverlapping = overlappingItems.some(i => i.id === item.id);
                      return (
                        <div key={item.id} className="flex justify-between text-sm items-center gap-2">
                          <span className="truncate text-xs flex items-center gap-1.5">
                            {item.name}
                            {isOverlapping && (
                              <Badge variant="warning" className="text-[9px] h-4 px-1 py-0">
                                +{item.sellQuantity}
                              </Badge>
                            )}
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {item.sellQuantity} × {formatCurrency(item.price || item.sellingPrice || 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="mt-3 flex justify-between items-center pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Items Total</span>
                  <span className="font-semibold text-sm">{formatCurrency(newItemsTotal)}</span>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Merge Option */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Merge className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Merge with Existing</h4>
                </div>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {overlappingItems.length > 0 && (
                    <li className="flex items-start gap-1.5">
                      <CheckCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <span>{overlappingItems.length} item(s) quantities will combine</span>
                    </li>
                  )}
                  {newUniqueItems.length > 0 && (
                    <li className="flex items-start gap-1.5">
                      <CheckCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <span>{newUniqueItems.length} new item(s) will be added</span>
                    </li>
                  )}
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span>Single table for easy tracking</span>
                  </li>
                </ul>
                <div className="mt-3 pt-2 border-t flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">After Merge</span>
                  <span className="font-bold text-primary">{formatCurrency(combinedTotal)}</span>
                </div>
              </div>

              {/* Create New Option */}
              <div className="rounded-lg border-2 border-yellow-200/50 bg-yellow-50/50 dark:bg-yellow-950/20 p-4 hover:border-yellow-300 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4 text-yellow-600" />
                  <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">Create New Table</h4>
                </div>
                <ul className="text-xs space-y-1 text-yellow-700/70 dark:text-yellow-400/70">
                  <li className="flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                    <span>Creates separate running table</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                    <span>Room will have multiple tables</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                    <span>Harder to track & manage</span>
                  </li>
                </ul>
                <div className="mt-3 pt-2 border-t border-yellow-200/50 flex justify-between items-center">
                  <span className="text-xs text-yellow-600/70">New Table Total</span>
                  <span className="font-bold text-yellow-700 dark:text-yellow-300">{formatCurrency(newItemsTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isProcessing} loading={isProcessing} className="gap-1.5">
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={onCreateNew}
            disabled={isProcessing}
            loading={isProcessing}
            className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400"
          >
            <Plus className="h-4 w-4" />
            Create New
          </Button>
          <Button
            onClick={onMerge}
            disabled={isProcessing}
            loading={isProcessing}
            className="gap-1.5"
          >
            <Merge className="h-4 w-4" />
            Merge Tables
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
