
'use client';

import * as React from 'react';
import { ShoppingCart, History, RefreshCw } from 'lucide-react';
import { TopHeader } from '@/components/ui/top-header';
import { Button } from '@/components/ui/button';
import { HotelPos } from '@/components/pos/hotel-pos';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import Link from 'next/link';
import { RecentTransactionsDialog } from '@/components/pos/RecentTransactionsDialog';
import { useBranch } from '@/contexts/branch-context';

function PointOfSalePage() {
  const [reloadHistory, setReloadHistory] = React.useState(0);
  const [reloadProducts, setReloadProducts] = React.useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const { currentBranch } = useBranch();

  const handleSaleComplete = () => {
    setReloadHistory(prev => prev + 1);
  };

  const headerName = currentBranch ? `${currentBranch.name} - Point of Sale` : 'Point of Sale';

  return (
    <>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <TopHeader name={headerName} icon={<ShoppingCart />} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setReloadProducts(c => c + 1)} title="Refresh Products">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsHistoryOpen(true)} title="Recent Transactions">
              <History className="h-4 w-4" />
            </Button>
             <Button variant="outline" size="icon" asChild title="My Sales History">
              <Link href="/my-sales-history">
                <History className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        <HotelPos onSaleAction={handleSaleComplete} reloadProducts={reloadProducts} />
      </div>
      <RecentTransactionsDialog
        isOpen={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />
    </>
  );
};

export default withAuth(PointOfSalePage, PagePermission.VIEW_POS);
