
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from '../logo';
import { Separator } from '../ui/separator';
import { format } from 'date-fns';
import Image from 'next/image';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { CircleX } from 'lucide-react';

interface InvoicePreviewProps {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  businessLogoUrl?: string;
  logoSize?: number;
  currency?: string;
  cancellationDetails?: string;
  cancellationFooter1?: string;
  cancellationFooter2?: string;
  unpaidFooter1?: string;
  unpaidFooter2?: string;
  showWatermark?: boolean;
  watermarkUrl?: string;
  watermarkOpacity?: number;
  watermarkSize?: number;
  watermarkPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  showReportQrOnReceipt?: boolean;
}

export function InvoicePreview({
  businessName = 'Your Business Name',
  businessAddress = '123 Business Rd, Suite 100, City, State 12345',
  businessPhone = '+1 (800) 555-0199',
  businessEmail,
  businessWebsite,
  businessLogoUrl,
  logoSize = 48,
  currency = 'USD',
  cancellationDetails = "A refund for the pre-paid amount has been issued.",
  cancellationFooter1 = "This is an official cancellation confirmation.",
  cancellationFooter2 = "Hotel Suite Pro | This is a computer-generated document.",
  unpaidFooter1 = "Thank you for choosing us!",
  unpaidFooter2 = "This is a computer-generated document.",
  showWatermark,
  watermarkUrl,
  watermarkOpacity = 0.07,
  watermarkSize = 50,
  watermarkPosition = 'center',
  showReportQrOnReceipt,
}: InvoicePreviewProps) {
  const [activeTab, setActiveTab] = React.useState('booking');
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const today = new Date();
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const getWatermarkPositionStyle = () => {
    switch (watermarkPosition) {
      case 'top-left': return { top: '5%', left: '5%', transform: 'translate(0, 0)' };
      case 'top-right': return { top: '5%', right: '5%', transform: 'translate(0, 0)' };
      case 'bottom-left': return { bottom: '5%', left: '5%', transform: 'translate(0, 0)' };
      case 'bottom-right': return { bottom: '5%', right: '5%', transform: 'translate(0, 0)' };
      default: return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const watermarkContainerStyle: React.CSSProperties = watermarkPosition === 'tile' ? {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${watermarkSize * 2}px, 1fr))`,
    gap: '20px',
    opacity: watermarkOpacity,
    zIndex: 0,
    pointerEvents: 'none',
  } : {
    position: 'absolute',
    opacity: watermarkOpacity,
    zIndex: 0,
    pointerEvents: 'none',
    width: `${watermarkSize}%`,
    height: 'auto',
    ...getWatermarkPositionStyle(),
  };

  const WatermarkComponent = () => {
    if (!showWatermark || !watermarkUrl) return null;

    if (watermarkPosition === 'tile') {
      return (
        <div style={watermarkContainerStyle}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="relative w-full aspect-square">
              <Image src={watermarkUrl} alt="Watermark" layout="fill" objectFit="contain" />
            </div>
          ))}
        </div>
      );
    }

    return (
       <div style={watermarkContainerStyle}>
            <div style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
                <Image src={watermarkUrl} alt="Watermark" layout="fill" objectFit="contain" />
            </div>
        </div>
    );
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Preview</CardTitle>
        <CardDescription>
          A live preview of how your invoices and receipts will look.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="booking">Booking Receipt</TabsTrigger>
            <TabsTrigger value="cancellation">Cancellation</TabsTrigger>
            <TabsTrigger value="receipt">Terminal Receipt</TabsTrigger>
          </TabsList>
          <div className="mt-2 h-[600px] overflow-y-auto rounded-lg border bg-white shadow-inner">
             <TabsContent value="booking">
              <div className="p-6 bg-white text-black text-xs rounded-lg relative">
                <WatermarkComponent />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <header className="flex justify-between items-start mb-6">
                        <div>
                            {businessLogoUrl ? (
                                <Image src={businessLogoUrl} alt="logo" width={logoSize} height={logoSize} className="object-contain" />
                            ) : (
                                <Logo className="h-10 w-10 text-slate-800" />
                            )}
                        </div>
                        <div className="text-right">
                             <h1 className="font-bold text-base text-slate-800">{businessName}</h1>
                            <p className="text-slate-500 text-[10px]">{businessAddress}</p>
                            <p className="text-slate-500 text-[10px]">{businessPhone}</p>
                            <p className="text-slate-500 text-[10px]">{businessEmail}</p>
                            <p className="text-slate-500 text-[10px]">{businessWebsite}</p>
                        </div>
                    </header>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-left">
                            <h2 className="font-bold text-xl uppercase text-slate-800">Invoice</h2>
                            <p className="text-slate-500">Invoice #: DEMO-12345</p>
                            <p className="text-slate-500">Date: {format(today, 'PPP')}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="font-semibold text-slate-600 mb-1">Bill To:</h3>
                            <p className="font-bold text-slate-800">John Doe</p>
                            <p className="text-slate-600">john.doe@example.com</p>
                        </div>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                            <tr>
                                <th className="p-2">Description</th>
                                <th className="p-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-slate-100">
                                <td className="p-2">Stay at Deluxe Room</td>
                                <td className="p-2 text-right">{formatCurrency(250)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="flex justify-end mt-6">
                        <div className="w-full max-w-xs space-y-2 text-slate-700">
                            <div className="flex justify-between font-bold text-base text-slate-800 border-t-2 border-dashed border-slate-300 pt-2">
                                <span>Grand Total</span>
                                <span>{formatCurrency(250)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base text-green-600">
                                <span>Amount Paid</span>
                                <span>{formatCurrency(250)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 text-center text-xs text-slate-500">
                      <p>Thank you for choosing us!</p>
                      <p>This is a computer-generated invoice.</p>
                       {showReportQrOnReceipt && (
                        <div className="flex flex-col items-center gap-2 mt-4">
                          <QRCode value={`${origin}/guest-report/101`} size={64} />
                          <p className="font-semibold">Scan to Report an Issue</p>
                        </div>
                      )}
                    </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="cancellation">
              <div className="p-6 bg-white text-black text-xs rounded-lg relative">
                  <WatermarkComponent />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                      <header className="flex justify-between items-start mb-6">
                          <div>
                              {businessLogoUrl ? (
                                  <Image src={businessLogoUrl} alt="logo" width={logoSize} height={logoSize} className="object-contain" />
                              ) : (
                                  <Logo className="h-10 w-10 text-slate-800" />
                              )}
                          </div>
                          <div className="text-right">
                               <h1 className="font-bold text-base text-slate-800">{businessName}</h1>
                              <p className="text-slate-500 text-[10px]">{businessAddress}</p>
                              <p className="text-slate-500 text-[10px]">{businessPhone}</p>
                              <p className="text-slate-500 text-[10px]">{businessEmail}</p>
                              <p className="text-slate-500 text-[10px]">{businessWebsite}</p>
                          </div>
                      </header>

                      <Separator className="my-4" />

                      <div className="text-center mb-6">
                          <h2 className="font-bold text-xl uppercase text-red-600">Cancellation</h2>
                          <p className="text-slate-500 text-[11px]">Booking ID: MOCK-12345</p>
                          <p className="text-slate-500 text-[11px]">Cancelled On: {format(today, 'PPP')}</p>
                      </div>

                      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-3 mb-6">
                          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                              <div className="rounded-full bg-red-100 p-2">
                                  <CircleX className="h-6 w-6 text-red-600" />
                              </div>
                              <div>
                                  <h3 className="text-base font-bold text-red-700">Pre-paid Reservation Cancelled</h3>
                                  <p className="text-[11px] text-red-600/80">
                                      A refund will be issued for the pre-paid amount of {formatCurrency(250)}.
                                  </p>
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 mb-6">
                          <div>
                              <h3 className="font-semibold text-slate-600 mb-1 text-[11px]">Guest Information:</h3>
                              <p className="font-bold text-slate-800">John Doe</p>
                              <p className="text-slate-600">john.doe@example.com</p>
                          </div>
                          <div>
                              <h3 className="font-semibold text-slate-600 mb-1 text-[11px]">Booking Details:</h3>
                              <p className="text-slate-800"><b>Room:</b> 101</p>
                              <p className="text-slate-800"><b>Check-in:</b> {format(today, 'PPP')}</p>
                          </div>
                      </div>

                      <Separator className="my-6" />

                      <div>
                          <h3 className="font-semibold text-slate-600 mb-2 text-[11px]">Cancellation Details:</h3>
                          <p className="text-slate-700 mt-1">{cancellationDetails}</p>
                      </div>

                      <div className="mt-10 text-center text-[10px] text-slate-500">
                          <p>{cancellationFooter1}</p>
                          <p>{cancellationFooter2}</p>
                      </div>
                  </div>
              </div>
            </TabsContent>
            <TabsContent value="receipt">
              <div className="p-6 bg-white text-black receipt max-w-sm mx-auto text-xs">
                  <div className="text-center space-y-1 mb-4">
                      {businessLogoUrl && (
                          <Image src={businessLogoUrl} alt="logo" width={logoSize} height={logoSize} className="object-contain mx-auto" />
                      )}
                      <h1 className="font-bold">{businessName}</h1>
                      <p className="text-[10px]">{businessAddress}</p>
                      <p className="text-[10px]">{businessPhone}</p>
                      <p className="text-[10px]">{businessEmail}</p>
                      <p className="text-[10px]">{businessWebsite}</p>
                  </div>
                  <div className="text-center text-[10px] mb-4">
                      <p>Date: {format(today, 'MM/dd/yyyy HH:mm:ss')}</p>
                      <p>Receipt ID: RCPT-MOCK-123</p>
                  </div>

                  <p className="font-bold uppercase text-center mb-2">Sale</p>
                  <div className="space-y-1 border-y border-dashed border-black py-2">
                      <div className="flex justify-between">
                          <span>Room Stay (1 night)</span>
                          <span>{formatCurrency(250)}</span>
                      </div>
                  </div>

                  <div className="space-y-1 my-2">
                      <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(250)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span>Tax:</span>
                          <span>{formatCurrency(0)}</span>
                      </div>
                  </div>

                  <div className="flex justify-between font-bold text-sm border-t border-dashed border-black pt-2">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(250)}</span>
                  </div>

                  <div className="my-4 space-y-1 text-center">
                      <p className="font-bold uppercase">Credit Card</p>
                      <p className="font-bold text-base">Amount Paid: {formatCurrency(250)}</p>
                  </div>

                  <div className="text-center text-[10px] mt-6">
                      <p>{unpaidFooter1}</p>
                      <p>{unpaidFooter2}</p>
                  </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
    );
}
