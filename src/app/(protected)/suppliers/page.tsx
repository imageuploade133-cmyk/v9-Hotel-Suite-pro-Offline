'use client';

import * as React from 'react';
import { Truck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StockSupplier } from '@/lib/types';
import { SupplierList } from '@/components/suppliers/supplier-list';
import { AddEditSupplierDialog } from '@/components/suppliers/add-edit-supplier-dialog';
import { DeleteSupplierDialog } from '@/components/suppliers/delete-supplier-dialog';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import { useBranch } from '@/contexts/branch-context';

function SuppliersPage() {
  const { isBranchMode, currentBranch } = useBranch();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<StockSupplier | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const handleSuccess = () => {
    setReloadCounter(prev => prev + 1);
  };

  const handleEdit = (supplier: StockSupplier) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = (supplier: StockSupplier) => {
    setSelectedSupplier(supplier);
    setIsDeleteOpen(true);
  };

  const handleCloseDialogs = () => {
    setSelectedSupplier(null);
    setIsFormOpen(false);
    setIsDeleteOpen(false);
  };

  return (
    <>
      <div className="h-full flex-col gap-6 flex">
        <div className="flex items-center justify-between">
          <TopHeader
            name="Suppliers"
            icon={<Truck className="h-10 w-10" />}
            description={isBranchMode ? `Branch: ${currentBranch?.name}` : "Manage your inventory suppliers and their contact information."}
          />
          <Button onClick={() => { setSelectedSupplier(null); setIsFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Supplier
          </Button>
        </div>

        <SupplierList
          onEdit={handleEdit}
          onDelete={handleDelete}
          reloadCounter={reloadCounter}
        />
      </div>

      <AddEditSupplierDialog
        isOpen={isFormOpen}
        onClose={handleCloseDialogs}
        supplier={selectedSupplier}
        onSuccess={handleSuccess}
      />

      {selectedSupplier && (
        <DeleteSupplierDialog
            isOpen={isDeleteOpen}
            onClose={handleCloseDialogs}
            supplier={selectedSupplier}
            onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

export default withAuth(SuppliersPage, PagePermission.MANAGE_SUPPLIERS);
