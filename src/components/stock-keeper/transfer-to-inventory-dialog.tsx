

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
import { collection, doc, runTransaction, serverTimestamp, increment, getDoc, writeBatch, setDoc } from 'firebase/firestore';
import type { StockItem } from '@/lib/types';
import { useUser } from '@/contexts/user-context';
import { ScrollArea } from '../ui/scroll-area';
import { Send, Truck, Minus, Plus } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { TransferReceiptData } from '@/app/(protected)/stock-keeper/page';
import { Separator } from '../ui/separator';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { format } from 'date-fns';
import { useBranch } from '@/contexts/branch-context';
import { commitLocalFirstMutations, fetchLocalLanCollection } from '@/lib/lan-sync/sync-helper';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

interface TransferToInventoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemsToTransfer: StockItem[];
  onSuccess: (receiptData: TransferReceiptData) => void;
}

export function TransferToInventoryDialog({ isOpen, onClose, itemsToTransfer, onSuccess }: TransferToInventoryDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [supplier, setSupplier] = React.useState('');
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [transferQuantities, setTransferQuantities] = React.useState<Record<string, string>>({});

  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();
  const { getCollectionPath } = useBranch();
  const currency = settings?.currency || 'USD';

  // Get collection paths based on branch context
  const transferLogCollection = React.useMemo(() => getCollectionPath('transferLog'), [getCollectionPath]);
  const globalAuditLogCollection = 'globalAuditLog'; // This should stay at root
  const stagingItemsCollection = React.useMemo(() => getCollectionPath('stockKeeperItems'), [getCollectionPath]);
  const mainStockCollection = React.useMemo(() => getCollectionPath('stock'), [getCollectionPath]);
  const expensesCollection = React.useMemo(() => getCollectionPath('expenses'), [getCollectionPath]);

  React.useEffect(() => {
    if (isOpen) {
      // Pre-fill quantities with the full amount available
      const initialQuantities = itemsToTransfer.reduce((acc, item) => {
        acc[item.id] = String(item.quantity);
        return acc;
      }, {} as Record<string, string>);
      setTransferQuantities(initialQuantities);
      setSupplier(itemsToTransfer[0]?.supplier || '');
      setInvoiceNumber('');
    }
  }, [isOpen, itemsToTransfer]);

  const handleQuantityChange = (itemId: string, value: string) => {
    const numericValue = parseInt(value, 10);
    const item = itemsToTransfer.find(i => i.id === itemId);
    const maxQuantity = item?.quantity || 0;

    if (value === '') {
        setTransferQuantities(prev => ({ ...prev, [itemId]: '' }));
    } else if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= maxQuantity) {
        setTransferQuantities(prev => ({ ...prev, [itemId]: String(numericValue) }));
    }
  };


  const totalValue = React.useMemo(() => {
    return itemsToTransfer.reduce((sum, item) => {
      const quantityToTransfer = Number(transferQuantities[item.id]) || 0;
      return sum + ((item.costPrice || 0) * quantityToTransfer);
    }, 0);
  }, [itemsToTransfer, transferQuantities]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const handleConfirm = async () => {
    if (!firestore || !userProfile) return;

    const itemsWithValidQuantity = Object.entries(transferQuantities)
      .map(([itemId, quantityStr]) => ({ itemId, quantity: Number(quantityStr) }))
      .filter(item => item.quantity > 0);

    if (itemsWithValidQuantity.length === 0) {
      toast({ variant: 'destructive', title: 'No Items to Transfer', description: 'Please specify a quantity for at least one item.' });
      return;
    }

    setIsSaving(true);

    try {
        const transferLogRef = doc(collection(firestore, transferLogCollection));
        const receiptData: TransferReceiptData = {
          id: transferLogRef.id,
          items: [],
          totalValue: 0,
          transferredBy: userProfile.name,
          transferredAt: new Date(),
          supplier,
          invoiceNumber,
        };

        if (isLocalMasterHost()) {
          const [localStaging, localMain] = await Promise.all([
            fetchLocalLanCollection<StockItem>(stagingItemsCollection),
            fetchLocalLanCollection<StockItem>(mainStockCollection),
          ]);
          const transferMutations: Array<{ collectionName: string; docId: string; action: 'set' | 'update'; data: Record<string, unknown> }> = [];
          const localAuditChanges: any[] = [];
          let localTotalValue = 0;
          for (const requested of itemsWithValidQuantity) {
            const stagingItem = localStaging.find(entry => entry.id === requested.itemId);
            if (!stagingItem || Number(stagingItem.quantity || 0) < requested.quantity) {
              throw new Error(`Not enough stock for ${stagingItem?.name || requested.itemId} in staging.`);
            }
            const mainItem = localMain.find(entry => entry.id === requested.itemId);
            const costPrice = Number(stagingItem.costPrice || 0);
            const subtotal = costPrice * requested.quantity;
            localTotalValue += subtotal;
            receiptData.items.push({
              id: requested.itemId,
              name: stagingItem.name,
              quantity: requested.quantity,
              costPrice,
              sellingPrice: Number(stagingItem.sellingPrice || 0),
              subtotal,
            });
            localAuditChanges.push({
              field: `transfer: ${stagingItem.name}`,
              before: `Staging: ${stagingItem.quantity}`,
              after: `Main: ${Number(mainItem?.quantity || 0) + requested.quantity}`,
            });
            transferMutations.push({
              collectionName: stagingItemsCollection,
              docId: stagingItem.id,
              action: 'update',
              data: { quantity: Number(stagingItem.quantity) - requested.quantity, updatedAt: new Date().toISOString() },
            });
            const mainData = mainItem
              ? { quantity: Number(mainItem.quantity || 0) + requested.quantity, updatedAt: new Date().toISOString() }
              : { ...stagingItem, quantity: requested.quantity, held: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            transferMutations.push({
              collectionName: mainStockCollection,
              docId: requested.itemId,
              action: mainItem ? 'update' : 'set',
              data: mainData as any,
            });
          }
          receiptData.totalValue = localTotalValue;
          const expenseRef = doc(collection(firestore, expensesCollection));
          const auditLogRef = doc(collection(firestore, globalAuditLogCollection));
          const localExpense = {
            description: `Stock purchase from ${supplier || 'Staging Area'}` + (invoiceNumber ? ` (Inv #${invoiceNumber})` : ''),
            amount: localTotalValue,
            category: 'Stock',
            date: new Date().toISOString(),
            paymentMethod: 'Payable',
            status: 'Active',
            recordedBy: userProfile.name,
            recordedByUid: userProfile.uid,
            createdAt: new Date().toISOString(),
          };
          const localTransfer = { ...receiptData, transferredAt: new Date().toISOString(), transferredBy: userProfile.name };
          const localAudit = {
            timestamp: new Date().toISOString(),
            userId: userProfile.uid,
            userName: userProfile.name,
            changeType: 'Transfer',
            entityType: 'Stock Transfer',
            entityId: transferLogRef.id,
            details: `Transferred ${itemsWithValidQuantity.length} item type(s) from staging to main inventory.`,
            changes: localAuditChanges,
            notes: `Total Cost: ${formatCurrency(localTotalValue)}. Supplier: ${supplier || 'N/A'}. Invoice: ${invoiceNumber || 'N/A'}.`,
            keywords: ['transfer', 'stock', 'inventory', ...receiptData.items.map(entry => entry.name.toLowerCase())],
          };
          transferMutations.push(
            { collectionName: expensesCollection, docId: expenseRef.id, action: 'set', data: localExpense },
            { collectionName: transferLogCollection, docId: transferLogRef.id, action: 'set', data: localTransfer as any },
            { collectionName: globalAuditLogCollection, docId: auditLogRef.id, action: 'set', data: localAudit },
          );
          await commitLocalFirstMutations(
            transferMutations,
            `stock-transfer:${transferLogRef.id}`,
            async () => {
              await runTransaction(firestore, async (transaction) => {
                const auditRef = doc(firestore, globalAuditLogCollection, auditLogRef.id);
                const stagingRefs = itemsWithValidQuantity.map(({ itemId }) => doc(firestore, stagingItemsCollection, itemId));
                const mainRefs = itemsWithValidQuantity.map(({ itemId }) => doc(firestore, mainStockCollection, itemId));
                const stagingSnapshots = await Promise.all(stagingRefs.map(ref => transaction.get(ref)));
                const mainSnapshots = await Promise.all(mainRefs.map(ref => transaction.get(ref)));
                stagingSnapshots.forEach((snapshot, index) => {
                  const quantity = itemsWithValidQuantity[index].quantity;
                  if (!snapshot.exists() || Number(snapshot.data().quantity || 0) < quantity) throw new Error('Insufficient staging stock during cloud transfer.');
                  transaction.update(stagingRefs[index], { quantity: increment(-quantity) });
                  if (mainSnapshots[index].exists()) transaction.update(mainRefs[index], { quantity: increment(quantity) });
                  else transaction.set(mainRefs[index], { ...snapshot.data(), quantity, held: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
                });
                transaction.set(doc(firestore, expensesCollection, expenseRef.id), { ...localExpense, date: serverTimestamp(), createdAt: serverTimestamp() });
                transaction.set(transferLogRef, { ...localTransfer, transferredAt: serverTimestamp() });
                transaction.set(auditRef, { ...localAudit, timestamp: serverTimestamp() });
              });
            }
          );
        } else {
        await runTransaction(firestore, async (transaction) => {
            const auditLogRef = doc(collection(firestore, globalAuditLogCollection));
            const readPromises = itemsWithValidQuantity.map(({ itemId }) => {
                const stagingItemRef = doc(firestore, stagingItemsCollection, itemId);
                const mainStockRef = doc(firestore, mainStockCollection, itemId);
                return Promise.all([transaction.get(stagingItemRef), transaction.get(mainStockRef)]);
            });

            const snapshots = await Promise.all(readPromises);

            let currentTotalValue = 0;
            const auditChanges: any[] = [];

            for (let i = 0; i < snapshots.length; i++) {
                const [stagingDoc, mainStockDoc] = snapshots[i];
                const { itemId, quantity } = itemsWithValidQuantity[i];

                if (!stagingDoc.exists() || stagingDoc.data().quantity < quantity) {
                    throw new Error(`Not enough stock for ${stagingDoc.data()?.name || 'item'} in staging.`);
                }

                const itemData = stagingDoc.data() as StockItem;
                const costForThisItem = (itemData.costPrice || 0) * quantity;
                currentTotalValue += costForThisItem;

                receiptData.items.push({
                    id: itemId,
                    name: itemData.name,
                    quantity: quantity,
                    costPrice: itemData.costPrice || 0,
                    sellingPrice: itemData.sellingPrice || 0,
                    subtotal: costForThisItem,
                });

                auditChanges.push({
                    field: `transfer: ${itemData.name}`,
                    before: `Staging: ${itemData.quantity}`,
                    after: `Main: ${(mainStockDoc.data()?.quantity || 0) + quantity}`
                });

                const stagingItemRef = doc(firestore, stagingItemsCollection, itemId);
                const mainStockRef = doc(firestore, mainStockCollection, itemId);

                transaction.update(stagingItemRef, { quantity: increment(-quantity) });

                if (mainStockDoc.exists()) {
                    transaction.update(mainStockRef, { quantity: increment(quantity) });
                } else {
                    transaction.set(mainStockRef, {
                        ...itemData,
                        quantity: quantity,
                        held: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }
            }

            receiptData.totalValue = currentTotalValue;

            const expenseRef = doc(firestore, expensesCollection, transferLogRef.id);
            transaction.set(expenseRef, {
                description: `Stock purchase from ${supplier || 'Staging Area'}` + (invoiceNumber ? ` (Inv #${invoiceNumber})` : ''),
                amount: currentTotalValue,
                category: 'Stock',
                date: serverTimestamp(),
                paymentMethod: 'Payable',
                status: 'Active',
                recordedBy: userProfile.name,
                recordedByUid: userProfile.uid,
                createdAt: serverTimestamp(),
            });

            transaction.set(transferLogRef, {
                ...receiptData,
                transferredAt: serverTimestamp(),
                transferredBy: userProfile.name,
            });

            // Audit Log Entry
            transaction.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: userProfile.uid,
                userName: userProfile.name,
                changeType: 'Transfer',
                entityType: 'Stock Transfer',
                entityId: transferLogRef.id,
                details: `Transferred ${itemsWithValidQuantity.length} item type(s) from staging to main inventory.`,
                changes: auditChanges,
                notes: `Total Cost: ${formatCurrency(currentTotalValue)}. Supplier: ${supplier || 'N/A'}. Invoice: ${invoiceNumber || 'N/A'}.`,
                keywords: ['transfer', 'stock', 'inventory', ...receiptData.items.map(i => i.name.toLowerCase())]
            });
        });
        }

        if (settings?.enableTransferReceipts && settings.transferReceiptPhoneNumber) {
            const itemsList = receiptData.items.map(i => `- ${i.name} (x${i.quantity})`).join('\n');
            const message = `*Stock Transfer Receipt*\n\n*ID:* ${receiptData.id.substring(0, 8)}\n*Date:* ${format(receiptData.transferredAt, 'PPpp')}\n*By:* ${receiptData.transferredBy}\n\n*Items:*\n${itemsList}\n\n*Total Cost:* *${formatCurrency(receiptData.totalValue)}*`;

            await sendWhatsAppMessage({
                phone: settings.transferReceiptPhoneNumber,
                message: message,
            });
        }

        toast({
            variant: 'success',
            title: 'Transfer Complete',
            description: `${itemsWithValidQuantity.length} item(s) moved to main inventory and an expense has been created.`
        });

        onSuccess(receiptData);
        onClose();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsSaving(false);
    }
  };


  const canConfirm = React.useMemo(() => {
    return Object.values(transferQuantities).some(val => val !== '' && Number(val) > 0);
  }, [transferQuantities]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer Items to Main Inventory</DialogTitle>
          <DialogDescription>
            Enter the quantity to transfer for each item. This will add them to main stock and create an unpaid expense.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <ScrollArea className="h-64 border rounded-md">
                <div className="p-4 space-y-3">
                    {itemsToTransfer.map(item => (
                        <div key={item.id} className="flex items-center gap-4 text-sm">
                             <div className="flex-1">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-xs text-muted-foreground">Staged: {item.quantity} | Cost: {formatCurrency(item.costPrice || 0)}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, String(Number(transferQuantities[item.id] || 0) - 1))} disabled={Number(transferQuantities[item.id] || 0) <= 0}><Minus className="h-4 w-4" /></Button>
                                <Input
                                    type="number"
                                    value={transferQuantities[item.id] ?? ''}
                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                    className="text-center w-16 h-8"
                                    placeholder="0"
                                    max={item.quantity}
                                    min={0}
                                />
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQuantityChange(item.id, String(Number(transferQuantities[item.id] || 0) + 1))} disabled={Number(transferQuantities[item.id] || 0) >= item.quantity}><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
             <Separator />
            <div className="text-right font-bold text-lg border-t pt-2">
                Total Transfer Value: {formatCurrency(totalValue)}
            </div>
            <div className="space-y-2">
                <Label htmlFor="supplier">Supplier (Optional)</Label>
                <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="supplier" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier Name" className="pl-10" />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice Number (Optional)</Label>
                <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Invoice #" />
            </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleConfirm} loading={isSaving} disabled={itemsToTransfer.length === 0 || totalValue <= 0}>
            <Send className="mr-2 h-4 w-4" />
            Confirm Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
