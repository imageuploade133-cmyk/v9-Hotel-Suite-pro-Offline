'use client';

import * as React from 'react';
import { Camera, Video, Check, X, RefreshCw, Loader2, Smartphone } from 'lucide-react';
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
  const streamRef = React.useRef<MediaStream | null>(null);
  const fallbackInputRef = React.useRef<HTMLInputElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isStarting, setIsStarting] = React.useState(false);
  const [isCameraStarted, setIsCameraStarted] = React.useState(false);
  const { toast } = useToast();

  const stopCamera = React.useCallback(() => {
    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCameraStarted(false);
  }, []);

  const startCamera = React.useCallback(async () => {
    setError(null);
    setCapturedImage(null);
    setIsStarting(true);

    if (!window.isSecureContext) {
      setError('Camera access requires HTTPS. Open this application using its secure HTTPS address and try again.');
      setIsStarting(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support live camera access. Use the device camera button below instead.');
      setIsStarting(false);
      return;
    }

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (firstError) {
        const name = firstError instanceof Error ? firstError.name : '';
        if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') throw firstError;
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraStarted(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setError('Camera permission was denied or blocked. Allow camera access for this site in your browser settings, then select Start Camera again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera was found on this device. You can use the device camera option instead.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('The camera is currently being used by another application or is unavailable. Close other camera apps and try again.');
      } else {
        setError('Could not start the camera. Check your browser permission and device camera, then try again.');
      }
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Keep the video element mounted while the camera starts. Attach the stream
  // after React has rendered it, and also retry playback when metadata arrives.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;

    video.srcObject = stream;
    const playVideo = () => {
      void video.play().catch(err => {
        console.warn('Camera preview playback failed:', err);
        setError('Camera permission is active, but the video preview could not start. Tap Restart Camera or use the device camera option.');
      });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) playVideo();
    else video.addEventListener('loadedmetadata', playVideo, { once: true });

    const handleTrackEnded = () => {
      setError('The camera stopped unexpectedly. Tap Restart Camera to reconnect.');
      setStream(null);
      setIsCameraStarted(false);
    };
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', handleTrackEnded));

    return () => {
      video.removeEventListener('loadedmetadata', playVideo);
      stream.getVideoTracks().forEach(track => track.removeEventListener('ended', handleTrackEnded));
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  React.useEffect(() => {
    if (!open) {
      stopCamera();
      setCapturedImage(null);
      setError(null);
      return;
    }
    return () => {
      const activeStream = streamRef.current;
      activeStream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [open, stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      setError('The camera is connected but the preview is not ready yet. Wait a moment or restart the camera.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not process the camera image. Please restart the camera and try again.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/png'));
    stopCamera();
  };

  const handleConfirm = () => {
    if (!capturedImage) return;
    try {
      const base64 = capturedImage.split(',')[1];
      const mime = capturedImage.match(/^data:(.*?);/)?.[1] || 'image/png';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      onCapture(new File([bytes], `guest-capture-${Date.now()}.png`, { type: mime }));
      toast({ variant: 'success', title: 'Photo Captured' });
      onOpenChange(false);
    } catch (err) {
      console.error('Error creating camera image file:', err);
      setError('The captured image could not be prepared. Please retake the photo.');
    }
  };

  const handleFallbackFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onCapture(file);
      toast({ variant: 'success', title: 'Photo Selected' });
      onOpenChange(false);
    }
    event.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) stopCamera();
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="min-h-0 overflow-hidden sm:max-h-[min(90dvh,52rem)] sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Capture Guest Photo</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Live guest camera preview"
              className={`absolute inset-0 h-full w-full object-contain ${stream && !capturedImage ? 'block' : 'hidden'}`}
            />
            {capturedImage ? (
              <img src={capturedImage} alt="Captured guest" className="absolute inset-0 h-full w-full object-contain" />
            ) : !stream ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
                {isStarting ? <Loader2 className="h-9 w-9 animate-spin" /> : <Camera className="h-12 w-12 opacity-80" />}
                <p className="text-sm text-white/80">{isStarting ? 'Connecting to camera…' : 'Camera preview will appear here'}</p>
              </div>
            ) : null}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Camera Notice</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFallbackFile}
            aria-label="Take a photo using the device camera"
          />
        </div>

        <DialogFooter className="shrink-0">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => {
                stopCamera();
                onOpenChange(false);
              }}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              {!capturedImage && (
                <Button type="button" variant="outline" onClick={() => fallbackInputRef.current?.click()}>
                  <Smartphone className="mr-2 h-4 w-4" /> Use Device Camera
                </Button>
              )}
            </div>
            {capturedImage ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void startCamera()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retake
                </Button>
                <Button type="button" onClick={handleConfirm}>
                  <Check className="mr-2 h-4 w-4" /> Confirm Photo
                </Button>
              </div>
            ) : stream ? (
              <Button type="button" onClick={handleCapture}>
                <Video className="mr-2 h-4 w-4" /> Capture
              </Button>
            ) : (
              <Button type="button" onClick={() => void startCamera()} disabled={isStarting}>
                {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                {isStarting ? 'Starting Camera…' : isCameraStarted ? 'Restart Camera' : 'Start Camera'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
