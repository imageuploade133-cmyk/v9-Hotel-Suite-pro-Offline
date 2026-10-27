
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { collection, doc, runTransaction, serverTimestamp, increment, getDoc, updateDoc } from 'firebase/firestore';
import type { TransferLog, StockItem } from '@/lib/types';
import { Input } from '../ui/input';
import { Undo2, Minus, Plus } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useSettings } from '@/contexts/settings-context';
import { Separator } from '../ui/separator';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useBranch } from '@/contexts/branch-context';

interface ReverseTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  log: any | null;
  onSuccess: () => void;
}

const CONFIRM_REVERSE_PHRASE = 'REVERSE';

type TransferLogItem = TransferLog['items'][number];

interface ReversibleItem extends TransferLogItem {
    quantityToReverse: number;
    previouslyReversed: number;
}

export function ReverseTransferDialog({ isOpen, onClose, log, onSuccess }: ReverseTransferDialogProps) {
  const [isReversing, setIsReversing] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirmationText, setConfirmationText] = React.useState('');
  const [items, setItems] = React.useState<ReversibleItem[]>([]);

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, userProfile } = useUser();
  const { settings } = useSettings();
  const { getCollectionPath } = useBranch();
  const currency = settings?.currency || 'USD';

  // Get collection paths based on branch context
  const transferLogCollection = React.useMemo(() => getCollectionPath('transferLog'), [getCollectionPath]);
  const expensesCollection = React.useMemo(() => getCollectionPath('expenses'), [getCollectionPath]);
  const mainStockCollection = React.useMemo(() => getCollectionPath('stock'), [getCollectionPath]);
  const stagingItemsCollection = React.useMemo(() => getCollectionPath('stockKeeperItems'), [getCollectionPath]);

  React.useEffect(() => {
    if (log && log.items) {
        const initialItems = log.items.map((item: TransferLogItem) => ({
            ...item,
            quantityToReverse: 0,
            previouslyReversed: (log.reversedItems || []).find((ri: { id: string }) => ri.id === item.id)?.quantity || 0,
        }));
        setItems(initialItems);
    }
  }, [log]);


  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId) {
          const maxReturnable = item.quantity - item.previouslyReversed;
          const validatedQuantity = Math.max(0, Math.min(newQuantity, maxReturnable));
          return { ...item, quantityToReverse: validatedQuantity };
        }
        return item;
      })
    );
  };

  const totalReverseValue = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (item.costPrice * item.quantityToReverse), 0);
  }, [items]);

  const handleReverse = async () => {
    if (!firestore || !log || !user || !user.email || !userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot reverse transfer. Missing critical information.' });
      return;
    }

    if (!password) {
        toast({ variant: 'destructive', title: 'Password Required', description: 'Please enter your password to confirm.' });
        return;
    }

    if (confirmationText !== CONFIRM_REVERSE_PHRASE) {
        toast({ variant: 'destructive', title: 'Confirmation Required', description: `Please type '${CONFIRM_REVERSE_PHRASE}' to confirm.` });
        return;
    }

    const itemsToReverse = items.filter(item => item.quantityToReverse > 0);
    if (itemsToReverse.length === 0) {
        toast({ variant: 'destructive', title: 'No Items Selected', description: 'Please specify a quantity to reverse for at least one item.' });
        return;
    }

    setIsReversing(true);

    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        await runTransaction(firestore, async (transaction) => {
            const transferLogRef = doc(firestore, transferLogCollection, log.id);
            const expenseRef = doc(firestore, expensesCollection, log.id);
            const expenseDoc = await transaction.get(expenseRef);

            if (!expenseDoc.exists()) {
                throw new Error("Associated expense record not found. It may have already been reversed or deleted.");
            }

            const itemRefs = itemsToReverse.map((item) => ({
                mainStockRef: doc(firestore, mainStockCollection, item.id),
                stagingStockRef: doc(firestore, stagingItemsCollection, item.id),
                itemData: item,
            }));

            const mainStockDocs = await Promise.all(itemRefs.map(ref => transaction.get(ref.mainStockRef)));
            const stagingStockDocs = await Promise.all(itemRefs.map(ref => transaction.get(ref.stagingStockRef)));

            for (let i = 0; i < itemRefs.length; i++) {
                const mainStockDoc = mainStockDocs[i];
                const { itemData } = itemRefs[i];

                if (!mainStockDoc.exists() || mainStockDoc.data().quantity < itemData.quantityToReverse) {
                    throw new Error(`Not enough stock for "${itemData.name}" in the main inventory to reverse.`);
                }
            }

            for (let i = 0; i < itemRefs.length; i++) {
                const { mainStockRef, stagingStockRef, itemData } = itemRefs[i];
                const stagingDoc = stagingStockDocs[i];

                transaction.update(mainStockRef, { quantity: increment(-itemData.quantityToReverse) });

                if (stagingDoc.exists()) {
                    transaction.update(stagingStockRef, { quantity: increment(itemData.quantityToReverse) });
                } else {
                     const { subtotal, quantityToReverse, previouslyReversed, ...itemDataForStaging } = itemData;
                    transaction.set(stagingStockRef, {
                        ...itemDataForStaging,
                        quantity: quantityToReverse,
                        held: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }
            }

            // Update or delete expense
            const newExpenseAmount = expenseDoc.data().amount - totalReverseValue;
            if (newExpenseAmount <= 0.001) { // Floating point safe check
                transaction.delete(expenseRef);
            } else {
                transaction.update(expenseRef, { amount: newExpenseAmount });
            }

            // Update transfer log with reversed items
            const updatedReversedItems = [...(log.reversedItems || [])];
            itemsToReverse.forEach(itemToReverse => {
                const existing = updatedReversedItems.find(ri => ri.id === itemToReverse.id);
                if (existing) {
                    existing.quantity += itemToReverse.quantityToReverse;
                } else {
                    updatedReversedItems.push({ id: itemToReverse.id, quantity: itemToReverse.quantityToReverse });
                }
            });

            const allItemsReversed = log.items.every((originalItem: any) => {
                const totalReversed = updatedReversedItems.find(ri => ri.id === originalItem.id)?.quantity || 0;
                return totalReversed >= originalItem.quantity;
            });

            transaction.update(transferLogRef, {
                reversedItems: updatedReversedItems,
                status: allItemsReversed ? 'Reversed' : 'Partially Reversed'
            });

            const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
            transaction.set(auditLogRef, {
                timestamp: serverTimestamp(),
                userId: userProfile.uid,
                userName: userProfile.name,
                changeType: 'Update',
                entityType: 'Stock Transfer',
                entityId: log.id,
                details: `Reversed stock transfer.`,
                changes: itemsToReverse.map((i: any) => ({ field: `Reversed: ${i.name}`, before: i.quantity, after: i.quantity - i.quantityToReverse })),
                notes: `Reversal Amount: ${formatCurrency(totalReverseValue)}`,
                keywords: ['reverse', 'transfer', 'stock', 'inventory', ...itemsToReverse.map((i:any) => i.name.toLowerCase())]
            });
        });

        toast({
            variant: 'success',
            title: 'Transfer Reversal Processed',
            description: 'The stock transfer has been partially or fully reversed.',
        });
        onSuccess();
        onClose();
    } catch (error: any) {
        let errorMessage = 'An unexpected error occurred.';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        toast({ variant: 'destructive', title: 'Reversal Failed', description: errorMessage });
    } finally {
        setIsReversing(false);
        setPassword('');
        setConfirmationText('');
    }
  };

  if (!log) return null;

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Reverse Stock Transfer</AlertDialogTitle>
          <AlertDialogDescription>
            Specify the quantity of each item to return to the staging area. This will adjust main inventory and update the associated expense.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-4">
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-4 space-y-3">
              {items.map(item => {
                const maxReturnable = item.quantity - item.previouslyReversed;
                if (maxReturnable <= 0) return null;

                return (
                  <div key={item.id} className="p-3 border rounded-lg space-y-2">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Transferred: {item.quantity} | Available to Return: {maxReturnable}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`return-${item.id}`}>Quantity to Reverse</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuantityChange(item.id, item.quantityToReverse - 1)}
                          disabled={item.quantityToReverse <= 0}
                        ><Minus className="h-4 w-4" /></Button>
                        <Input
                          id={`return-${item.id}`}
                          type="number"
                          value={item.quantityToReverse}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value, 10) || 0)}
                          className="w-16 h-8 text-center"
                          placeholder="0"
                          max={maxReturnable}
                          min={0}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuantityChange(item.id, item.quantityToReverse + 1)}
                          disabled={item.quantityToReverse >= maxReturnable}
                        ><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
           <Separator />
           <div className="text-right font-bold text-lg border-t pt-2">
                Total Reversal Value (Cost): {formatCurrency(totalReverseValue)}
            </div>
            <div>
                <Label htmlFor="password-confirm">Your Password</Label>
                <Input
                    id="password-confirm"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password to confirm"
                />
            </div>
            <div>
                <Label htmlFor="reverse-confirmation">Type 'REVERSE' to confirm</Label>
                <Input
                    id="reverse-confirmation"
                    type="text"
                    value={confirmationText}
                    onChange={e => setConfirmationText(e.target.value)}
                    placeholder={`Type '${CONFIRM_REVERSE_PHRASE}' to confirm`}
                />
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReversing}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleReverse}
            loading={isReversing}
            disabled={!password || confirmationText !== CONFIRM_REVERSE_PHRASE || isReversing || totalReverseValue <= 0}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Confirm Reversal
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
