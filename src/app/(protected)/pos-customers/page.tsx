
'use client';

import * as React from 'react';
import { CreditCard } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { CustomerList } from '@/components/pos-customers/customer-list';
import type { Customer, Payment } from '@/lib/types';
import { DeleteCustomerDialog } from '@/components/customers/delete-customer-dialog';
import { BulkDeleteCustomerDialog } from '@/components/customers/bulk-delete-customer-dialog';
import { EditCustomerForm } from '@/components/customers/edit-customer-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { BulkEditCustomerDialog } from '@/components/customers/bulk-edit-customer-dialog';
import { Button } from '@/components/ui/button';
import { AddCustomerForm } from '@/components/customers/add-customer-form';
import { PayCreditDialog } from '@/components/customers/pay-credit-dialog';
import { CreditPaymentReceiptDialog } from '@/components/customers/credit-payment-receipt-dialog';
import { useBranch, type PointOfSale } from '@/contexts/branch-context';
import { useGlobalCollectionData } from '@/hooks/use-global-collection-data';


function PosCustomersPage() {
  const { isBranchMode, currentBranch, isGlobalMode } = useBranch();

  // Fetch all customers across all branches in global mode
  const { data: globalCustomers } = useGlobalCollectionData<Customer>('posCustomers', [], {
    realtime: true,
  });
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = React.useState(false);
  const [isPayCreditOpen, setIsPayCreditOpen] = React.useState(false);
  const [imageToView, setImageToView] = React.useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [receiptData, setReceiptData] = React.useState<{ payment: Payment; customer: Customer; balance: number } | null>(null);


  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);
  const [customerToPay, setCustomerToPay] = React.useState<(Customer & { outstandingBalance?: number }) | null>(null);
  const [selectedCustomers, setSelectedCustomers] = React.useState<Customer[]>(
    []
  );

  const handleDataMutation = (paymentData?: { payment: Payment, customer: Customer, balance: number }) => {
    setReloadCounter(prev => prev + 1);
    if (paymentData) {
      setReceiptData(paymentData);
    }
  };


  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditOpen(true);
  };

  const handlePayCredit = (customer: Customer & { outstandingBalance?: number }) => {
    setCustomerToPay(customer);
    setIsPayCreditOpen(true);
  }

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = (customers: Customer[]) => {
    setSelectedCustomers(customers);
    setIsBulkDeleteOpen(true);
  };

  const handleBulkEdit = (customers: Customer[]) => {
    setSelectedCustomers(customers);
    setIsBulkEditOpen(true);
  };

  const handleViewImage = (imageUrl: string | undefined) => {
    if (imageUrl) {
      setImageToView(imageUrl);
    }
  };

  const handleCloseDialogs = () => {
    setSelectedCustomer(null);
    setSelectedCustomers([]);
    setCustomerToPay(null);
    setIsAddOpen(false);
    setIsEditOpen(false);
    setIsDeleteOpen(false);
    setIsBulkDeleteOpen(false);
    setIsBulkEditOpen(false);
    setIsPayCreditOpen(false);
    setImageToView(null);
    setReceiptData(null);
  };

  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CreditCard className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">POS Customers</h1>
              <p className="text-muted-foreground">
                {isBranchMode ? `Branch: ${currentBranch?.name}` : "Manage walk-in customers for your Point of Sale system."}
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>New POS Customer</Button>
        </div>

        <CustomerList
          onDeleteCustomer={handleDelete}
          onEditCustomer={handleEdit}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
          onPayCredit={handlePayCredit}
          onViewImage={handleViewImage}
          reloadCounter={reloadCounter}
          collectionName="posCustomers"
          pageName="pos-customers"
          globalData={isGlobalMode ? globalCustomers : undefined}
        />
      </div>

      <AddCustomerForm
        open={isAddOpen}
        onOpenChange={handleCloseDialogs}
        onSuccess={() => handleDataMutation()}
        collectionName="posCustomers"
      />

      {selectedCustomer && (
        <>
          <EditCustomerForm
            open={isEditOpen}
            onOpenChange={handleCloseDialogs}
            customer={selectedCustomer}
            onSuccess={() => handleDataMutation()}
            collectionName="posCustomers"
          />
          <DeleteCustomerDialog
            open={isDeleteOpen}
            onOpenChange={handleCloseDialogs}
            customer={selectedCustomer}
            onSuccess={() => handleDataMutation()}
            collectionName="posCustomers"
          />
        </>
      )}
      {customerToPay && (
        <PayCreditDialog
          isOpen={isPayCreditOpen}
          onClose={handleCloseDialogs}
          customer={customerToPay}
          outstandingBalance={customerToPay.outstandingBalance || 0}
          onSuccess={(data) => handleDataMutation(data)}
        />
      )}
       {receiptData && (
        <CreditPaymentReceiptDialog
          isOpen={!!receiptData}
          onClose={handleCloseDialogs}
          payment={receiptData.payment}
          customer={receiptData.customer}
          remainingBalance={receiptData.balance}
        />
      )}
      {selectedCustomers.length > 0 && (
        <>
          <BulkDeleteCustomerDialog
            open={isBulkDeleteOpen}
            onOpenChange={handleCloseDialogs}
            customers={selectedCustomers}
            onSuccess={() => handleDataMutation()}
            collectionName="posCustomers"
          />
          <BulkEditCustomerDialog
            open={isBulkEditOpen}
            onOpenChange={handleCloseDialogs}
            customers={selectedCustomers}
            onSuccess={() => handleDataMutation()}
            collectionName="posCustomers"
          />
        </>
      )}
      <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customer Photo</DialogTitle>
          </DialogHeader>
          {imageToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageToView}
                alt="Customer Photo"
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default withAuth(PosCustomersPage, PagePermission.MANAGE_POS_CUSTOMERS);
