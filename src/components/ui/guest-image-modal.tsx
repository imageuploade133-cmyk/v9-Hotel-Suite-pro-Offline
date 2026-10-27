'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';

interface GuestImageModalProps {
  isOpen: boolean;
  images: string[];
  initialIndex?: number;
  altText: string;
  onClose: () => void;
}

export const GuestImageModal: React.FC<GuestImageModalProps> = ({
  isOpen,
  images,
  initialIndex = 0,
  altText,
  onClose,
}) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const totalImages = images.length;
  const imageUrl = images[currentIndex];
  const canNavigate = totalImages > 1;

  const formattedAltText = useMemo(() => {
    if (!canNavigate) return altText;
    return `${altText} (${currentIndex + 1} of ${totalImages})`;
  }, [altText, canNavigate, currentIndex, totalImages]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (!canNavigate) return;
      if (event.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev + 1) % totalImages);
      }
      if (event.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev - 1 + totalImages) % totalImages);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, canNavigate, totalImages]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsImageLoaded(false);
      setHasError(false);
    }
  }, [isOpen, initialIndex, images]);

  useEffect(() => {
    setIsImageLoaded(false);
    setHasError(false);
  }, [currentIndex]);

  const handlePrevious = () => {
    if (!canNavigate) return;
    setCurrentIndex(prev => (prev - 1 + totalImages) % totalImages);
  };

  const handleNext = () => {
    if (!canNavigate) return;
    setCurrentIndex(prev => (prev + 1) % totalImages);
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[90vh] p-4 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-2 right-4 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Close modal"
        >
          <X className="h-6 w-6" />
        </button>

        {canNavigate && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="View previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="View next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {!isImageLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-12 w-12 animate-spin" />
          </div>
        )}

        {hasError || !imageUrl ? (
          <div className="flex flex-col items-center justify-center p-12 text-white bg-zinc-900/50 rounded-lg border border-white/10">
            <ImageOff className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Image not available</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={formattedAltText}
            onLoad={() => setIsImageLoaded(true)}
            onError={() => {
              setIsImageLoaded(true);
              setHasError(true);
            }}
            className={`
              max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl
              transition-opacity duration-500 ease-in-out
              ${isImageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
          />
        )}

        {isImageLoaded && !hasError && (
          <div className="mt-4 space-y-3 text-center">
            <p className="text-white text-lg font-medium drop-shadow-md">
              {formattedAltText}
            </p>
            {canNavigate && (
              <div className="flex flex-wrap justify-center gap-2">
                {images.slice(0, 8).map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    onClick={() => setCurrentIndex(index)}
                    className={`relative h-12 w-12 overflow-hidden rounded-md border transition focus:outline-none focus:ring-2 focus:ring-white ${
                      currentIndex === index
                        ? 'border-white'
                        : 'border-white/30 hover:border-white/60'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img
                      src={url}
                      alt={`${altText} thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
                {totalImages > 8 && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-white/30 text-xs text-white/80">
                    +{totalImages - 8}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
