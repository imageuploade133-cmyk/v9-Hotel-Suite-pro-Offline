'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface AutoFitTextProps {
  children: React.ReactNode;
  className?: string;
  maxFontSize?: number;
  minFontSize?: number;
}

/**
 * Keeps a single-line value inside its available width by measuring the actual
 * rendered text and reducing its font size only when necessary.
 */
export function AutoFitText({
  children,
  className,
  maxFontSize = 24,
  minFontSize = 7,
}: AutoFitTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = React.useState(maxFontSize);

  const textValue = typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : null;

  React.useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text || textValue === null) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const availableWidth = container.clientWidth;
        if (!availableWidth) return;

        const styles = window.getComputedStyle(text);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        const fontWeight = styles.fontWeight || '700';
        const fontFamily = styles.fontFamily || 'sans-serif';
        const letterSpacing = Number.parseFloat(styles.letterSpacing) || 0;
        const measureAt = (size: number) => {
          context.font = `${fontWeight} ${size}px ${fontFamily}`;
          return context.measureText(textValue).width +
            Math.max(0, textValue.length - 1) * letterSpacing;
        };

        let low = minFontSize;
        let high = maxFontSize;
        let best = minFontSize;

        if (measureAt(maxFontSize) <= availableWidth) {
          best = maxFontSize;
        } else {
          for (let i = 0; i < 16; i += 1) {
            const middle = (low + high) / 2;
            if (measureAt(middle) <= availableWidth) {
              best = middle;
              low = middle;
            } else {
              high = middle;
            }
          }
          // If an exceptionally long value still cannot fit at the preferred
          // minimum, scale further rather than clipping or hiding its digits.
          if (measureAt(best) > availableWidth) {
            best = Math.max(4, minFontSize * availableWidth / measureAt(minFontSize));
          }
        }

        setFontSize(current => Math.abs(current - best) > 0.2 ? best : current);
      });
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    observer?.observe(container);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [textValue, maxFontSize, minFontSize]);

  if (textValue === null) {
    return <div className={cn('min-w-0 w-full', className)}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={cn('min-w-0 w-full overflow-hidden', className)}>
      <span
        ref={textRef}
        className="block w-full whitespace-nowrap font-bold leading-tight tabular-nums"
        style={{ fontSize: `${fontSize}px` }}
        title={textValue}
      >
        {children}
      </span>
    </div>
  );
}
