
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Customer, StockSale, Payment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/contexts/settings-context';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { useOnClickOutside } from '@/hooks/use-on-click-outside';

interface CustomerSearchProps {
  onSelectCustomer: (customer: (Partial<Customer> & { outstandingBalance?: number }) | null) => void;
  collectionName?: string;
}

export function CustomerSearch({ onSelectCustomer, collectionName = 'customers' }: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<
    (Partial<Customer> & { outstandingBalance?: number }) | null
  >(null);
  const firestore = useFirestore();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';
  const searchRef = React.useRef<HTMLDivElement>(null);

  useOnClickOutside(searchRef, () => setIsFocused(false));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  const customersQuery = React.useMemo(() => {
    if (!firestore || !collectionName) return null;
    return query(collection(firestore, collectionName), orderBy('name', 'asc'));
  }, [firestore, collectionName]);

  const { data: allCustomers, isLoading: areCustomersLoading, error: customersError } = useCollection<Customer>(customersQuery);

  const salesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'stockSales')) : null, [firestore]);
  const paymentsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'payments'), where('type', '==', 'Credit Repayment')) : null, [firestore]);

  const { data: allSales, isLoading: areSalesLoading } = useCollection<StockSale>(salesQuery);
  const { data: allCreditPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);

  // Handle collection errors
  React.useEffect(() => {
    if (customersError) {
      console.error('CustomerSearch error loading customers:', customersError);
    }
  }, [customersError]);

  const customersWithData = React.useMemo(() => {
    if (!allCustomers) return [];
    if (!allSales || !allCreditPayments) return allCustomers;

    const customerIds = new Set(allCustomers.map(c => c.id));
    const customerEmails = new Set(allCustomers.map(c => c.email).filter(Boolean));

    const relevantSales = allSales.filter(s => (s.customerId && customerIds.has(s.customerId)) || (s.customerEmail && customerEmails.has(s.customerEmail)));
    const relevantCreditPayments = allCreditPayments.filter(p => p.guestEmail && customerEmails.has(p.guestEmail));

    return allCustomers.map(customer => {
        const customerSales = relevantSales.filter(s => s.customerId === customer.id || (customer.email && s.customerEmail === customer.email));
        const customerCreditPayments = relevantCreditPayments.filter(p => customer.email && p.guestEmail === customer.email);

        const totalSpent = customerSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalCreditSales = customerSales.filter(s => s.paymentMethod === 'Credit').reduce((sum, sale) => sum + sale.totalAmount - (sale.initialPaymentAmount || 0), 0);
        const totalRepayments = customerCreditPayments.reduce((sum, p) => sum + p.amount, 0);

        const outstandingBalance = totalCreditSales - totalRepayments;
        return {
          ...customer,
          totalSpent,
          outstandingBalance: Math.max(0, outstandingBalance),
        };
    });
  }, [allCustomers, allSales, allCreditPayments]);

  const filteredCustomers = React.useMemo(() => {
    if (!customersWithData) return [];
    if (!searchTerm) return customersWithData;
    const lowercasedTerm = searchTerm.toLowerCase();
    return customersWithData.filter(c =>
        c.name.toLowerCase().includes(lowercasedTerm) ||
        (c.email && c.email.toLowerCase().includes(lowercasedTerm))
    );
  }, [customersWithData, searchTerm]);

  const handleSelect = (customer: (Customer & { outstandingBalance?: number }) | null) => {
    onSelectCustomer(customer);
    setSelectedCustomer(customer);
    setIsFocused(false);
    if (customer) {
      setSearchTerm(customer.name || '');
    } else {
      setSearchTerm('');
    }
  };

  const handleClearSelection = () => {
    setSelectedCustomer(null);
    setSearchTerm('');
    onSelectCustomer(null);
  };

  const isLoading = areCustomersLoading || areSalesLoading || arePaymentsLoading;

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search existing customers..."
            value={selectedCustomer ? selectedCustomer.name || '' : searchTerm}
            onFocus={() => {
              if (!selectedCustomer) {
                setIsFocused(true);
              }
            }}
            onChange={(e) => {
              if (selectedCustomer) {
                setSelectedCustomer(null);
                onSelectCustomer(null);
              }
              setSearchTerm(e.target.value);
              setIsFocused(true);
            }}
            className={cn('pl-10', selectedCustomer && 'pr-10')}
          />
          {selectedCustomer && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Clear selected customer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
      </div>
      {isFocused && !selectedCustomer && (
        <div className="absolute top-full mt-2 w-full z-10 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-2 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : customersError ? (
            <div className="p-4 text-center text-sm text-destructive">
              Error loading customers. Please try again.
            </div>
          ) : filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => handleSelect(customer)}
                className="p-2 hover:bg-accent cursor-pointer flex justify-between items-center"
              >
                  <div>
                      <p>{customer.name}</p>
                      <p className="text-xs text-muted-foreground">Spent: {formatCurrency(customer.totalSpent || 0)}</p>
                  </div>
                  {customer.outstandingBalance && customer.outstandingBalance > 0 && (
                      <div className="text-xs font-semibold text-destructive">
                      BAL: {formatCurrency(customer.outstandingBalance)}
                      </div>
                  )}
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchTerm ? 'No customer found.' : 'No customers available.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
