
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import type { Customer, StockSale, Payment } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getColumns } from './columns';
import { BulkActions } from './bulk-actions';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { EmptyState } from '../ui/empty-state';
import { Users, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings } from '@/contexts/settings-context';
import { BulkMessageDialog } from '../messaging/bulk-whatsapp-dialog';
import { useBranch } from '@/contexts/branch-context';
import type { VisibilityState, RowSelectionState } from '@tanstack/react-table';

interface CustomerListProps {
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  onPayCredit?: (customer: Customer & { outstandingBalance?: number }) => void;
  onBulkDelete: (customers: Customer[]) => void;
  onBulkEdit: (customers: Customer[]) => void;
  onViewImage: (imageUrl: string | undefined) => void;
  reloadCounter: number;
  collectionName?: 'customers' | 'pos-customers';
  pageName?: string;
}

export function CustomerList({
  onEditCustomer,
  onDeleteCustomer,
  onPayCredit,
  onBulkDelete,
  onBulkEdit,
  onViewImage,
  reloadCounter,
  collectionName = 'customers',
  pageName = 'customers',
}: CustomerListProps) {
  const firestore = useFirestore();
  const { getCollectionPath } = useBranch();

  const customersQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, collectionName), orderBy('name', 'asc'));
  }, [firestore, reloadCounter, collectionName]);

  const { data: customers, isLoading } = useCollection<Customer>(customersQuery);

  const [isMessageOpen, setIsMessageOpen] = React.useState(false);
  const [selectedForMessage, setSelectedForMessage] = React.useState<Customer[]>(
    []
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})


  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';

  const [customersWithData, setCustomersWithData] = React.useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  React.useEffect(() => {
    const processData = async () => {
      if (pageName !== 'pos-customers' || !customers) {
        setCustomersWithData(customers || []);
        setIsDataLoading(false);
        return;
      }

      setIsDataLoading(true);
      if (!firestore) {
        setIsDataLoading(false);
        return;
      }

      const [salesSnapshot, paymentsSnapshot] = await Promise.all([
          getDocs(query(collection(firestore, getCollectionPath('stockSales')))),
          // Payments are stored at root level, not branch-isolated
          getDocs(query(collection(firestore, 'payments'), where('type', '==', 'Credit Repayment')))
      ]);
      const allSales = salesSnapshot.docs.map(d => d.data() as StockSale);
      // Filter payments by checking if they're related to sales in this branch
      const salesIds = new Set(allSales.map(s => s.id));
      const allCreditPayments = paymentsSnapshot.docs
        .map(d => d.data() as Payment)
        .filter(p => p.bookingId && salesIds.has(p.bookingId));

      const processedData = customers.map(customer => {
        const customerSales = allSales.filter(s => s.customerId === customer.id || (customer.email && s.customerEmail === customer.email));
        const customerCreditPayments = allCreditPayments.filter(p => customer.email && p.guestEmail === customer.email);

        const totalSpent = customerSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalCreditSales = customerSales.filter(s => s.paymentMethod === 'Credit').reduce((sum, sale) => sum + sale.totalAmount - (sale.initialPaymentAmount || 0), 0);
        const totalRepayments = customerCreditPayments.reduce((sum, p) => sum + p.amount, 0);

        const outstandingBalance = totalCreditSales - totalRepayments;
        const totalPaid = totalSpent - outstandingBalance;

        return {
          ...customer,
          totalSpent,
          totalPaid,
          outstandingBalance: Math.max(0, outstandingBalance),
        };
      });
      setCustomersWithData(processedData);
      setIsDataLoading(false);
    };

    if (customers) {
        processData();
    }
  }, [customers, pageName, firestore]);

  const handleBulkMessage = (items: Customer[]) => {
    setSelectedForMessage(items);
    setIsMessageOpen(true);
  };

  const columns = React.useMemo(
    () => getColumns({ onEdit: onEditCustomer, onDelete: onDeleteCustomer, onViewImage, onPayCredit, pageName, currency: userCurrency }),
    [onEditCustomer, onDeleteCustomer, onViewImage, onPayCredit, pageName, userCurrency]
  );

  if (isLoading || isDataLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between">
                <Skeleton className="h-10 w-1/4" />
                <Skeleton className="h-10 w-1/4" />
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customersWithData.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={Users}
            title="No Customers Found"
            description="No customers have been added yet."
            className="h-96"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={customersWithData || []}
        filterColumn="name"
        filterPlaceholder="Filter by name or email..."
        tableId={`${pageName}-list`}
        isPaginated
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      >
        {table => (
          <BulkActions
            table={table}
            onBulkDelete={onBulkDelete}
            onBulkEdit={onBulkEdit}
            onBulkMessage={handleBulkMessage}
          />
        )}
      </DataTable>
      <BulkMessageDialog
        isOpen={isMessageOpen}
        onClose={() => setIsMessageOpen(false)}
        recipients={selectedForMessage}
      />
    </>
  );
}
