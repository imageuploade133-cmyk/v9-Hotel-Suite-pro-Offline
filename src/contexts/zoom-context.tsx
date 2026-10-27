'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ZoomContextType {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

const MIN_ZOOM = 0;
const MAX_ZOOM = 200;
const STEP = 10;
const DEFAULT_ZOOM = 100;
const STORAGE_KEY = 'app-zoom-level';

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [mounted, setMounted] = useState(false);

  // Load zoom level from localStorage on mount and setup keyboard shortcuts
  useEffect(() => {
    const savedZoom = localStorage.getItem(STORAGE_KEY);
    if (savedZoom) {
      const zoom = parseInt(savedZoom, 10);
      if (zoom >= MIN_ZOOM && zoom <= MAX_ZOOM) {
        setZoomLevel(zoom);
        applyZoom(zoom);
      }
    }
    setMounted(true);

    // Add keyboard shortcuts for zoom
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Plus or Ctrl/Cmd + Equals for zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setZoomLevel((prev) => {
          const newZoom = Math.min(prev + STEP, MAX_ZOOM);
          localStorage.setItem(STORAGE_KEY, String(newZoom));
          applyZoom(newZoom);
          return newZoom;
        });
      }
      // Ctrl/Cmd + Minus for zoom out
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoomLevel((prev) => {
          const newZoom = Math.max(prev - STEP, MIN_ZOOM);
          localStorage.setItem(STORAGE_KEY, String(newZoom));
          applyZoom(newZoom);
          return newZoom;
        });
      }
      // Ctrl/Cmd + 0 for reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        localStorage.setItem(STORAGE_KEY, String(DEFAULT_ZOOM));
        applyZoom(DEFAULT_ZOOM);
        setZoomLevel(DEFAULT_ZOOM);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applyZoom = (zoom: number) => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${(zoom / 100) * 16}px`;
    }
  };

  const zoomIn = () => {
    setZoomLevel((prev) => {
      const newZoom = Math.min(prev + STEP, MAX_ZOOM);
      localStorage.setItem(STORAGE_KEY, String(newZoom));
      applyZoom(newZoom);
      return newZoom;
    });
  };

  const zoomOut = () => {
    setZoomLevel((prev) => {
      const newZoom = Math.max(prev - STEP, MIN_ZOOM);
      localStorage.setItem(STORAGE_KEY, String(newZoom));
      applyZoom(newZoom);
      return newZoom;
    });
  };

  const resetZoom = () => {
    localStorage.setItem(STORAGE_KEY, String(DEFAULT_ZOOM));
    applyZoom(DEFAULT_ZOOM);
    setZoomLevel(DEFAULT_ZOOM);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ZoomContext.Provider value={{ zoomLevel, zoomIn, zoomOut, resetZoom }}>
      {children}
    </ZoomContext.Provider>
  );
}

export function useZoom() {
  const context = useContext(ZoomContext);
  if (context === undefined) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
}
