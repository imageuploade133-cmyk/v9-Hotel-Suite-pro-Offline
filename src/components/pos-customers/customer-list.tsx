
'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import type { Customer, StockSale, Payment } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { getColumns } from './columns';
import { BulkActions } from '../customers/bulk-actions';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { EmptyState } from '../ui/empty-state';
import { Users, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings } from '@/contexts/settings-context';
import { BulkMessageDialog } from '../messaging/bulk-whatsapp-dialog';
import type { RowSelectionState } from '@tanstack/react-table';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/branch-context';

interface CustomerListProps {
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  onPayCredit?: (customer: Customer & { outstandingBalance?: number }) => void;
  onBulkDelete: (customers: Customer[]) => void;
  onBulkEdit: (customers: Customer[]) => void;
  onViewImage: (imageUrl: string | undefined) => void;
  reloadCounter: number;
  collectionName?: string;
  pageName?: string;
  globalData?: Customer[]; // Pre-fetched global data from useGlobalCollectionData
}

export function CustomerList({
  onEditCustomer,
  onDeleteCustomer,
  onPayCredit,
  onBulkDelete,
  onBulkEdit,
  onViewImage,
  reloadCounter,
  collectionName = 'pos-customers',
  pageName = 'pos-customers',
  globalData,
}: CustomerListProps) {
  const firestore = useFirestore();
  const { userProfile } = useUser();
  const { toast } = useToast();
  const { getCollectionPath, isGlobalMode, branches } = useBranch();

  // Query from current branch (only used if globalData not provided)
  const customersQuery = React.useMemo(() => {
    if (!firestore || !collectionName || globalData) return null;
    const collectionPath = getCollectionPath(collectionName);
    return query(collection(firestore, collectionPath), orderBy('name', 'asc'));
  }, [firestore, reloadCounter, collectionName, getCollectionPath, globalData]);

  const { data: branchCustomers, isLoading: branchLoading, error } = useCollection<Customer>(customersQuery);

  // Use either global data or branch data
  const customers = globalData || branchCustomers || [];
  const isLoading = globalData ? false : branchLoading;

  const [isMessageOpen, setIsMessageOpen] = React.useState(false);
  const [selectedForMessage, setSelectedForMessage] = React.useState<Customer[]>(
    []
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})


  const { settings } = useSettings();
  const userCurrency = settings?.currency || 'USD';

  const [customersWithData, setCustomersWithData] = React.useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = React.useState(true);

  // Fetch global sales data when in global mode to properly calculate financials
  const fetchGlobalSales = React.useCallback(async (): Promise<StockSale[]> => {
    if (!firestore || !isGlobalMode) return [];

    const allSales: StockSale[] = [];

    try {
      // Fetch from root-level stockSales
      const rootSalesSnapshot = await getDocs(collection(firestore, 'stockSales'));
      rootSalesSnapshot.docs.forEach(doc => {
        allSales.push({ id: doc.id, ...doc.data() } as StockSale);
      });

      // Fetch from each branch's stockSales
      for (const branch of branches) {
        try {
          const branchSalesSnapshot = await getDocs(
            collection(firestore, `branches/${branch.id}/stockSales`)
          );
          branchSalesSnapshot.docs.forEach(doc => {
            allSales.push({ id: doc.id, ...doc.data(), branchId: branch.id } as StockSale);
          });
        } catch (e) {
          console.warn(`Could not fetch sales for branch ${branch.id}:`, e);
        }
      }
    } catch (error) {
      console.error('Error fetching global sales:', error);
    }

    return allSales;
  }, [firestore, isGlobalMode, branches]);

  // Fetch global payments when in global mode
  const fetchGlobalPayments = React.useCallback(async (): Promise<Payment[]> => {
    if (!firestore || !isGlobalMode) return [];

    try {
      const paymentsSnapshot = await getDocs(
        query(
          collection(firestore, 'payments'),
          where('type', 'in', ['POS', 'Credit Repayment'])
        )
      );
      return paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    } catch (error) {
      console.error('Error fetching global payments:', error);
      return [];
    }
  }, [firestore, isGlobalMode]);

  // Handle errors from Firestore
  React.useEffect(() => {
    if (error) {
      console.error('CustomerList Firestore error:', error);
      const errorMessage = error.message || String(error);
      const indexMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
      const indexUrl = indexMatch ? indexMatch[0] : null;

      if (indexUrl) {
        console.error('Firestore index required. Create it here:', indexUrl);
        toast({
          variant: 'destructive',
          title: 'Firestore Index Required',
          description: 'Please create the required Firestore index.',
        });
      }
    }
  }, [error, toast]);

  // Calculate customer financials (Total Spent, Total Paid, Balance Due)
  React.useEffect(() => {
    const processData = async () => {
      if (isLoading || !customers || customers.length === 0) {
        setCustomersWithData([]);
        setIsDataLoading(false);
        return;
      }

      setIsDataLoading(true);
      if (!firestore) {
        setCustomersWithData(customers);
        setIsDataLoading(false);
        return;
      }

      try {
        let allSales: StockSale[] = [];
        let allPayments: Payment[] = [];

        if (isGlobalMode) {
          // In global mode, fetch sales and payments from all branches
          [allSales, allPayments] = await Promise.all([
            fetchGlobalSales(),
            fetchGlobalPayments()
          ]);
        } else {
          // In branch mode, fetch from current branch only
          const salesRef = collection(firestore, getCollectionPath('stockSales'));
          const salesSnapshot = await getDocs(salesRef);
          allSales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockSale));

          // Fetch payments from root level, then filter by related sales
          const paymentsSnapshot = await getDocs(
            query(
              collection(firestore, 'payments'),
              where('type', 'in', ['POS', 'Credit Repayment'])
            )
          );
          const paymentsList = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));

          // Filter payments to only include those related to this branch's sales
          const salesIds = new Set(allSales.map(s => s.id));
          allPayments = paymentsList.filter(p => salesIds.has(p.bookingId || ''));
        }

        // Calculate financials for each customer
        const enrichedCustomers = customers.map(customer => {
          // Filter sales for this customer - match by customerId or customerEmail
          const customerSales = allSales.filter(sale =>
            sale.customerId === customer.id ||
            (sale.customerEmail && sale.customerEmail === customer.email)
          );

          const totalPurchases = customerSales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0);

          // For payments, match by bookingId being one of the customer's sales
          const customerPaymentIds = new Set(customerSales.map(s => s.id));
          const customerPayments = allPayments.filter(p => customerPaymentIds.has(p.bookingId || ''));

          const totalPayments = customerPayments.reduce((acc, payment) => acc + (payment.amount || 0), 0);

          const outstandingBalance = totalPurchases - totalPayments;

          return {
            ...customer,
            totalSpent: totalPurchases,
            totalPaid: totalPayments,
            outstandingBalance: Math.max(0, outstandingBalance),
          };
        });

        setCustomersWithData(enrichedCustomers);
      } catch (error) {
        console.error('Error calculating customer financials:', error);
        // Fallback to showing customers without financials
        setCustomersWithData(customers);
      } finally {
        setIsDataLoading(false);
      }
    };

    processData();
  }, [customers, isLoading, firestore, isGlobalMode, getCollectionPath, fetchGlobalSales, fetchGlobalPayments, reloadCounter]);

  const handleBulkMessage = (items: Customer[]) => {
    setSelectedForMessage(items);
    setIsMessageOpen(true);
  };

  const columns = React.useMemo(
    () => getColumns({ onEdit: onEditCustomer, onDelete: onDeleteCustomer, onViewImage, onPayCredit, pageName, currency: userCurrency }),
    [onEditCustomer, onDeleteCustomer, onViewImage, onPayCredit, pageName, userCurrency]
  );

  const dataIsLoading = isLoading || isDataLoading;

  // Handle missing collection
  if (!collectionName) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Collection Not Configured"
            description="This inventory space does not have a customers collection configured."
            className="h-96"
          />
        </CardContent>
      </Card>
    );
  }

  // Handle Firestore errors
  if (error) {
    const errorMessage = error.message || String(error);
    const indexMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    const indexUrl = indexMatch ? indexMatch[0] : null;

    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Error Loading Customers"
            description={errorMessage}
            className="h-96"
          >
            {indexUrl && (
              <Button asChild variant="outline" className="mt-4">
                <a href={indexUrl} target="_blank" rel="noopener noreferrer">
                  Create Firestore Index
                </a>
              </Button>
            )}
          </EmptyState>
        </CardContent>
      </Card>
    );
  }

  if (dataIsLoading) {
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
