'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '../ui/separator';
import type { StockSale, UserProfile } from '@/lib/types';
import { format } from 'date-fns';
import { Printer, X, AlertCircle } from 'lucide-react';
import { Logo } from '../logo';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { getSafeDate, getInitials } from '@/lib/helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { User } from 'lucide-react';
import { Badge } from '../ui/badge';
import { printById } from '@/lib/print-receipt';
import { useSecurePrint } from '@/lib/secure-print';
import { useUser } from '@/contexts/user-context';

interface StockSaleReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: StockSale | null;
  customerBalance?: number;
  /** Pre-loaded users data - REQUIRED for instant printing */
  allUsers?: UserProfile[];
  /** If true, dialog won't fetch any data internally */
  dataReady?: boolean;
}

const PaymentDetailsCreditSale = ({ saleId, isTerminal = false }: { saleId: string; isTerminal?: boolean }) => {
  const { settings, getEffectivePosSettings } = useSettings();
  const { currentBranch, isGlobalMode } = useBranch();

  // Get effective POS settings for bank details
  const effectivePosSettings = getEffectivePosSettings();

  // Use effective POS settings bank details if available, otherwise fallback to global settings
  const bankName = effectivePosSettings.bankName || settings?.bankName;
  const accountName = effectivePosSettings.accountName || settings?.accountName;
  const accountNumber = effectivePosSettings.accountNumber || settings?.accountNumber;
  const bankLogoUrl = effectivePosSettings.bankLogoUrl || settings?.bankLogoUrl;

  if (!bankName && !accountName && !accountNumber) {
    return null;
  }

  if (isTerminal) {
    return (
      <div className="text-center text-xs mt-4 border-t border-dashed border-black pt-2">
        <p className="font-bold uppercase">Payment Details for Credit</p>
        <p>Bank: {bankName}</p>
        <p>Acct Name: {accountName}</p>
        <p>Acct No: {accountNumber}</p>
        <p className="font-bold mt-1">Ref: {saleId}</p>
      </div>
    );
  }

  return (
    <>
      <Separator className="my-6" />
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h3 className="font-bold text-slate-800 mb-2">Payment Details for Credit Sale</h3>
        <p className="text-slate-600 text-xs mb-4">
          Please use the Sale ID <span className="font-bold">{saleId}</span> as a payment reference/memo for your bank transfer.
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p><strong>Bank:</strong></p>
            <p>{bankName || 'N/A'}</p>
          </div>
          <div>
            <p><strong>Account Name:</strong></p>
            <p>{accountName || 'N/A'}</p>
          </div>
          <div className="col-span-2">
            <p><strong>Account Number:</strong></p>
            <p className="text-lg font-mono tracking-widest">{accountNumber || 'N/A'}</p>
          </div>
        </div>
        {bankLogoUrl && (
          <div className="mt-4">
            <img src={bankLogoUrl} alt="Bank Logo" style={{ height: '40px', width: 'auto' }} className="object-contain" />
          </div>
        )}
      </div>
    </>
  );
};

export function StockSaleReceiptDialog({
  isOpen,
  onClose,
  sale,
  customerBalance,
  allUsers,
  dataReady = true
}: StockSaleReceiptDialogProps) {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState('invoice');
  const [printCopies, setPrintCopies] = React.useState(1);
  const { settings, getEffectivePosSettings } = useSettings();
  const { userProfile } = useUser();
  const { currentBranch, getCollectionPath, isGlobalMode } = useBranch();

  // Get effective POS settings based on current context (Global vs Branch)
  const effectivePosSettings = getEffectivePosSettings();

  // Secure print integration
  // Use getCollectionPath to get the correct collection path based on branch/POS mode
  const {
    isAlreadyPrinted,
    isProcessing,
    handlePrint: handleSecurePrint,
    isValid
  } = useSecurePrint({
    collection: getCollectionPath('stockSales'),
    documentId: sale?.id || '',
    allowReprintAfterDelay: true,
  });

  // Use pre-loaded users data - no internal fetching
  const usersData = allUsers;
  const isDataReady = dataReady && !!sale;

  // Create user map from pre-loaded data
  const userMap = React.useMemo(() => {
    if (!usersData) return new Map<string, UserProfile>();
    return new Map(usersData.map(u => [u.uid, u]));
  }, [usersData]);

  const discountAmount = React.useMemo(() => {
    if (!sale?.discountValue) return 0;
    const subtotal = sale.items.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0);
    if (sale.discountType === 'percentage') {
      return (subtotal * sale.discountValue) / 100;
    }
    return sale.discountValue;
  }, [sale]);

  const subtotal = sale ? sale.items.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0) : 0;

  const handlePrint = React.useCallback(async () => {
    const printContent = activeTab === 'invoice' ? invoiceRef.current : terminalRef.current;
    if (!printContent || !isDataReady || !userProfile || !sale) return;

    const copies = Math.max(1, printCopies);

    const useIframe = !!effectivePosSettings.posAllowPopups;

    // Use secure print to prevent duplicate printing
    await handleSecurePrint(
      userProfile.uid,
      userProfile.name,
      () => {
        // Use the ID-based printing for reliability
        // Ensure the element has an ID before printing
        if (printContent.id) {
          printById(printContent.id, {
            title: `Sale Receipt #${sale.saleId}`,
            copies,
            useIframe
          });
        } else {
          // Fallback: add temporary ID and print
          const tempId = `print-${Date.now()}`;
          printContent.id = tempId;
          printById(tempId, {
            title: `Sale Receipt #${sale.saleId}`,
            copies,
            useIframe
          });
          // Clean up temporary ID after print
          setTimeout(() => {
            printContent.id = '';
          }, 100);
        }
      }
    );
  }, [activeTab, isDataReady, printCopies, sale, userProfile, handleSecurePrint]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('invoice');
      setPrintCopies(1);
    }
  }, [isOpen]);

  if (!sale) return null;

  const currency = settings?.currency || 'USD';

  // Use effective POS settings with proper separation between Global and Branch contexts
  // In Global mode: use settings from global settings collection
  // In Branch mode: use branch-specific POS settings (effectivePosSettings)
  const posLogoUrl = effectivePosSettings.posUseBusinessLogo !== false
    ? (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '')
    : (effectivePosSettings.posReceiptLogoUrl || settings?.businessLogoUrl || '');
  const posLogoSize = effectivePosSettings.posReceiptLogoSize || settings?.businessLogoSize || 48;
  const posShowBusinessName = effectivePosSettings.posShowBusinessName !== false;
  const posShowAddress = effectivePosSettings.posShowAddress !== false;
  const posShowPhone = effectivePosSettings.posShowPhone !== false;
  const posShowCashier = effectivePosSettings.posShowCashierName !== false;
  const posShowDate = effectivePosSettings.posShowDate !== false;
  const posHeader = effectivePosSettings.posReceiptHeader || 'SALE RECEIPT';
  const posFooter = effectivePosSettings.posReceiptFooter || 'Thank you for your patronage!';

  // Business name and address - use effective POS settings business name (separate for each context)
  const effectiveBusinessName = effectivePosSettings.businessName;
  const displayName = effectiveBusinessName || (isGlobalMode ? (settings?.businessName || 'Hotel Suite Pro') : (currentBranch?.name || settings?.businessName || 'Hotel Suite Pro'));
  const displayAddress = effectivePosSettings.businessAddress !== undefined
    ? effectivePosSettings.businessAddress
    : (isGlobalMode ? settings?.businessAddress : (currentBranch?.address || settings?.businessAddress));
  const displayPhone = effectivePosSettings.businessPhone !== undefined
    ? effectivePosSettings.businessPhone
    : (isGlobalMode ? settings?.businessPhone : (currentBranch?.phoneNumber || settings?.businessPhone));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const soldAtDate = getSafeDate(sale.soldAt);
  const staffProfile = sale.soldByUid ? userMap.get(sale.soldByUid) : null;

  // Generate unique IDs for print elements
  const invoiceId = `receipt-invoice-${sale.id || sale.saleId}`;
  const terminalId = `receipt-terminal-${sale.id || sale.saleId}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sale Receipt #{sale.saleId}</DialogTitle>
          <DialogDescription>
            A receipt for the sale transaction. You can print either a professional invoice or a terminal-style receipt.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoice">Professional Invoice</TabsTrigger>
            <TabsTrigger value="terminal">Terminal Receipt</TabsTrigger>
          </TabsList>
          <div className="max-h-[60vh] overflow-y-auto mt-4 p-1 rounded-lg border">
            <TabsContent value="invoice">
              <div id={invoiceId} ref={invoiceRef} className="print-content p-8 bg-white text-black text-sm">
                <header className="flex justify-between items-start mb-8">
                  <div>
                    {posLogoUrl ? (
                      <img src={posLogoUrl} alt={displayName || 'logo'} style={{ height: `${posLogoSize}px` }} />
                    ) : (
                      <Logo className="h-10 w-10 text-slate-800" />
                    )}
                  </div>
                  <div className="text-right">
                    {posShowBusinessName && <h1 className="font-bold text-xl text-slate-800">{displayName}</h1>}
                    {posShowAddress && displayAddress && (
                      <p className="text-slate-500 text-xs">
                        {displayAddress}
                      </p>
                    )}
                    {posShowPhone && displayPhone && <p className="text-slate-500 text-xs">{displayPhone}</p>}
                  </div>
                </header>
                <Separator className="my-4" />
                <div className="flex justify-between items-center mb-8">
                  <div className="text-left">
                    <h2 className="font-bold text-2xl uppercase text-slate-800">
                      {sale.paymentMethod === 'Credit' ? 'Credit Sale Invoice' : 'Paid Invoice'}
                    </h2>
                    <Badge variant={sale.paymentMethod === 'Credit' ? 'destructive' : 'success'} className="mt-1">
                      {sale.paymentMethod === 'Credit' ? 'CREDIT' : 'PAID IN FULL'}
                    </Badge>
                    <p className="text-slate-500 mt-2">Sale ID: {sale.saleId}</p>
                    <p className="text-slate-500">Date: {soldAtDate ? format(soldAtDate, 'PPpp') : 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-semibold text-slate-600 mb-1">Customer:</h3>
                    <p className="font-bold text-slate-800">{sale.customerName || 'Walk-in Customer'}</p>
                    <p className="text-slate-600">{sale.customerEmail}</p>
                  </div>
                </div>

                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item, index) => (
                      <tr key={`${item.itemId}-${index}`} className="border-b border-slate-100">
                        <td className="p-3">{item.itemName}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sellingPrice)}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sellingPrice * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end mt-8">
                  <div className="w-full max-w-sm space-y-3 text-slate-700">
                    {discountAmount > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>Discount ({sale.discountType === 'percentage' ? `${sale.discountValue}%` : 'Fixed'}):</span>
                          <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold text-lg text-slate-800 border-t-2 border-dashed border-slate-300 pt-3">
                      <span>Grand Total</span>
                      <span>{formatCurrency(sale.totalAmount)}</span>
                    </div>
                    {sale.paymentStatus === 'Paid' && (
                      <div className="flex justify-between font-bold text-lg text-green-600 border-t-2 border-dashed border-green-300 pt-3">
                        <span>Amount Paid ({sale.paymentMethod})</span>
                        <span>{formatCurrency(sale.totalAmount)}</span>
                      </div>
                    )}
                    {sale.paymentMethod === 'Credit' && (
                      <>
                        {sale.initialPaymentAmount != null && sale.initialPaymentAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Initial Payment:</span>
                            <span>{formatCurrency(sale.initialPaymentAmount)}</span>
                          </div>
                        )}
                        {customerBalance != null && customerBalance > 0 && (
                          <div className="flex justify-between font-bold text-lg text-destructive border-t-2 border-dashed border-red-300 pt-3">
                            <span>Total Balance Due:</span>
                            <span>{formatCurrency(customerBalance)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {sale.paymentMethod === 'Credit' && <PaymentDetailsCreditSale saleId={sale.saleId} />}

                <div className="mt-8 text-sm">
                  <div className="flex items-center gap-3">
                    <p><b>Processed by:</b></p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={staffProfile?.photoURL || undefined} alt={sale.soldByName} />
                        <AvatarFallback className="text-xs">
                          {staffProfile ? getInitials(staffProfile.name) : <User />}
                        </AvatarFallback>
                      </Avatar>
                      <span>{sale.soldByName}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-12 text-center text-xs text-slate-500 whitespace-pre-line">
                  <p>{posFooter}</p>
                  <p>This is a computer-generated document.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="terminal">
              <div id={terminalId} ref={terminalRef} className="p-4 bg-white text-black receipt max-w-sm mx-auto text-sm">
                <div className="text-center space-y-1 mb-4">
                  {posLogoUrl && (
                    <img src={posLogoUrl} alt={displayName || 'logo'} style={{ height: `${posLogoSize}px` }} className="mx-auto" />
                  )}
                  {posShowBusinessName && <h1 className="font-bold text-lg">{displayName}</h1>}
                  {posShowAddress && displayAddress && <p className="text-xs">{displayAddress}</p>}
                  {posShowPhone && displayPhone && <p className="text-xs">{displayPhone}</p>}
                </div>
                <div className="text-center text-xs mb-4">
                  {posShowDate && <p>Date: {soldAtDate ? format(soldAtDate, 'MM/dd/yyyy HH:mm:ss') : 'N/A'}</p>}
                  <p>Receipt ID: {sale.saleId}</p>
                  {posShowCashier && <p>Cashier: {sale.soldByName}</p>}
                </div>
                <p className="font-bold uppercase text-center mb-2">
                  {sale.paymentMethod === 'Credit' ? 'Credit Sale Invoice' : posHeader}
                </p>
                <div className="space-y-1 border-y border-dashed border-black py-2">
                  {sale.items.map((item, index) => (
                    <div key={`${item.itemId}-${index}`}>
                      <div className="flex justify-between">
                        <span>{item.itemName}</span>
                        <span>{formatCurrency(item.sellingPrice * item.quantity)}</span>
                      </div>
                      <div className="text-xs ml-2">{item.quantity} @ {formatCurrency(item.sellingPrice)}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 my-2">
                  {discountAmount > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-red-500">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(sale.totalAmount)}</span>
                  </div>
                </div>
                <div className="my-4 space-y-1 text-center border-t border-dashed border-black pt-2">
                  {sale.paymentMethod === 'Credit' ? (
                    <p className="font-bold text-lg text-red-600">CREDIT SALE</p>
                  ) : (
                    <p className="font-bold text-lg text-green-600">PAID IN FULL</p>
                  )}
                  <p className="font-semibold uppercase">{sale.paymentMethod}</p>
                  <p className="font-bold text-lg">
                    Amount Paid:{' '}
                    {formatCurrency(sale.paymentMethod === 'Credit' ? (sale.initialPaymentAmount || 0) : sale.totalAmount)}
                  </p>
                </div>
                {sale.paymentMethod === 'Credit' && (
                  <>
                    <div className="text-center font-bold text-red-500">
                      BALANCE DUE: {formatCurrency(sale.totalAmount - (sale.initialPaymentAmount || 0))}
                    </div>
                    {customerBalance != null && customerBalance > 0 && (
                      <div className="text-center font-bold text-red-700 border-t border-dashed mt-2 pt-2">
                        TOTAL OUTSTANDING BALANCE: {formatCurrency(customerBalance)}
                      </div>
                    )}
                    <PaymentDetailsCreditSale saleId={sale.saleId} isTerminal />
                  </>
                )}
                <div className="text-center text-xs mt-6 whitespace-pre-line">
                  <p>{posFooter}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sm:justify-between flex-row pt-4">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          <div className="flex items-center gap-2">
            {isValid && (
              <div className="relative w-24">
                <Label htmlFor="print-copies" className="absolute -top-5 text-xs">Copies</Label>
                <Input
                  id="print-copies"
                  type="number"
                  min="1"
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                  className="h-9"
                  disabled={isProcessing}
                />
              </div>
            )}
            <Button onClick={handlePrint} disabled={!isDataReady || printCopies < 1 || isProcessing || !isValid}>
              {isProcessing ? (
                <>
                  <Printer className="mr-2 h-4 w-4 animate-spin" /> Printing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" /> Print Receipt
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
