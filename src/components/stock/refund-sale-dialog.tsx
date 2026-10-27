
'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StockSale } from '@/lib/types';
import { Trash2, Plus, Minus, Search, Undo2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';

interface RefundSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: StockSale | null;
  onConfirm: (
    saleToRefund: StockSale,
    itemsToReturn: { itemId: string; quantity: number, itemName: string, sellingPrice: number }[],
    reason: string
  ) => Promise<void>;
}

export function RefundSaleDialog({ isOpen, onClose, sale, onConfirm }: RefundSaleDialogProps) {
  const [isRefunding, setIsRefunding] = React.useState(false);
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
  }

  const availableItemsToReturn = React.useMemo(() =>
    sale?.items.map(item => {
        const alreadyRefunded = (sale.refundedItems || []).filter(ri => ri.itemId === item.itemId).reduce((sum, ri) => sum + ri.quantity, 0);
        return { ...item, availableToReturn: item.quantity - alreadyRefunded };
    }).filter(item => item.availableToReturn > 0) || []
  , [sale]);

  const filteredItems = React.useMemo(() => {
    if (!searchTerm) return availableItemsToReturn;
    return availableItemsToReturn.filter(item => item.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [availableItemsToReturn, searchTerm]);

  const handleQuantityChange = (itemId: string, currentQuantity: number, change: number) => {
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
    const item = sale?.items.find(i => i.itemId === itemId);
    return sum + ((item?.sellingPrice || 0) * quantity);
  }, 0);

  const handleConfirmRefund = async () => {
    if (!sale) return;

    const itemsToReturnArray = Object.entries(itemsToReturn)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => {
            const item = sale.items.find(i => i.itemId === itemId);
            if (!item) throw new Error("Item not found during refund processing");
            return {
                itemId,
                quantity,
                itemName: item.itemName,
                sellingPrice: item.sellingPrice
            };
        });

    if (itemsToReturnArray.length === 0) {
        toast({ variant: 'destructive', title: 'No Items Selected', description: 'Please select a quantity to return for at least one item.'});
        return;
    }

    setIsRefunding(true);
    try {
        await onConfirm(sale, itemsToReturnArray, reason);
        onClose();
    } catch(e) {
        // Parent component will show toast
    } finally {
        setIsRefunding(false);
    }
  }

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => (itemsToReturn[item.itemId] || 0) === item.availableToReturn);
  const someFilteredSelected = filteredItems.some(item => (itemsToReturn[item.itemId] || 0) > 0);

  if (!sale) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Process Refund for Sale #{sale.saleId}</AlertDialogTitle>
          <AlertDialogDescription>
            Select the items and quantities to return to stock. The refund amount will be calculated automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search items to return..."
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
            <ScrollArea className="max-h-60 border rounded-md">
                <div className="p-4 space-y-3">
                    {filteredItems.length > 0 ? filteredItems.map(item => (
                        <div key={item.itemId} className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg bg-background">
                            <div className="flex-1">
                                <p className="font-semibold">{item.itemName}</p>
                                <p className="text-xs text-muted-foreground">Purchased: {item.quantity} | Available to Return: {item.availableToReturn}</p>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.itemId, item.quantity, -1)} disabled={(itemsToReturn[item.itemId] || 0) <= 0}><Minus className="h-4 w-4" /></Button>
                                <Input
                                    type="number"
                                    value={itemsToReturn[item.itemId] || 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10) || 0;
                                        setItemsToReturn(prev => ({...prev, [item.itemId]: Math.max(0, Math.min(val, item.availableToReturn)) }));
                                    }}
                                    className="w-16 h-8 text-center font-bold"
                                    max={item.availableToReturn}
                                    min={0}
                                />
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.itemId, item.quantity, 1)} disabled={(itemsToReturn[item.itemId] || 0) >= item.availableToReturn}><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-muted-foreground py-10">No items match your search.</p>
                    )}
                </div>
            </ScrollArea>
             <div className="p-4 rounded-lg border bg-muted">
                <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total Refund Amount:</span>
                    <span className="text-destructive">{formatCurrency(totalRefundAmount)}</span>
                </div>
            </div>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason for Refund (Optional)</Label>
            <Textarea
              id="refund-reason"
              placeholder="e.g., Customer returned damaged item, wrong product sold..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isRefunding}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRefunding}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirmRefund}
            loading={isRefunding}
            disabled={totalRefundAmount <= 0}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Confirm Refund
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
