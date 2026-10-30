
'use client';

import * as React from 'react';
import { Camera, Video, Check, X, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CameraCapture({ onCapture, open, onOpenChange }: CameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const startCamera = React.useCallback(async () => {
    setError(null);
    setCapturedImage(null);
    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      let message = 'Could not access camera. Please ensure camera permissions are allowed.';
      if (err instanceof Error && err.name === 'NotAllowedError') {
        message = 'Camera access was denied. Please enable camera permission in your mobile browser settings.';
      }
      setError(message);
    }
  }, []);

  const stopCamera = React.useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
  }, [stream]);

  React.useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      try {
        const arr = capturedImage.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], `capture-${Date.now()}.png`, { type: mime });
        onCapture(file);
        toast({ variant: 'success', title: 'Photo Captured' });
        onOpenChange(false);
      } catch (e) {
        console.error('Error creating offline image file:', e);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera /> Capture Guest Photo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            {error && (
              <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                 <Alert variant="destructive">
                  <AlertTitle>Camera Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}
            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="h-full w-full object-contain" />
            )}
            {!error && stream && (
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
            )}
            {!error && !stream && !capturedImage && (
                <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
        <DialogFooter>
          {capturedImage ? (
            <div className="flex w-full justify-between">
              <Button variant="outline" onClick={handleRetake}><RefreshCw className="mr-2 h-4 w-4" />Retake</Button>
              <Button onClick={handleConfirm}><Check className="mr-2 h-4 w-4" />Confirm Photo</Button>
            </div>
          ) : (
            <div className="flex w-full justify-between">
                <Button variant="outline" onClick={() => onOpenChange(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
                <Button onClick={handleCapture} disabled={!stream}>
                    <Video className="mr-2 h-4 w-4" /> Capture
                </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
