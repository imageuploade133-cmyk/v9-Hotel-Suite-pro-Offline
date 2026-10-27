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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { HeldSale } from '@/lib/types';
import { Plus, Minus, Search, Undo2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface ReturnItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  heldSale: HeldSale | null;
  onConfirm: (
    sale: HeldSale,
    itemsToReturn: { itemId: string; quantity: number; itemName: string; price: number }[],
    reason: string
  ) => Promise<void>;
}

export function ReturnItemDialog({ isOpen, onClose, heldSale, onConfirm }: ReturnItemDialogProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [itemsToReturn, setItemsToReturn] = React.useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = React.useState('');

  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setReason('');
      setItemsToReturn({});
      setSearchTerm('');
    }
  }, [isOpen]);

  const formatCurrency = (amount: number) => {
    if (isNaN(amount)) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const availableItemsToReturn = React.useMemo(() => {
    if (!heldSale?.cart) return [];
    return heldSale.cart
      .map(item => ({
        ...item,
        itemId: item.id,
        itemName: item.name,
        price: item.price || item.sellingPrice || 0,
        availableToReturn: item.sellQuantity,
      }))
      .filter(item => item.availableToReturn > 0);
  }, [heldSale]);

  const filteredItems = React.useMemo(() => {
    if (!searchTerm) return availableItemsToReturn;
    return availableItemsToReturn.filter(item =>
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableItemsToReturn, searchTerm]);

  const handleQuantityChange = (itemId: string, change: number) => {
    const originalItem = availableItemsToReturn.find(i => i.itemId === itemId);
    if (!originalItem) return;

    const currentReturnQty = itemsToReturn[itemId] || 0;
    const newReturnQty = currentReturnQty + change;

    if (newReturnQty >= 0 && newReturnQty <= originalItem.availableToReturn) {
      setItemsToReturn(prev => ({ ...prev, [itemId]: newReturnQty }));
    }
  };

  const handleSelectAllFiltered = (checked: boolean | 'indeterminate') => {
    const newItemsToReturn = { ...itemsToReturn };
    if (checked) {
      filteredItems.forEach(item => {
        newItemsToReturn[item.itemId] = item.availableToReturn;
      });
    } else {
      filteredItems.forEach(item => {
        delete newItemsToReturn[item.itemId];
      });
    }
    setItemsToReturn(newItemsToReturn);
  };

  const totalRefundAmount = Object.entries(itemsToReturn).reduce((sum, [itemId, quantity]) => {
    const item = availableItemsToReturn.find(i => i.itemId === itemId);
    return sum + ((item?.price || 0) * quantity);
  }, 0);

  const handleConfirmReturn = async () => {
    if (!heldSale) return;

    const itemsToReturnArray = Object.entries(itemsToReturn)
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => {
        const item = availableItemsToReturn.find(i => i.itemId === itemId);
        if (!item) throw new Error('Item not found during return processing');
        return {
          itemId,
          quantity,
          itemName: item.itemName,
          price: item.price,
        };
      });

    if (itemsToReturnArray.length === 0) {
      toast({ variant: 'destructive', title: 'No Items Selected', description: 'Please select a quantity to return for at least one item.' });
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(heldSale, itemsToReturnArray, reason);
      onClose();
    } catch (e) {
      // Parent component will show toast
    } finally {
      setIsProcessing(false);
    }
  };

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => (itemsToReturn[item.itemId] || 0) === item.availableToReturn);
  const someFilteredSelected = filteredItems.some(item => (itemsToReturn[item.itemId] || 0) > 0);

  if (!heldSale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Return Items from &quot;{heldSale.name}&quot;</DialogTitle>
          <DialogDescription>
            Select items and quantities to return. Items will be returned to stock and removed from the running table.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all-filtered"
                checked={allFilteredSelected ? true : (someFilteredSelected ? 'indeterminate' : false)}
                onCheckedChange={handleSelectAllFiltered}
                disabled={filteredItems.length === 0}
              />
              <Label htmlFor="select-all-filtered">Select All ({filteredItems.length})</Label>
            </div>
          </div>
          <ScrollArea className="border rounded-md">
            <div className="p-4 space-y-3 max-h-[35vh]">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div key={item.itemId} className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg bg-background">
                    <div className="flex-1">
                      <p className="font-semibold">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        Price: {formatCurrency(item.price)} | Qty in Table: {item.sellQuantity}
                        {!item.isService && item.quantity !== undefined && ` | In Stock: ${item.quantity}`}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(item.itemId, -1)}
                        disabled={(itemsToReturn[item.itemId] || 0) <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={itemsToReturn[item.itemId] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setItemsToReturn(prev => ({
                            ...prev,
                            [item.itemId]: Math.max(0, Math.min(val, item.availableToReturn)),
                          }));
                        }}
                        className="w-16 h-8 text-center font-bold"
                        max={item.availableToReturn}
                        min={0}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleQuantityChange(item.itemId, 1)}
                        disabled={(itemsToReturn[item.itemId] || 0) >= item.availableToReturn}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No items match your search.</p>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 rounded-lg border bg-muted">
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total Return Amount:</span>
              <span className="text-destructive">{formatCurrency(totalRefundAmount)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason for Return (Optional)</Label>
            <Textarea
              id="return-reason"
              placeholder="e.g., Customer changed mind, wrong item added..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isProcessing}
            />
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmReturn}
            loading={isProcessing}
            disabled={totalRefundAmount <= 0}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
