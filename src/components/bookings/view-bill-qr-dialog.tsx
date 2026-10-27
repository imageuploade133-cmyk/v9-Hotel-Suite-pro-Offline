'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { Button } from '../ui/button';
import { Download, X } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { useToast } from '@/hooks/use-toast';


interface ViewBillQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomNumber: string;
  url: string;
  guestName?: string;
}

export function ViewBillQrDialog({ isOpen, onClose, roomNumber, url, guestName }: ViewBillQrDialogProps) {
  const qrCodeRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const downloadQRCode = () => {
    if (qrCodeRef.current) {
        htmlToImage.toPng(qrCodeRef.current, { cacheBust: true, quality: 1.0, pixelRatio: 4 })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `Room_${roomNumber}_ViewBill_QR.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('Failed to download QR code', err);
          toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not generate QR code image.' });
        });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>View Bill QR Code for Room {roomNumber}</DialogTitle>
          <DialogDescription>
            {guestName ? `This QR code is for ${guestName}.` : ''} Guests can scan this to view their current folio in real-time.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
           <div ref={qrCodeRef} className="bg-white p-6 rounded-lg border">
                <QRCode value={url} size={256} level="H" includeMargin />
            </div>
        </div>
        <DialogFooter className="sm:justify-between flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" /> Close</Button>
            <Button onClick={downloadQRCode}><Download className="mr-2 h-4 w-4" /> Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}