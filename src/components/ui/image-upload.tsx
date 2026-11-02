'use client';

import * as React from 'react';
import { useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Alert, AlertDescription } from './alert';
import { Card, CardContent } from './card';
import { Badge } from './badge';
import { cn } from '../../lib/utils';

interface ImageUploadProps {
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  className?: string;
  disabled?: boolean;
}

interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

export function ImageUpload({ onImagesChange, maxImages = 5, className, disabled }: ImageUploadProps) {
  const [images, setImages] = React.useState<ImageFile[]>([]);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = React.useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    setError(null);
    setIsProcessing(true);

    const validFiles: File[] = [];
    const maxSize = 5 * 1024 * 1024; // 5MB

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        setError('Image size must be less than 5MB');
        return;
      }

      validFiles.push(file);
    });

    if (validFiles.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Check if adding these images would exceed the limit
    if (images.length + validFiles.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      setIsProcessing(false);
      return;
    }

    // Create preview URLs
    const newImages: ImageFile[] = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9),
    }));

    const updatedImages = [...images, ...newImages];
    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.preview));

    setIsProcessing(false);
  }, [images, maxImages, onImagesChange, disabled]);

  const handleCameraCapture = React.useCallback((file: File) => {
    const newImage: ImageFile = {
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9),
    };

    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    const updatedImages = [...images, newImage];
    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.preview));
    setIsCameraOpen(false);
  }, [images, maxImages, onImagesChange]);

  const removeImage = React.useCallback((id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }

    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    onImagesChange(updatedImages.map(img => img.preview));
  }, [images, onImagesChange]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  React.useEffect(() => {
    // Cleanup preview URLs on unmount
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  const CameraDialog = () => (
    <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Take Photo
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <SimpleCameraCapture
            onCapture={handleCameraCapture}
            onError={(error) => setError(error)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );

  if (disabled) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="text-sm text-muted-foreground">Image upload disabled</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Controls */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || images.length >= maxImages}
          className="flex-1"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Upload Images
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setIsCameraOpen(true)}
          disabled={isProcessing || images.length >= maxImages}
          className="flex-1"
        >
          <Camera className="mr-2 h-4 w-4" />
          Take Photo
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Select image files"
      />

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Selected Images</span>
            <Badge variant="secondary">
              {images.length}/{maxImages}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {images.map((image) => (
              <Card key={image.id} className="relative overflow-hidden">
                <CardContent className="p-2">
                  <div className="relative aspect-square">
                    <img
                      src={image.preview}
                      alt="Selected"
                      className="h-full w-full object-cover rounded-md"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => removeImage(image.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {image.file.name}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <CameraDialog />
    </div>
  );
}

// Camera permission is requested directly inside the user's click handler.
// This preserves the browser's permission prompt and avoids delayed effect-based requests.
interface SimpleCameraCaptureProps {
  onCapture: (file: File) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

function SimpleCameraCapture({ onCapture, onError, onCancel }: SimpleCameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fallbackInputRef = React.useRef<HTMLInputElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const startCamera = React.useCallback(async () => {
    setHasStarted(true);
    setCameraError(null);
    setIsLoading(true);

    if (!window.isSecureContext) {
      const message = 'Camera access requires a secure connection (HTTPS). Open this app using its HTTPS address, then try again.';
      setCameraError(message);
      onError(message);
      setIsLoading(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'This browser does not support direct camera access. Use the device camera option below instead.';
      setCameraError(message);
      onError(message);
      setIsLoading(false);
      return;
    }

    try {
      // Ask for the rear camera first. If the device cannot satisfy ideal
      // resolution/facing constraints, retry with a browser-selected camera.
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
        if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') {
          throw firstError;
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      stopCamera();
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraError(null);
    } catch (error) {
      console.error('Camera access failed:', error);
      const name = error instanceof Error ? error.name : '';
      let message = 'The camera could not be opened. Check that no other app is using it, then try again.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        message = 'Camera permission is blocked. Allow Camera access for this website in your browser or device settings, then tap Try Again. You can also use the device camera option below.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        message = 'No camera was found on this device. You can still choose a photo using the device camera option.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        message = 'The camera is busy or unavailable. Close other apps using the camera and try again.';
      } else if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        message = 'The requested camera is not available. Try the device camera option instead.';
      }
      setCameraError(message);
      onError(message);
    } finally {
      setIsLoading(false);
    }
  }, [onError, stopCamera]);

  React.useEffect(() => {
    if (!stream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = stream;
    void video.play().catch(error => {
      console.warn('Camera preview could not autoplay:', error);
    });
    return () => {
      stream.getTracks().forEach(track => track.stop());
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  React.useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      const message = 'The camera is still starting. Please wait a moment and try again.';
      setCameraError(message);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      const message = 'Could not process the camera image. Please try again.';
      setCameraError(message);
      onError(message);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.88));
    stopCamera();
  };

  const handleConfirm = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      onCapture(new File([blob], `guest-camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    } catch {
      const message = 'Failed to process the captured photo. Please retake it.';
      setCameraError(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFallbackFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onCapture(file);
    event.target.value = '';
  };

  const handleCancel = () => {
    stopCamera();
    onCancel?.();
  };

  return (
    <div className="space-y-4">
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFallbackFile}
        aria-label="Take a photo with this device"
      />

      {!hasStarted && (
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
          <div className="space-y-3 text-center">
            <Camera className="mx-auto h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Camera ready to start</p>
          </div>
        </div>
      )}

      {hasStarted && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          {capturedImage ? (
            <img src={capturedImage} alt="Captured guest" className="h-full w-full object-contain" />
          ) : (
            <>
              {isLoading && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
              {stream && <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />}
              {!stream && !isLoading && <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">Camera preview is unavailable. Use one of the options below.</div>}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {cameraError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {cameraError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>}
        {!hasStarted && (
          <Button type="button" onClick={() => void startCamera()} className="w-full sm:w-auto">
            <Camera className="mr-2 h-4 w-4" /> Allow Camera & Start
          </Button>
        )}
        {hasStarted && !capturedImage && (
          <>
            <Button type="button" variant="outline" onClick={() => fallbackInputRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Use Device Camera
            </Button>
            {cameraError ? (
              <Button type="button" onClick={() => void startCamera()} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Try Again
              </Button>
            ) : (
              <Button type="button" onClick={handleCapture} disabled={isLoading || !stream}>
                <Camera className="mr-2 h-4 w-4" /> Capture Photo
              </Button>
            )}
          </>
        )}
        {capturedImage && (
          <>
            <Button type="button" variant="outline" onClick={() => { setCapturedImage(null); void startCamera(); }}>Retake</Button>
            <Button type="button" onClick={() => void handleConfirm()} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Use Photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
