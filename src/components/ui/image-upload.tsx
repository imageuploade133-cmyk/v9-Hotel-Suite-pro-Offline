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

// Simplified Camera Capture Component
interface SimpleCameraCaptureProps {
  onCapture: (file: File) => void;
  onError: (error: string) => void;
}

function SimpleCameraCapture({ onCapture, onError }: SimpleCameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasStarted, setHasStarted] = React.useState(false);

  const startCamera = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setHasStarted(true);
    } catch (err) {
      console.error("Error accessing camera: ", err);
      let message = 'Could not access the camera. Please ensure you have given permission in your browser settings.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          message = 'Camera access was denied. Please enable it in your browser settings.';
        } else if (err.name === 'NotFoundError') {
          message = 'No camera found on this device.';
        }
      }
      onError(message);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const stopCamera = React.useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
  }, [stream]);

  React.useEffect(() => {
    // Only start camera when user explicitly wants to use it
    if (!hasStarted) {
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [hasStarted]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        })
        .catch(() => onError('Failed to process captured image'));
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setHasStarted(true);
  };

  // If camera hasn't started yet, show a start button
  if (!hasStarted) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
          <div className="text-center space-y-4">
            <Camera className="h-16 w-16 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Camera ready to start</p>
          </div>
        </div>
        <div className="flex justify-center">
          <Button onClick={() => setHasStarted(true)} className="w-full">
            <Camera className="mr-2 h-4 w-4" />
            Start Camera
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="h-full w-full object-cover" />
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              style={{ display: isLoading ? 'none' : 'block' }}
            />
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="flex justify-center gap-2">
        {capturedImage ? (
          <>
            <Button variant="outline" onClick={handleRetake}>
              Retake
            </Button>
            <Button onClick={handleConfirm}>
              Use Photo
            </Button>
          </>
        ) : (
          <Button
            onClick={handleCapture}
            disabled={isLoading || !stream}
            className="w-full"
          >
            <Camera className="mr-2 h-4 w-4" />
            Capture Photo
          </Button>
        )}
      </div>
    </div>
  );
}