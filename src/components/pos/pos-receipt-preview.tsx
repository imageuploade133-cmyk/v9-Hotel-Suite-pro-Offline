'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { useBranch } from '@/contexts/branch-context';
import { useSettings } from '@/contexts/settings-context';

interface POSReceiptPreviewProps {
  posReceiptLogoUrl?: string;
  posReceiptLogoSize?: number;
  posReceiptHeader?: string;
  posReceiptFooter?: string;
  posShowBusinessName?: boolean;
  posShowAddress?: boolean;
  posShowPhone?: boolean;
  posShowEmail?: boolean;
  posShowDate?: boolean;
  posShowCashierName?: boolean;
  posShowPaymentMethod?: boolean;
  posShowBarcode?: boolean;
  posTaxLabel?: string;
  posTaxRate?: number;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  currency?: string;
}

export function POSReceiptPreview({
  posReceiptLogoUrl,
  posReceiptLogoSize = 64,
  posReceiptHeader = 'SALE RECEIPT',
  posReceiptFooter = 'Thank you for your purchase!',
  posShowBusinessName = true,
  posShowAddress = true,
  posShowPhone = true,
  posShowEmail = false,
  posShowDate = true,
  posShowCashierName = true,
  posShowPaymentMethod = true,
  posShowBarcode = false,
  posTaxLabel = 'Tax',
  posTaxRate = 0,
  businessName = 'Hotel Suite Pro',
  businessAddress = '123 Luxury Lane, Suite 100, Metropolis, ST 12345',
  businessPhone = '+1 (800) 555-0199',
  businessEmail = 'contact@hotelsuitepro.com',
  currency = 'USD',
}: POSReceiptPreviewProps) {
  const [activeTab, setActiveTab] = React.useState('terminal');
  const { currentBranch, isGlobalMode } = useBranch();
  const today = new Date();

  // Use branch-specific information if available, otherwise fall back to global settings
  // In global mode, always use the POS Receipt Settings business name, not "Global Branch"
  const displayLogoUrl = currentBranch?.logoUrl || posReceiptLogoUrl;
  const displayName = isGlobalMode ? businessName : (currentBranch?.name || businessName);
  const displayAddress = currentBranch?.address || businessAddress;
  const displayPhone = currentBranch?.phoneNumber || businessPhone;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const subtotal = 125.00;
  const tax = posTaxRate > 0 ? subtotal * (posTaxRate / 100) : 0;
  const total = subtotal + tax;

  const sampleItems = [
    { name: 'Coca Cola (500ml)', qty: 2, price: 3.50 },
    { name: 'Chicken Sandwich', qty: 1, price: 12.00 },
    { name: 'Room Service Fee', qty: 1, price: 5.00 },
    { name: 'Premium Wi-Fi (24hrs)', qty: 1, price: 9.99 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt Preview</CardTitle>
        <CardDescription>
          Live preview of how your POS receipts will appear when printed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="terminal">Terminal Receipt (58/80mm)</TabsTrigger>
            <TabsTrigger value="a4">A4 Invoice Style</TabsTrigger>
          </TabsList>
          <div className="mt-2 h-[600px] overflow-y-auto rounded-lg border bg-white shadow-inner">
            <TabsContent value="terminal">
              <div className="p-4 bg-white text-black receipt max-w-sm mx-auto text-xs font-mono">
                {/* Logo Section */}
                <div className="text-center space-y-2 mb-4">
                  {displayLogoUrl ? (
                    <Image
                      src={displayLogoUrl}
                      alt="Logo"
                      width={posReceiptLogoSize}
                      height={posReceiptLogoSize}
                      className="object-contain mx-auto"
                    />
                  ) : (
                    <Logo className="h-10 w-10 mx-auto text-slate-800" />
                  )}
                  {posShowBusinessName && (
                    <h1 className="font-bold text-base">{displayName}</h1>
                  )}
                </div>

                {/* Business Info */}
                <div className="text-center text-[10px] mb-4 space-y-0.5">
                  {posShowAddress && <p>{displayAddress}</p>}
                  {posShowPhone && <p>Tel: {displayPhone}</p>}
                  {posShowEmail && <p>{businessEmail}</p>}
                </div>

                {/* Date & Receipt Info */}
                {posShowDate && (
                  <div className="text-center text-[10px] mb-4">
                    <p>{format(today, 'MM/dd/yyyy HH:mm:ss')}</p>
                    <p>Receipt #: POS-00123</p>
                  </div>
                )}

                {/* Header */}
                {posReceiptHeader && (
                  <p className="font-bold uppercase text-center mb-2 text-sm border-t border-b border-dashed border-black py-1">
                    {posReceiptHeader}
                  </p>
                )}

                {/* Items */}
                <div className="space-y-1 border-b border-dashed border-black py-2">
                  {sampleItems.map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between">
                        <span>{item.name}</span>
                        <span>{formatCurrency(item.price * item.qty)}</span>
                      </div>
                      <div className="text-[10px] ml-2 text-slate-600">
                        {item.qty} x {formatCurrency(item.price)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-1 my-2 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {posTaxRate > 0 && (
                    <div className="flex justify-between">
                      <span>{posTaxLabel} ({posTaxRate}%):</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between font-bold text-sm border-t border-dashed border-black pt-2">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                {/* Payment Info */}
                {posShowPaymentMethod && (
                  <div className="my-4 space-y-1 text-center">
                    <p className="font-bold uppercase text-xs">Cash Payment</p>
                    <p className="font-bold text-sm">Amount Paid: {formatCurrency(150)}</p>
                    <p className="text-xs">Change: {formatCurrency(25)}</p>
                  </div>
                )}

                {/* Cashier */}
                {posShowCashierName && (
                  <div className="text-center text-[10px] mb-4">
                    <p>Served by: John Smith</p>
                  </div>
                )}

                {/* Barcode */}
                {posShowBarcode && (
                  <div className="text-center my-4">
                    <div className="inline-block border border-black px-4 py-2">
                      <div className="text-[8px] tracking-[0.3em] font-bold">
                        ||||| |||| ||||| ||||
                      </div>
                      <div className="text-[8px] mt-1">POS001230123</div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                {posReceiptFooter && (
                  <div className="text-center text-[10px] mt-6 pt-4 border-t border-dashed border-black">
                    <p className="whitespace-pre-line">{posReceiptFooter}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="a4">
              <div className="p-8 bg-white text-black text-sm max-w-2xl mx-auto">
                {/* Header */}
                <header className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    {displayLogoUrl ? (
                      <Image
                        src={displayLogoUrl}
                        alt="Logo"
                        width={posReceiptLogoSize}
                        height={posReceiptLogoSize}
                        className="object-contain"
                      />
                    ) : (
                      <Logo className="h-16 w-16 text-slate-800" />
                    )}
                    <div>
                      {posShowBusinessName && (
                        <h1 className="font-bold text-xl text-slate-800">{displayName}</h1>
                      )}
                      {posShowAddress && (
                        <p className="text-slate-500 text-xs">{displayAddress}</p>
                      )}
                      {posShowPhone && (
                        <p className="text-slate-500 text-xs">Tel: {displayPhone}</p>
                      )}
                      {posShowEmail && (
                        <p className="text-slate-500 text-xs">{businessEmail}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="font-bold text-2xl uppercase text-slate-800">Invoice</h2>
                    <p className="text-slate-500 text-xs">#POS-00123</p>
                    {posShowDate && (
                      <p className="text-slate-500 text-xs">{format(today, 'PPP')}</p>
                    )}
                  </div>
                </header>

                <div className="h-px bg-slate-300 my-4" />

                {/* Customer Info */}
                <div className="flex justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-slate-600 text-sm mb-1">Bill To:</h3>
                    <p className="font-bold text-slate-800">Walk-in Customer</p>
                    <p className="text-slate-600 text-xs">Room 101</p>
                  </div>
                  {posShowCashierName && (
                    <div className="text-right">
                      <h3 className="font-semibold text-slate-600 text-sm mb-1">Cashier:</h3>
                      <p className="text-slate-800">John Smith</p>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full text-left mb-6">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {sampleItems.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="p-3">{item.name}</td>
                        <td className="p-3 text-center">{item.qty}</td>
                        <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                        <td className="p-3 text-right">{formatCurrency(item.price * item.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-slate-600 text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {posTaxRate > 0 && (
                      <div className="flex justify-between text-slate-600 text-sm">
                        <span>{posTaxLabel} ({posTaxRate}%)</span>
                        <span>{formatCurrency(tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base text-slate-800 border-t-2 border-slate-300 pt-2">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    {posShowPaymentMethod && (
                      <>
                        <div className="flex justify-between text-slate-600 text-sm pt-2">
                          <span>Amount Paid (Cash)</span>
                          <span>{formatCurrency(150)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 text-sm font-medium">
                          <span>Change</span>
                          <span>{formatCurrency(25)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer */}
                {posReceiptFooter && (
                  <div className="mt-12 text-center text-xs text-slate-500">
                    <p className="whitespace-pre-line">{posReceiptFooter}</p>
                  </div>
                )}

                {/* Barcode */}
                {posShowBarcode && (
                  <div className="text-center mt-8">
                    <div className="inline-block border-2 border-slate-300 px-6 py-3 rounded">
                      <div className="text-lg tracking-[0.5em] font-bold text-slate-800">
                        ||||| ||||| ||||| ||||
                      </div>
                      <div className="text-xs mt-2 text-slate-600">POS001230123</div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
