
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, X, Phone, Mail, Info } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { useSettings } from '@/contexts/settings-context';
import { CustomerSearch } from '../customers/customer-search';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { getInitials } from '@/lib/helpers';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { AddCustomerForm } from '../customers/add-customer-form';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';

interface CustomerPanelProps {
  selectedCustomer: (Partial<Customer> & { outstandingBalance?: number }) | null;
  onSelectCustomer: (customer: (Partial<Customer> & { outstandingBalance?: number }) | null) => void;
  isSaleRestored: boolean;
  onCustomerAdded?: () => void;
}

export function CustomerPanel({ selectedCustomer, onSelectCustomer, isSaleRestored, onCustomerAdded }: CustomerPanelProps) {
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  }

  const isRegisteredCustomer = selectedCustomer && selectedCustomer.id;

  const handleWalkInNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    onSelectCustomer(newName ? { name: newName } : null);
  };

  const handleClearSelection = () => {
    onSelectCustomer(null);
  };

  const handleSuccess = () => {
    if(onCustomerAdded) onCustomerAdded();
    setIsAddCustomerOpen(false);
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            Customer
            <Button variant="outline" size="sm" onClick={() => setIsAddCustomerOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> New
            </Button>
            {isSaleRestored && (

                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Customer cannot be changed on a restored sale.</p>
                        </TooltipContent>
                    </Tooltip>

            )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset disabled={isSaleRestored} className="space-y-4 group">
          {isRegisteredCustomer ? (
            <div className="flex items-start justify-between rounded-lg border p-4 bg-muted/50 group-disabled:opacity-70">
                <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedCustomer?.photoURL || ''} alt={selectedCustomer?.name} />
                        <AvatarFallback>{getInitials(selectedCustomer?.name || 'C')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-bold">{selectedCustomer.name}</p>
                        {selectedCustomer.phoneNumber && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3"/>{selectedCustomer.phoneNumber}</p>}
                        {selectedCustomer.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3"/>{selectedCustomer.email}</p>}
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearSelection}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
          ) : (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="walk-in-name">Walk-in Customer Name</Label>
                    <Input
                        id="walk-in-name"
                        value={selectedCustomer?.name === 'Walk-in Customer' ? '' : selectedCustomer?.name || ''}
                        onChange={handleWalkInNameChange}
                        placeholder="Enter name (e.g., Table 5) or leave empty"
                    />
                </div>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                        Or search existing
                        </span>
                    </div>
                </div>
                <CustomerSearch onSelectCustomer={onSelectCustomer} collectionName="posCustomers" />
            </div>
          )}
        </fieldset>

        {selectedCustomer?.outstandingBalance !== undefined && selectedCustomer.outstandingBalance > 0 && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">Outstanding Balance:</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedCustomer.outstandingBalance)}</span>
              </div>
          </div>
        )}
      </CardContent>
    </Card>
     <AddCustomerForm
        open={isAddCustomerOpen}
        onOpenChange={setIsAddCustomerOpen}
        onSuccess={handleSuccess}
        collectionName="posCustomers"
    />
    </>
  );
}
