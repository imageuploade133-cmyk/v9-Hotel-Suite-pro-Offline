'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useToast } from '../../../hooks/use-toast';
import { Link as LinkIcon, QrCode, Copy, MessageSquareText, Loader2, User, Phone, FileText, Eye, Download, Check, Hourglass, Archive, ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useFirestore, useCollection } from '../../../firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, where, doc, updateDoc } from 'firebase/firestore';
import type { Room, Booking, GuestReport, Bill, Payment } from '../../../lib/types';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { TopHeader } from '../../../components/top-header';
import { useSettings } from '../../../contexts/settings-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { useUser } from '../../../contexts/user-context';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import { Skeleton } from '../../../components/ui/skeleton';
import { ViewBillQrDialog } from '../../../components/bookings/view-bill-qr-dialog';
import * as htmlToImage from 'html-to-image';
import { GuestBillDialog } from '../../../components/bookings/guest-bill-dialog';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';


// SendTestDialog remains unchanged.
interface SendTestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string | null;
  onSend: (roomNumber: string, message: string, guestName: string, phoneNumber: string) => Promise<void>;
}

function SendTestDialog({ isOpen, onClose, roomNumber, onSend }: SendTestDialogProps) {
    const [message, setMessage] = React.useState('');
    const [guestName, setGuestName] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setMessage(`This is a test report from Room ${roomNumber}. The guest reporting system is working correctly.`);
            setGuestName('Test Guest');
            setPhoneNumber('');
        }
    }, [isOpen, roomNumber]);

    const handleSend = async () => {
        if (!roomNumber) return;
        setIsSending(true);
        try {
            await onSend(roomNumber, message, guestName, phoneNumber);
            onClose();
        } finally {
            setIsSending(false);
        }
    }

    if (!isOpen || !roomNumber) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send Test Report for Room {roomNumber}</DialogTitle>
                    <DialogDescription>
                        Edit the details below and send it to your configured alert number to test the system. This will also create a report entry.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="test-guestName">Guest Name</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="test-guestName"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="test-phoneNumber">Phone Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="test-phoneNumber"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="test-message">Test Message</Label>
                        <Textarea
                            id="test-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isSending}>Cancel</Button>
                    <Button onClick={handleSend} disabled={isSending || !message.trim() || !guestName.trim()}>
                        {isSending ? <Loader2 className="animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4"/>}
                        Send Test Message
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface CopyButtonProps {
    textToCopy: any;
    type: 'Report' | 'Bill';
}

function CopyButton({ textToCopy, type }: CopyButtonProps) {
    const [isCopied, setIsCopied] = React.useState(false);
    const { toast } = useToast();

    const handleCopy = () => {
        const stringToCopy = typeof textToCopy === 'string'
            ? textToCopy
            : JSON.stringify(textToCopy, null, 2);

        const textarea = document.createElement('textarea');
        textarea.value = stringToCopy;
        textarea.style.position = 'fixed';  // Prevent scrolling to bottom of page in MS Edge.
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                toast({
                  title: `${type} Link Copied!`,
                  description: `The guest ${type.toLowerCase()} link has been copied to your clipboard.`,
                });
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } else {
                throw new Error('Copy command failed');
            }
        } catch (err) {
            console.error('Failed to copy: ', err);
            toast({
                variant: 'destructive',
                title: 'Copy Failed',
                description: 'Could not copy the URL to your clipboard.',
            });
            setIsCopied(false);
        } finally {
            document.body.removeChild(textarea);
        }
    };

    return (
        <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={handleCopy}>
            {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
    );
}


function GuestEngagementPageComponent() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { settings } = useSettings();
  const { userProfile } = useUser();
  const [origin, setOrigin] = React.useState('');
  const [testingRoom, setTestingRoom] = React.useState<string | null>(null);
  const [billQrData, setBillQrData] = React.useState<{ roomNumber: string; url: string; guestName?: string; } | null>(null);
  const [previewBooking, setPreviewBooking] = React.useState<Booking | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState('');
  const ITEMS_PER_PAGE = 6;

  const guestReportsQuery = React.useMemo(() => firestore
    ? query(
        collection(firestore, 'guestReports'),
        where('status', 'in', ['new', 'in-progress']),
        orderBy('reportedAt', 'desc')
      )
    : null, [firestore]);
  const { data: pendingReports, isLoading: areReportsLoading } = useCollection<GuestReport>(guestReportsQuery);
  const [updatingReportId, setUpdatingReportId] = React.useState<string | null>(null);

  const billsQuery = React.useMemo(() => (firestore && previewBooking) ? query(collection(firestore, 'billItems'), where('bookingId', '==', previewBooking.id), orderBy('date', 'desc')) : null, [firestore, previewBooking]);
  const { data: allBills, isLoading: areBillsLoading } = useCollection<Bill>(billsQuery);

  const paymentsQuery = React.useMemo(() => (firestore && previewBooking) ? query(collection(firestore, 'payments'), where('bookingId', '==', previewBooking.id), orderBy('paymentDate', 'desc')) : null, [firestore, previewBooking]);
  const { data: allPayments, isLoading: arePaymentsLoading } = useCollection<Payment>(paymentsQuery);


  const handleUpdateReportStatus = async (reportId: string, status: 'in-progress' | 'resolved' | 'archived') => {
      if (!firestore) return;
      setUpdatingReportId(reportId);
      try {
          const reportRef = doc(firestore, 'guestReports', reportId);
          await updateDoc(reportRef, { status });
          toast({ variant: 'success', title: 'Report Updated', description: `Report marked as ${status}.`});
      } catch (error) {
          toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update report status.' });
      } finally {
          setUpdatingReportId(null);
      }
  }


  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);


  const roomsQuery = React.useMemo(
    () => (firestore ? query(collection(firestore, 'rooms'), orderBy('name')) : null),
    [firestore]
  );
  const { data: rooms, isLoading: areRoomsLoading } = useCollection<Room>(roomsQuery);

  const filteredRoomNumbers = React.useMemo(() => {
    let numbers = rooms?.flatMap(roomType => roomType.roomNumbers || []) || [];
    if (searchTerm) {
        numbers = numbers.filter(roomNumber =>
            roomNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    return numbers;
  }, [rooms, searchTerm]);

  const totalPages = Math.ceil(filteredRoomNumbers.length / ITEMS_PER_PAGE);
  const paginatedRoomNumbers = filteredRoomNumbers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);


  const activeBookingsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'bookings'), where('status', 'in', ['Active', 'Checked-in'])) : null, [firestore]);
  const { data: activeBookings } = useCollection<Booking>(activeBookingsQuery);

  const activeGuestMap = React.useMemo(() => {
      const map = new Map<string, Booking>();
      if (activeBookings) {
          activeBookings.forEach(booking => {
              if (booking.roomNumber) {
                  map.set(booking.roomNumber, booking);
              }
          });
      }
      return map;
  }, [activeBookings]);

  const downloadQRCode = (roomNumber: string, type: 'report' | 'bill') => {
    const qrCodeNodeId = `qr-code-container-${type}-${roomNumber}`;
    const qrCodeNode = document.getElementById(qrCodeNodeId);

    if (qrCodeNode) {
      htmlToImage.toPng(qrCodeNode, { cacheBust: true, quality: 1.0, pixelRatio: 3 })
        .then((dataUrl) => {
          const link = document.createElement('a');
          const typeName = type === 'report' ? 'Report_Issue' : 'View_Bill';
          link.download = `Room_${roomNumber}_${typeName}_QR.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('Failed to download QR code', err);
          toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not generate QR code image.' });
        });
    }
  };

  const handleSendTest = async (roomNumber: string, message: string, guestName: string, phoneNumber: string) => {
    const alertPhoneNumber = settings?.stockAlertPhoneNumber;

    if (!alertPhoneNumber) {
        toast({
            variant: 'destructive',
            title: 'WhatsApp Number Not Configured',
            description: 'Please set the "WhatsApp Alert Number" in the Inventory Policy settings to receive test messages.',
        });
        return;
    }

    if (!firestore || !userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not submit test report.' });
        return;
    }

    try {
        await addDoc(collection(firestore, 'guestReports'), {
            roomNumber,
            reportMessage: message,
            guestName: `${guestName} (Test by ${userProfile.name})`,
            phoneNumber: phoneNumber,
            bookingId: null,
            reportedAt: serverTimestamp(),
            status: 'new',
        });

        const notificationMessage = `TEST MESSAGE FROM ROOM ${roomNumber}:\n\n*Guest:* ${guestName}\n*Phone:* ${phoneNumber || 'Not provided'}\n*Report:* "${message}"`;
        const result = await sendWhatsAppMessage({
            phone: alertPhoneNumber,
            message: notificationMessage,
            senderName: 'System Test',
        });

        if (result.status === 'success') {
            toast({
                variant: 'success',
                title: 'Test Report Sent',
                description: `A test report for Room ${roomNumber} was created and sent to ${alertPhoneNumber}.`
            });
        } else {
             throw new Error(result.message || "An unknown error occurred.");
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Failed to Send Test',
            description: error.message,
        });
    }
  }

  const isLoading = areRoomsLoading || areReportsLoading;

  if (isLoading && !rooms && !pendingReports) {
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <div className="flex-grow">
                    <Skeleton className="h-8 w-1/3" />
                </div>
            </div>
             <Skeleton className="h-10 w-1/2" />
             <Skeleton className="h-96 w-full" />
        </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <TopHeader name="Guest Engagement" icon={<LinkIcon />} className="!mb-0 flex-grow" />
          </div>

          <Tabs defaultValue="tools">
            <TabsList>
                <TabsTrigger value="tools">Engagement Tools</TabsTrigger>
                <TabsTrigger value="reports">
                    Pending Reports
                    {pendingReports && pendingReports.length > 0 && <Badge className="ml-2">{pendingReports.length}</Badge>}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="tools">
                <Card>
                    <CardHeader>
                        <CardTitle>Room Links & QR Codes</CardTitle>
                        <CardDescription>
                        Unique links and QR codes for each room. "Report Issue" lets guests submit maintenance or service requests. "View Bill" shows an active guest their current folio.
                        </CardDescription>
                        <div className="relative pt-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search for a room..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {paginatedRoomNumbers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {paginatedRoomNumbers.map(roomNumber => {
                                const reportUrl = `${origin}/guest-report?room=${roomNumber}`;
                                const billUrl = `${origin}/guest-bill?room=${roomNumber}`;
                                const activeGuest = activeGuestMap.get(roomNumber);

                                return (
                                    <Card key={roomNumber} className="flex flex-col">
                                        <CardHeader>
                                            <CardTitle>Room {roomNumber}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex-grow flex flex-col items-center gap-4">
                                            <div className="flex gap-4">
                                                <div id={`qr-code-container-report-${roomNumber}`} className="relative bg-white p-2 rounded-md border w-fit cursor-pointer hover:shadow-lg transition-shadow" onClick={() => downloadQRCode(roomNumber, 'report')}>
                                                    <QRCode value={reportUrl} size={80} level={"H"} includeMargin={false} />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center p-0.5 font-sans">Report Issue</div>
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                        <Download className="text-white h-8 w-8" />
                                                    </div>
                                                </div>
                                                <div id={`qr-code-container-bill-${roomNumber}`} className="relative bg-white p-2 rounded-md border w-fit cursor-pointer hover:shadow-lg transition-shadow" onClick={() => downloadQRCode(roomNumber, 'bill')}>
                                                    <QRCode value={billUrl} size={80} level={"H"} includeMargin={false} />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center p-0.5 font-sans">View Bill</div>
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                        <Download className="text-white h-8 w-8" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-full space-y-2 mt-4">
                                                <div className="relative">
                                                    <Input value={reportUrl} readOnly className="pr-10 text-xs" />
                                                    <CopyButton textToCopy={reportUrl} type="Report" />
                                                </div>
                                                <div className="relative">
                                                    <Input value={billUrl} readOnly className="pr-10 text-xs" />
                                                    <CopyButton textToCopy={billUrl} type="Bill" />
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="grid grid-cols-2 gap-2 mt-auto">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!activeGuest}
                                            onClick={() => setBillQrData({ roomNumber, url: billUrl, guestName: activeGuest?.guestName })}
                                        >
                                            <QrCode className="mr-2 h-4 w-4" /> View Bill QR
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!activeGuest}
                                            onClick={() => setPreviewBooking(activeGuest || null)}
                                        >
                                            <Eye className="mr-2 h-4 w-4" />
                                            Live Preview
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setTestingRoom(roomNumber)}
                                            className="col-span-2"
                                        >
                                            <MessageSquareText className="mr-2 h-4 w-4" />
                                            Send Test Report
                                        </Button>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No rooms found for "{searchTerm}".</p>
                            </div>
                        )}
                    </CardContent>
                    {totalPages > 1 && (
                        <CardFooter className="flex justify-center items-center gap-4">
                            <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                            <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                Next
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </TabsContent>

            <TabsContent value="reports">
                 <Card>
                    <CardHeader>
                        <CardTitle>Pending Guest Reports</CardTitle>
                        <CardDescription>Review and manage guest-submitted reports that are new or in-progress.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {areReportsLoading && (
                             <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        )}
                        {!areReportsLoading && (!pendingReports || pendingReports.length === 0) && (
                            <p className="text-muted-foreground text-center py-8">No pending reports.</p>
                        )}
                        <div className="space-y-4">
                            {pendingReports?.map(report => (
                                <div key={report.id} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">Room {report.roomNumber} <span className="font-normal text-muted-foreground">- {report.guestName}</span></p>
                                            <p className="text-sm text-muted-foreground">{report.reportedAt ? formatDistanceToNow(report.reportedAt.toDate()) : ''} ago</p>
                                        </div>
                                         <Badge variant={report.status === 'new' ? 'destructive' : 'secondary'}>{report.status}</Badge>
                                    </div>
                                    <p className="text-sm bg-muted p-2 rounded-md">{report.reportMessage}</p>
                                    <div className="flex gap-2 justify-end">
                                        {updatingReportId === report.id ? <Loader2 className="animate-spin" /> : (
                                            <>
                                                {report.status === 'new' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleUpdateReportStatus(report.id, 'in-progress')}>
                                                        <Hourglass className="mr-2 h-4 w-4" /> Start
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="default" onClick={() => handleUpdateReportStatus(report.id, 'resolved')}>
                                                    <Check className="mr-2 h-4 w-4" /> Resolve
                                                </Button>
                                                 <Button size="sm" variant="ghost" onClick={() => handleUpdateReportStatus(report.id, 'archived')}>
                                                    <Archive className="mr-2 h-4 w-4" /> Archive
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
      </div>
      <SendTestDialog
        isOpen={!!testingRoom}
        onClose={() => setTestingRoom(null)}
        roomNumber={testingRoom}
        onSend={handleSendTest}
      />
      {billQrData && (
        <ViewBillQrDialog
          isOpen={!!billQrData}
          onClose={() => setBillQrData(null)}
          {...billQrData}
        />
      )}
      {previewBooking && (
        <GuestBillDialog
          isOpen={!!previewBooking}
          onClose={() => setPreviewBooking(null)}
          booking={previewBooking}
          allBills={allBills}
          allPayments={allPayments}
          isLoading={areBillsLoading || arePaymentsLoading}
          onViewImage={() => {}}
        />
      )}
    </>
  );
}

export default GuestEngagementPageComponent;
