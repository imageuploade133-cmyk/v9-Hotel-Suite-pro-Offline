
'use client';

import * as React from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { StockSale, StockReturn, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { History, Search, Download, Loader2, Printer, Image as ImageIcon, Undo2, User, Eye, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { getRefundsColumns } from '@/components/stock/refund-columns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { exportToCsv } from '@/lib/csv-export';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import * as htmlToImage from 'html-to-image';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { StatCard } from '@/components/ui/stat-card';
import { getSafeDate } from '@/lib/helpers';
import { StockSaleReceiptDialog } from '@/components/stock/stock-sale-receipt-dialog';
import { ViewRefundDetailsDialog } from '@/components/stock/view-refund-details-dialog';
import RefundSalesLoading from './loading';
import { RefundReceiptDialog } from '@/components/stock/refund-receipt-dialog';
// import { StockAuditReport } from '@/components/stock/stock-audit-report';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { TopHeader } from '@/components/top-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function RefundSalesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { userProfile } = useUser();
  const { settings } = useSettings();
  const { getCollectionPath } = useBranch();

  const [allLogsForExport, setAllLogsForExport] = React.useState<StockReturn[]>([]);
  const [isExporting, setIsExporting] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [reloadCounter, setReloadCounter] = React.useState(0);

  const [originalSaleToPrint, setOriginalSaleToPrint] = React.useState<StockSale | null>(null);
  const [refundToView, setRefundToView] = React.useState<StockReturn | null>(null);
  const [refundToPrint, setRefundToPrint] = React.useState<StockReturn | null>(null);
  const [actionsRefund, setActionsRefund] = React.useState<StockReturn | null>(null);


  const { data: staffMembers, isLoading: areStaffLoading } = useCollection<UserProfile>(useMemo(() => firestore ? query(collection(firestore, 'users'), orderBy('name')) : null, [firestore]));
  const { data: sales, isLoading: areSalesLoading } = useCollection<StockSale>(useMemo(() => firestore ? query(collection(firestore, getCollectionPath('stockSales'))) : null, [firestore, reloadCounter, getCollectionPath]));

  const returnsQuery = useMemo(() => {
    if (!firestore) return null;
    let q: QueryConstraint[] = [orderBy('returnedAt', 'desc')];
    if (dateRange?.from) q.push(where('returnedAt', '>=', Timestamp.fromDate(dateRange.from)));
    if (dateRange?.to) q.push(where('returnedAt', '<=', Timestamp.fromDate(dateRange.to)));
    if (selectedStaffId !== 'all') q.push(where('returnedByUid', '==', selectedStaffId));

    return query(collection(firestore, getCollectionPath('stockReturns')), ...q);
  }, [firestore, reloadCounter, dateRange, selectedStaffId, getCollectionPath]);

  const { data: returns, isLoading: areReturnsLoading } = useCollection<StockReturn>(returnsQuery);

  const transactions = React.useMemo(() => {
    if (!returns) return [];
    if (!searchTerm) return returns;

    const lowercasedTerm = searchTerm.toLowerCase();
    return returns.filter(refund =>
      refund.refundId?.toLowerCase().includes(lowercasedTerm) ||
      (refund.customerName || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [returns, searchTerm]);


  const currency = settings?.currency || 'USD';
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  const summaryStats = React.useMemo(() => {
    const dataToSummarize = transactions || [];
    const totalRefunds = dataToSummarize.reduce((sum, t) => sum + t.totalRefundAmount, 0);
    const count = dataToSummarize.length;
    return { totalRefunds, count };
  }, [transactions]);

  const handleViewOriginalSale = (saleId: string) => {
    const originalSale = sales?.find(s => s.id === saleId);
    if (originalSale) {
        setOriginalSaleToPrint(originalSale);
    } else {
        toast({ variant: 'destructive', title: 'Sale Not Found', description: 'Could not find the original sale for this refund.' });
    }
  };

  const columns = React.useMemo(() => getRefundsColumns({
    currency,
    onViewDetails: setRefundToView,
    onViewOriginalSale: handleViewOriginalSale,
    onReprint: setRefundToPrint,
    onActions: setActionsRefund,
  }), [currency, sales]);

 const fetchAllLogsForExport = async (): Promise<StockReturn[]> => {
    return transactions; // Use already filtered data
  }

 const handleExport = async (type: 'csv' | 'print' | 'image') => {
    setIsExporting(true);
    toast({ title: 'Preparing Report', description: 'Fetching all matching records, please wait...' });

    try {
        const allData = await fetchAllLogsForExport();
        setAllLogsForExport(allData);

        if (allData.length === 0) {
            toast({ variant: 'destructive', title: 'No Data', description: 'No records to export with the current filters.' });
            setIsExporting(false);
            return;
        }

        if (type === 'csv') {
            const dataToExport = allData.map(t => ({
                'Refund ID': t.refundId,
                'Original Sale ID': t.originalSaleId,
                'Customer': t.customerName,
                'Date': format(getSafeDate(t.returnedAt)!, 'PPpp'),
                'Items': t.items.map(i => `${i.itemName} (x${i.quantity})`).join(', '),
                'Refund Amount': t.totalRefundAmount,
                'Reason': t.reason || 'N/A',
                'Processed By': t.returnedByName,
            }));
            exportToCsv(dataToExport, `refunds-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
        } else if (type === 'print') {
            // Wait for React to render, then for browser to paint
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                window.print();
              });
            });
        } else if (type === 'image') {
            setTimeout(async () => {
              if (printRef.current) {
                try {
                  const dataUrl = await htmlToImage.toPng(printRef.current, { quality: 1.0, pixelRatio: 2 });
                  const link = document.createElement('a');
                  link.download = `refunds-report_${new Date().toISOString().split('T')[0]}.png`;
                  link.href = dataUrl;
                  link.click();
                  toast({ variant: 'success', title: 'Image Downloaded' });
                } catch (err) {
                  toast({ variant: 'destructive', title: 'Image Generation Failed' });
                }
              }
            }, 500);
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not fetch all data for the report.' });
    } finally {
        setIsExporting(false);
    }
  };

  const isComponentLoading = areSalesLoading || areStaffLoading || areReturnsLoading;


  if (isComponentLoading) {
    return <RefundSalesLoading />;
  }

  return (
    <>
       {/* <div className="hidden print:block">
        <div ref={printRef}>
          <StockAuditReport
            data={allLogsForExport}
            settings={settings}
            userProfile={userProfile}
            dateRange={dateRange}
            filters={{
              staff: staffMembers?.find(s => s.uid === selectedStaffId)?.name || 'All',
              changeType: 'Refund',
            }}
          />
        </div>
      </div> */}
       <style>{`@media print { @page { margin: 0mm !important; } body * { visibility: hidden; } #stock-audit-report-print, #stock-audit-report-print * { visibility: visible; } #stock-audit-report-print { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      <div className="flex flex-col gap-6 no-print">
        <div className="flex items-start flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TopHeader name="Refunds" icon={<Undo2 className="h-10 w-10" />} description="Review all processed refunds and return transactions." />
           <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => handleExport('print')} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Print
                </Button>
                <Button variant="outline" onClick={() => handleExport('image')} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                    Download
                </Button>
                <Button onClick={() => handleExport('csv')} disabled={areReturnsLoading || isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export to CSV
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard title="Total Refunds Value" value={formatCurrency(summaryStats.totalRefunds)} icon={Undo2} description={`From ${summaryStats.count} transactions in the filtered period.`} className="border-destructive text-destructive" />
          <StatCard title="Total Refund Transactions" value={summaryStats.count} icon={History} description="Total number of refund records matching filters." />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Refund Transactions</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by ID or Customer..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 pl-10"
                        />
                    </div>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                    <Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={areStaffLoading}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <SelectValue placeholder="Filter by staff..." />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            {staffMembers?.map(staff => (
                            <SelectItem key={staff.id} value={staff.uid}>{staff.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={transactions}
              tableId="refunds-history"
              isPaginated={true}
              filterColumn="customerName"
              filterPlaceholder="Search by customer name..."
            />
          </CardContent>
        </Card>
      </div>

        <Dialog open={!!actionsRefund} onOpenChange={() => setActionsRefund(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Actions for Refund #{actionsRefund?.refundId}</DialogTitle>
                    <DialogDescription>
                        Customer: {actionsRefund?.customerName}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                            setRefundToView(actionsRefund);
                            setActionsRefund(null);
                        }}
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                    </Button>
                    <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                            setRefundToPrint(actionsRefund);
                            setActionsRefund(null);
                        }}
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Reprint Receipt
                    </Button>
                    <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                            handleViewOriginalSale(actionsRefund!.originalSaleId);
                            setActionsRefund(null);
                        }}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        View Original Sale
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setActionsRefund(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


       <ViewRefundDetailsDialog
        isOpen={!!refundToView}
        onClose={() => setRefundToView(null)}
        refund={refundToView}
        currency={currency}
        onViewOriginalSale={handleViewOriginalSale}
      />

      <StockSaleReceiptDialog
        isOpen={!!originalSaleToPrint}
        onClose={() => setOriginalSaleToPrint(null)}
        sale={originalSaleToPrint}
      />

       <RefundReceiptDialog
        isOpen={!!refundToPrint}
        onClose={() => setRefundToPrint(null)}
        refund={refundToPrint}
        sale={sales?.find(s => s.id === refundToPrint?.originalSaleId) || null}
      />

    </>
  );
}

export default withAuth(RefundSalesPage, PagePermission.PROCESS_SALE_REFUNDS);
