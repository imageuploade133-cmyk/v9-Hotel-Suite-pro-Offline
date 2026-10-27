
'use client';

import React from 'react';
import { Users } from 'lucide-react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { CustomerList } from '@/components/customers/customer-list';
import type { Customer } from '@/lib/types';
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

function CustomersPage() {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = React.useState(false);
  const [imageToView, setImageToView] = React.useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);
  const [selectedCustomers, setSelectedCustomers] = React.useState<Customer[]>(
    []
  );

  const handleDataMutation = () => {
    setReloadCounter(prev => prev + 1);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditOpen(true);
  };

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
    setIsAddOpen(false);
    setIsEditOpen(false);
    setIsDeleteOpen(false);
    setIsBulkDeleteOpen(false);
    setIsBulkEditOpen(false);
    setImageToView(null);
  };

  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Hotel Customers</h1>
              <p className="text-muted-foreground">
                View and manage customer profiles, including total spent, paid, and
                balance due.
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>New Customer</Button>
        </div>

        <CustomerList
          onDeleteCustomer={handleDelete}
          onEditCustomer={handleEdit}
          onBulkDelete={handleBulkDelete}
          onBulkEdit={handleBulkEdit}
          onViewImage={handleViewImage}
          reloadCounter={reloadCounter}
          collectionName="customers"
          pageName="customers"
        />
      </div>

      <AddCustomerForm
        open={isAddOpen}
        onOpenChange={handleCloseDialogs}
        onSuccess={handleDataMutation}
        collectionName="customers"
      />

      {selectedCustomer && (
        <>
          <EditCustomerForm
            open={isEditOpen}
            onOpenChange={handleCloseDialogs}
            customer={selectedCustomer}
            onSuccess={handleDataMutation}
            collectionName="customers"
          />
          <DeleteCustomerDialog
            open={isDeleteOpen}
            onOpenChange={handleCloseDialogs}
            customer={selectedCustomer}
            onSuccess={handleDataMutation}
            collectionName="customers"
          />
        </>
      )}
      {selectedCustomers.length > 0 && (
        <>
          <BulkDeleteCustomerDialog
            open={isBulkDeleteOpen}
            onOpenChange={handleCloseDialogs}
            customers={selectedCustomers}
            onSuccess={handleDataMutation}
            collectionName="customers"
          />
          <BulkEditCustomerDialog
            open={isBulkEditOpen}
            onOpenChange={handleCloseDialogs}
            customers={selectedCustomers}
            onSuccess={handleDataMutation}
            collectionName="customers"
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

export default withAuth(CustomersPage, PagePermission.VIEW_CUSTOMERS_PAGE);
