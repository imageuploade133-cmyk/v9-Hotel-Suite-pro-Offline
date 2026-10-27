'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface DraggableButtonProps {
  id: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  title?: string;
  defaultPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | { x: number; y: number };
}

export function DraggableButton({
  id,
  children,
  onClick,
  className,
  variant = 'outline',
  size = 'icon',
  title,
  defaultPosition = 'top-right',
}: DraggableButtonProps) {
  const [isClient, setIsClient] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 20, y: 80 });

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const calculateDefaultPosition = React.useCallback(() => {
    if (typeof window === 'undefined') return { x: 20, y: 80 };

    const buttonWidth = 48;
    const buttonHeight = 48;
    const margin = 20;
    const headerHeight = 64;

    if (typeof defaultPosition === 'object') {
      return defaultPosition;
    }

    switch (defaultPosition) {
      case 'top-right':
        return { x: window.innerWidth - buttonWidth - margin, y: headerHeight + margin };
      case 'top-left':
        return { x: margin, y: headerHeight + margin };
      case 'bottom-right':
        return { x: window.innerWidth - buttonWidth - margin, y: window.innerHeight - buttonHeight - margin };
      case 'bottom-left':
        return { x: margin, y: window.innerHeight - buttonHeight - margin };
      default:
        return { x: 20, y: 80 };
    }
  }, [defaultPosition]);

  React.useEffect(() => {
    setIsClient(true);

    const saved = localStorage.getItem(`draggable-btn-${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
        setHasInteracted(true);
      } catch {
        setPosition(calculateDefaultPosition());
      }
    } else {
      setPosition(calculateDefaultPosition());
    }
  }, [id, calculateDefaultPosition]);

  React.useEffect(() => {
    if (!isClient) return;

    const handleResize = () => {
      if (!hasInteracted) {
        setPosition(calculateDefaultPosition());
      } else {
        // Ensure button stays within viewport after resize
        const buttonWidth = buttonRef.current?.offsetWidth || 48;
        const buttonHeight = buttonRef.current?.offsetHeight || 48;
        setPosition(prev => ({
          x: Math.min(prev.x, window.innerWidth - buttonWidth),
          y: Math.min(prev.y, window.innerHeight - buttonHeight),
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isClient, hasInteracted, calculateDefaultPosition]);

  React.useEffect(() => {
    if (isClient && hasInteracted) {
      localStorage.setItem(`draggable-btn-${id}`, JSON.stringify(position));
    }
  }, [position, id, isClient, hasInteracted]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    setHasInteracted(true);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!buttonRef.current || !e.touches[0]) return;

    const touch = e.touches[0];
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
    setHasInteracted(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const maxX = window.innerWidth - (buttonRef.current?.offsetWidth || 48);
      const maxY = window.innerHeight - (buttonRef.current?.offsetHeight || 48);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const touch = e.touches[0];

      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;

      const maxX = window.innerWidth - (buttonRef.current?.offsetWidth || 48);
      const maxY = window.innerHeight - (buttonRef.current?.offsetHeight || 48);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && onClick) {
      onClick();
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      variant={variant}
      size={size}
      className={cn(
        'fixed z-[100] shadow-lg cursor-grab select-none touch-none transition-shadow',
        isDragging && 'cursor-grabbing scale-110 shadow-xl',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      title={title}
    >
      {children}
    </Button>
  );
}
