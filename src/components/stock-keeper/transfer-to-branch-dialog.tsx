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
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, runTransaction, serverTimestamp, increment, getDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import type { StockItem, Branch } from '@/lib/types';
import { useUser } from '@/contexts/user-context';
import { ScrollArea } from '../ui/scroll-area';
import { Send, Truck, Minus, Plus, ArrowRight, Building2, Package, Check, X, RotateCcw } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { useBranch, BranchContextValue } from '@/contexts/branch-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface TransferToBranchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemsToTransfer: StockItem[];
  onSuccess: () => void;
}

interface TransferReceiptData {
  id: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    subtotal: number;
  }[];
  totalValue: number;
  totalSellingValue: number;
  transferredBy: string;
  transferredAt: Date;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  notes?: string;
}

export function TransferToBranchDialog({ isOpen, onClose, itemsToTransfer, onSuccess }: TransferToBranchDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('');
  const [notes, setNotes] = React.useState('');
  const [transferQuantities, setTransferQuantities] = React.useState<Record<string, string>>({});
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(true);
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());

  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { getCollectionPath, branches: contextBranches, currentBranchId, currentBranch: ctxCurrentBranch } = useBranch() as BranchContextValue & { branches: Branch[] };

  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  // Get available branches (excluding current branch)
  React.useEffect(() => {
    // Get all branches from the context
    const allBranches = contextBranches || [];
    // Filter out current branch
    const otherBranches = allBranches.filter(b => b.id !== currentBranchId && b.status === 'active');
    setBranches(otherBranches);
    setIsLoadingBranches(false);
  }, [contextBranches, currentBranchId]);

  // Get collection paths
  const stagingItemsCollection = React.useMemo(() => getCollectionPath('stockKeeperItems'), [getCollectionPath]);

  React.useEffect(() => {
    if (isOpen) {
      // Pre-fill quantities with the full amount available
      const initialQuantities = itemsToTransfer.reduce((acc, item) => {
        acc[item.id] = String(item.quantity);
        return acc;
      }, {} as Record<string, string>);
      // Pre-select all items
      const allItemIds = new Set(itemsToTransfer.map(item => item.id));
      setTransferQuantities(initialQuantities);
      setSelectedItems(allItemIds);
      setSelectedBranchId('');
      setNotes('');
    }
  }, [isOpen, itemsToTransfer]);

  // Handle selecting/deselecting items
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Select all items with quantity
  const selectAllItems = () => {
    const allItemIds = new Set(itemsToTransfer.map(item => item.id));
    setSelectedItems(allItemIds);
    // Also set all quantities to full amount
    const fullQuantities = itemsToTransfer.reduce((acc, item) => {
      acc[item.id] = String(item.quantity);
      return acc;
    }, {} as Record<string, string>);
    setTransferQuantities(fullQuantities);
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItems(new Set());
    // Clear all quantities
    const emptyQuantities = itemsToTransfer.reduce((acc, item) => {
      acc[item.id] = '0';
      return acc;
    }, {} as Record<string, string>);
    setTransferQuantities(emptyQuantities);
  };

  // Set all quantities to half
  const setHalfQuantities = () => {
    const halfQuantities = itemsToTransfer.reduce((acc, item) => {
      acc[item.id] = String(Math.floor(item.quantity / 2));
      return acc;
    }, {} as Record<string, string>);
    setTransferQuantities(halfQuantities);
    setSelectedItems(new Set(itemsToTransfer.map(item => item.id)));
  };

  // Set all quantities to full
  const setFullQuantities = () => {
    const fullQuantities = itemsToTransfer.reduce((acc, item) => {
      acc[item.id] = String(item.quantity);
      return acc;
    }, {} as Record<string, string>);
    setTransferQuantities(fullQuantities);
    setSelectedItems(new Set(itemsToTransfer.map(item => item.id)));
  };

  // Set all quantities to zero
  const setZeroQuantities = () => {
    const zeroQuantities = itemsToTransfer.reduce((acc, item) => {
      acc[item.id] = '0';
      return acc;
    }, {} as Record<string, string>);
    setTransferQuantities(zeroQuantities);
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const numericValue = parseInt(value, 10);
    const item = itemsToTransfer.find(i => i.id === itemId);
    const maxQuantity = item?.quantity || 0;

    if (value === '') {
        setTransferQuantities(prev => ({ ...prev, [itemId]: '' }));
    } else if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= maxQuantity) {
        setTransferQuantities(prev => ({ ...prev, [itemId]: String(numericValue) }));
        // Auto-select item if quantity > 0
        if (numericValue > 0) {
          setSelectedItems(prev => new Set([...prev, itemId]));
        }
    }
  };

  const totalValue = React.useMemo(() => {
    return itemsToTransfer.reduce((sum, item) => {
      const quantityToTransfer = Number(transferQuantities[item.id]) || 0;
      return sum + ((item.costPrice || 0) * quantityToTransfer);
    }, 0);
  }, [itemsToTransfer, transferQuantities]);

  const totalSellingValue = React.useMemo(() => {
    return itemsToTransfer.reduce((sum, item) => {
      const quantityToTransfer = Number(transferQuantities[item.id]) || 0;
      return sum + (item.sellingPrice * quantityToTransfer);
    }, 0);
  }, [itemsToTransfer, transferQuantities]);

  const totalItems = React.useMemo(() => {
    return itemsToTransfer.reduce((sum, item) => {
      const quantityToTransfer = Number(transferQuantities[item.id]) || 0;
      return sum + quantityToTransfer;
    }, 0);
  }, [itemsToTransfer, transferQuantities]);

  const handleConfirm = async () => {
    if (!firestore || !userProfile) return;

    if (!selectedBranchId) {
      toast({ variant: 'destructive', title: 'Destination Required', description: 'Please select a destination branch.' });
      return;
    }

    const destinationBranch = branches.find(b => b.id === selectedBranchId);
    if (!destinationBranch) {
      toast({ variant: 'destructive', title: 'Invalid Branch', description: 'Selected destination branch not found.' });
      return;
    }

    const itemsWithValidQuantity = Object.entries(transferQuantities)
      .map(([itemId, quantityStr]) => ({ itemId, quantity: Number(quantityStr) }))
      .filter(item => item.quantity > 0);

    if (itemsWithValidQuantity.length === 0) {
      toast({ variant: 'destructive', title: 'No Items to Transfer', description: 'Please specify a quantity for at least one item.' });
      return;
    }

    setIsSaving(true);

    try {
      const sourceBranchName = ctxCurrentBranch?.name || 'Unknown';

      // Create transfer log in source branch
      const transferLogRef = doc(collection(firestore, stagingItemsCollection.replace('stockKeeperItems', 'transferLog')));
      const receiptData: TransferReceiptData = {
        id: transferLogRef.id,
        items: [],
        totalValue: 0,
        totalSellingValue: 0,
        transferredBy: userProfile.name,
        transferredAt: new Date(),
        sourceBranchId: currentBranchId || 'global',
        sourceBranchName,
        destinationBranchId: selectedBranchId,
        destinationBranchName: destinationBranch.name,
        notes,
      };

      // Get destination branch's stock collection path
      const destStockCollection = `branches/${selectedBranchId}/stock`;
      const destStagingCollection = `branches/${selectedBranchId}/stockKeeperItems`;
      const destTransferLogCollection = `branches/${selectedBranchId}/transferLog`;

      await runTransaction(firestore, async (transaction) => {
        const snapshots: { stagingDoc: any; destStockDoc: any }[] = [];

        // First, verify source items have enough stock
        for (const { itemId, quantity } of itemsWithValidQuantity) {
          const stagingItemRef = doc(firestore, stagingItemsCollection, itemId);
          const stagingDoc = await transaction.get(stagingItemRef);

          if (!stagingDoc.exists() || stagingDoc.data().quantity < quantity) {
            throw new Error(`Not enough stock for ${stagingDoc.data()?.name || 'item'} in staging.`);
          }

          // Get destination stock item
          const destStockRef = doc(firestore, destStockCollection, itemId);
          const destStockDoc = await transaction.get(destStockRef);

          snapshots.push({ stagingDoc, destStockDoc });
        }

        let currentTotalValue = 0;
        let currentTotalSellingValue = 0;

        // Process each item transfer
        for (let i = 0; i < itemsWithValidQuantity.length; i++) {
          const { itemId, quantity } = itemsWithValidQuantity[i];
          const { stagingDoc, destStockDoc } = snapshots[i];
          const itemData = stagingDoc.data() as StockItem;

          const costForThisItem = (itemData.costPrice || 0) * quantity;
          const sellingForThisItem = itemData.sellingPrice * quantity;
          currentTotalValue += costForThisItem;
          currentTotalSellingValue += sellingForThisItem;

          receiptData.items.push({
            id: itemId,
            name: itemData.name,
            quantity: quantity,
            costPrice: itemData.costPrice || 0,
            sellingPrice: itemData.sellingPrice || 0,
            subtotal: costForThisItem,
          });

          const stagingItemRef = doc(firestore, stagingItemsCollection, itemId);
          const destStockRef = doc(firestore, destStockCollection, itemId);

          // Deduct from source staging
          transaction.update(stagingItemRef, { quantity: increment(-quantity) });

          // Add to destination branch's stock
          if (destStockDoc.exists()) {
            transaction.update(destStockRef, { quantity: increment(quantity) });
          } else {
            transaction.set(destStockRef, {
              ...itemData,
              quantity: quantity,
              held: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        receiptData.totalValue = currentTotalValue;
        receiptData.totalSellingValue = currentTotalSellingValue;

        // Create transfer log in source branch
        transaction.set(transferLogRef, {
          ...receiptData,
          transferredAt: serverTimestamp(),
          transferredBy: userProfile.name,
          type: 'inter_branch_outgoing',
        });

        // Create transfer log in destination branch
        const destTransferLogRef = doc(collection(firestore, destTransferLogCollection));
        transaction.set(destTransferLogRef, {
          ...receiptData,
          id: destTransferLogRef.id,
          type: 'inter_branch_incoming',
          transferredAt: serverTimestamp(),
          transferredBy: userProfile.name,
        });

        // Create audit log entry
        const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        transaction.set(auditLogRef, {
          timestamp: serverTimestamp(),
          userId: userProfile.uid,
          userName: userProfile.name,
          changeType: 'Transfer',
          entityType: 'Inter-Branch Stock Transfer',
          entityId: transferLogRef.id,
          details: `Transferred ${itemsWithValidQuantity.length} item type(s) from ${sourceBranchName} to ${destinationBranch.name}.`,
          changes: receiptData.items.map(item => ({
            field: `transfer: ${item.name}`,
            before: `Source: ${item.quantity}`,
            after: `Dest: +${item.quantity}`
          })),
          notes: `Total Cost: ${formatCurrency(currentTotalValue)}. Total Selling Value: ${formatCurrency(currentTotalSellingValue)}. Notes: ${notes || 'N/A'}.`,
          keywords: ['transfer', 'branch', 'stock', ...receiptData.items.map(i => i.name.toLowerCase())]
        });
      });

      // Send WhatsApp notification if configured
      if (settings?.enableTransferReceipts && settings.transferReceiptPhoneNumber) {
        const itemsList = receiptData.items.map(i => `- ${i.name} (x${i.quantity})`).join('\n');
        const message = `*Inter-Branch Stock Transfer*\n\n*ID:* ${receiptData.id.substring(0, 8)}\n*Date:* ${format(receiptData.transferredAt, 'PPpp')}\n*By:* ${receiptData.transferredBy}\n\n*From:* ${sourceBranchName}\n*To:* ${destinationBranch.name}\n\n*Items:*\n${itemsList}\n\n*Total Cost:* ${formatCurrency(receiptData.totalValue)}\n*Total Selling Value:* ${formatCurrency(receiptData.totalSellingValue)}`;

        await sendWhatsAppMessage({
          phone: settings.transferReceiptPhoneNumber,
          message: message,
        });
      }

      toast({
        variant: 'success',
        title: 'Transfer Complete',
        description: `${totalItems} item(s) transferred from ${sourceBranchName} to ${destinationBranch.name}.`
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({ variant: 'destructive', title: 'Transfer Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const canConfirm = React.useMemo(() => {
    return selectedBranchId && Object.values(transferQuantities).some(val => val !== '' && Number(val) > 0);
  }, [selectedBranchId, transferQuantities]);

  if (!isOpen) return null;

  const currentBranchName = ctxCurrentBranch?.name || 'Current Branch';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Transfer to Another Branch
          </DialogTitle>
          <DialogDescription>
            Transfer items from your staging area to another branch. The items will be deducted from your staging and added to the destination branch&apos;s main inventory.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
          {/* Source and Destination Display - More Prominent */}
          <Card className="bg-gradient-to-r from-muted/50 to-muted/30 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">From Branch</p>
                    <p className="font-bold text-lg">{currentBranchName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">To Branch</p>
                    <p className="font-bold text-lg text-success">
                      {selectedBranchId
                        ? branches.find(b => b.id === selectedBranchId)?.name
                        : 'Select destination...'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destination Branch Selector - Improved */}
          <div className="space-y-2">
            <Label htmlFor="destinationBranch" className="font-semibold">Select Destination Branch</Label>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger id="destinationBranch" className="h-12">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose a branch to transfer to" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {isLoadingBranches ? (
                  <SelectItem value="loading" disabled>Loading branches...</SelectItem>
                ) : branches.length === 0 ? (
                  <SelectItem value="none" disabled>No other branches available</SelectItem>
                ) : (
                  branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{branch.name}</span>
                        <Badge variant="secondary" className="ml-auto">Active</Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground font-medium">Quick Set:</span>
            <Button variant="outline" size="sm" onClick={selectAllItems} className="h-8">
              <Check className="h-3 w-3 mr-1" /> Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAllItems} className="h-8">
              <X className="h-3 w-3 mr-1" /> Clear All
            </Button>
            <Button variant="outline" size="sm" onClick={setFullQuantities} className="h-8">
              <Package className="h-3 w-3 mr-1" /> Full Quantity
            </Button>
            <Button variant="outline" size="sm" onClick={setHalfQuantities} className="h-8">
              <RotateCcw className="h-3 w-3 mr-1" /> Half
            </Button>
            <Button variant="outline" size="sm" onClick={setZeroQuantities} className="h-8">
              0
            </Button>
          </div>

          {/* Items to Transfer - Enhanced */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Items to Transfer</Label>
              <Badge variant="outline">{selectedItems.size} / {itemsToTransfer.length} selected</Badge>
            </div>
            <ScrollArea className="h-[240px] border rounded-lg">
              <div className="p-3 space-y-2">
                {itemsToTransfer.map(item => {
                  const quantityToTransfer = Number(transferQuantities[item.id]) || 0;
                  const isSelected = selectedItems.has(item.id);
                  const itemSubtotal = (item.costPrice || 0) * quantityToTransfer;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 text-sm p-3 border rounded-lg transition-all ${
                        isSelected ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}
                        onClick={() => toggleItemSelection(item.id)}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold truncate ${!isSelected && 'text-muted-foreground'}`}>{item.name}</p>
                          {!isSelected && <Badge variant="secondary" className="text-[10px]">Not selected</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            Available: {item.quantity}
                          </span>
                          <span>Cost: {formatCurrency(item.costPrice || 0)}</span>
                          <span>Selling: {formatCurrency(item.sellingPrice)}</span>
                        </div>
                      </div>

                      {/* Subtotal Display */}
                      <div className="text-right min-w-[80px]">
                        <p className={`text-xs text-muted-foreground`}>Subtotal</p>
                        <p className={`font-semibold ${quantityToTransfer > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {quantityToTransfer > 0 ? formatCurrency(itemSubtotal) : '-'}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(item.id, String(quantityToTransfer - 1))}
                          disabled={quantityToTransfer <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          value={transferQuantities[item.id] ?? ''}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="text-center w-16 h-8"
                          placeholder="0"
                          max={item.quantity}
                          min={0}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(item.id, String(quantityToTransfer + 1))}
                          disabled={quantityToTransfer >= item.quantity}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Transfer Summary - Enhanced */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Items</p>
                  <p className="text-2xl font-bold text-primary">{totalItems}</p>
                  <p className="text-xs text-muted-foreground">units</p>
                </div>
                <div className="text-center p-2 border-x">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Cost Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                  <p className="text-xs text-muted-foreground">wholesale</p>
                </div>
                <div className="text-center p-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Selling Value</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(totalSellingValue)}</p>
                  <p className="text-xs text-muted-foreground">retail potential</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes - Improved */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="font-semibold">Transfer Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this transfer (e.g., reason, special instructions)..."
              className="h-20 resize-none"
            />
          </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-muted/30">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            loading={isSaving}
            disabled={!canConfirm || isSaving}
            className="min-w-[160px]"
          >
            <Send className="mr-2 h-4 w-4" />
            Confirm Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
