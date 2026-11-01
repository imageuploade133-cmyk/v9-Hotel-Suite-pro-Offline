'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Load the saved zoom level and keep keyboard shortcuts in sync with the current page.
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
  }, [pathname]);

  const applyZoom = (zoom: number) => {
    if (typeof document !== 'undefined') {
      const scale = Math.max(zoom / 100, 0.2);

      // On the login page, leave the document and slideshow at their natural size.
      // The login form reads zoomLevel and applies the scale only to its own content.
      if (isLoginPage) {
        document.documentElement.style.setProperty('--zoom-scale', '1');
        (document.documentElement.style as any).zoom = '1';
        (document.body.style as any).zoom = '1';
        document.documentElement.style.transform = '';
        document.documentElement.style.transformOrigin = '';
        document.documentElement.style.width = '';
        document.body.style.width = '';
        document.body.style.minHeight = '';
        return;
      }

      // Reset explicit inline style dimensions to allow fluid CSS layout reflow
      document.body.style.width = '';
      document.body.style.minHeight = '';

      // Set CSS custom property so calculations like calc(100vh / var(--zoom-scale)) and calc(16px * var(--zoom-scale)) work accurately
      document.documentElement.style.setProperty('--zoom-scale', String(scale));

      // Apply zoom to documentElement and body so text, font size, layouts, and cards scale cohesively
      if ('zoom' in document.documentElement.style || (document.documentElement.style as any).zoom !== undefined) {
        (document.documentElement.style as any).zoom = String(scale);
        (document.body.style as any).zoom = String(scale);
      } else {
        // Fallback for browsers that don't support CSS zoom property
        const rootStyle = document.documentElement.style as CSSStyleDeclaration;
        rootStyle.transform = `scale(${scale})`;
        rootStyle.transformOrigin = 'top left';
        rootStyle.width = `${100 / scale}%`;
      }
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

  // Keep the context available during server rendering and hydration.
  // The default 100% value is safe until the saved preference loads in the effect.
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
