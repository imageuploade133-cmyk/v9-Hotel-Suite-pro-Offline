'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const DATA_COLLECTIONS = [
  { id: 'bookings', label: 'Bookings & Reservations' },
  { id: 'customers', label: 'Hotel Customers' },
  { id: 'pos-customers', label: 'POS Customers' },
  { id: 'stock', label: 'Stock & Inventory' },
  { id: 'stockSales', label: 'Sales & Returns History' },
  { id: 'orders', label: 'Kitchen Orders' },
  { id: 'laundry', label: 'Laundry Orders' },
  { id: 'salonServices', label: 'Salon Services' },
  { id: 'gym-members', label: 'Gym Members' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'globalAuditLog', label: 'Global Audit Log' },
  { id: 'restockHistory', label: 'Stock History' },
  { id: 'payments', label: 'Payment History' },
  { id: 'stockReturns', label: 'Refund History' },
  { id: 'docketHistory', label: 'Dashboard History' },
];

export function DangerZone() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [confirmationText, setConfirmationText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { toast } = useToast();

  const [progress, setProgress] = React.useState(0);
  const [currentAction, setCurrentAction] = React.useState('');
  const [selectedCollections, setSelectedCollections] = React.useState<string[]>([]);

  const allCollectionIds = React.useMemo(() => DATA_COLLECTIONS.map(c => c.id), []);

  const handleDelete = async () => {
    if (selectedCollections.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Selection',
        description: 'Please select at least one data section to delete.',
      });
      return;
    }

    setIsDeleting(true);
    setCurrentAction('Starting deletion process...');
    setProgress(0);

    try {
        const response = await fetch('/api/delete-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Request': 'true' // This is a simplified check
            },
            body: JSON.stringify({ collections: selectedCollections })
        });

        const result = await response.json();

        if (response.ok) {
            toast({
                variant: 'success',
                title: 'Data Deletion Completed',
                description: `Successfully cleared ${result.deletedCollections.length} data section(s).`,
                duration: 8000,
            });
        } else {
            throw new Error(result.error || 'An unknown error occurred on the server.');
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error Deleting Data',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsDeleting(false);
        setIsDialogOpen(false);
        setConfirmationText('');
        setSelectedCollections([]);
    }
  };

  const CONFIRM_PHRASE = 'delete data';

  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                These actions are destructive and cannot be undone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <div>
              <h4 className="font-semibold">Delete Transactional Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete data from selected sections of the application. Staff accounts and settings will not be affected.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setIsDialogOpen(true)}>
              Delete Data
            </Button>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Please select the data sections you wish to permanently delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isDeleting ? (
                <>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center space-x-2">
                           <Checkbox
                            id="select-all"
                            checked={selectedCollections.length === allCollectionIds.length}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                setSelectedCollections(allCollectionIds);
                                } else {
                                setSelectedCollections([]);
                                }
                            }}
                            />
                            <label
                            htmlFor="select-all"
                            className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                            Select All
                            </label>
                        </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto p-1">
                        {DATA_COLLECTIONS.map((collection) => (
                          <div key={collection.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={collection.id}
                              checked={selectedCollections.includes(collection.id)}
                              onCheckedChange={(checked) => {
                                setSelectedCollections(prev =>
                                  checked
                                    ? [...prev, collection.id]
                                    : prev.filter(id => id !== collection.id)
                                );
                              }}
                            />
                            <label
                              htmlFor={collection.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {collection.label}
                            </label>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 pt-4 border-t">
                          <Label htmlFor="delete-confirmation">
                              To confirm, please type "
                              <span className="font-semibold text-destructive">
                                  {CONFIRM_PHRASE}
                              </span>
                              " below.
                          </Label>
                          <Input
                              id="delete-confirmation"
                              value={confirmationText}
                              onChange={(e) => setConfirmationText(e.target.value)}
                              autoComplete="off"
                              disabled={isDeleting}
                              placeholder={`Type '${CONFIRM_PHRASE}' to confirm`}
                          />
                      </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={isDeleting}
                            onClick={() => setConfirmationText('')}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting || confirmationText !== CONFIRM_PHRASE || selectedCollections.length === 0}
                        >
                            Delete Selected Data ({selectedCollections.length})
                        </Button>
                    </AlertDialogFooter>
                </>
           ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-destructive" />
                    <p className="font-semibold">Deletion in progress...</p>
                    <div className="w-full text-center">
                        <p className="text-sm text-muted-foreground">{currentAction}</p>
                        <Progress value={progress} className="mt-2" />
                    </div>
                </div>
           )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
