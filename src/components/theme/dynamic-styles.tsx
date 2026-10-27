
'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

const hexToHsl = (hex: string): string => {
  if (!hex || !hex.startsWith('#')) return '0 0% 0%';

  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};


export function DynamicStyles() {
  const firestore = useFirestore();
  const settingsDocRef = React.useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'global');
  }, [firestore]);
  const { data: settings, isLoading } = useDoc<any>(settingsDocRef);

  const themeVariables = React.useMemo(() => {
    if (isLoading) return '';

    const theme = settings?.theme || {};

    const generateCssVariables = (themeConfig: any, defaults: any) => {
        const mergedConfig = { ...defaults, ...themeConfig };
        return Object.entries(mergedConfig)
        .map(([key, value]) => {
          if (!value) return null;
          const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          const hslValue = String(value).includes('#') ? hexToHsl(String(value)) : value;
          return `--${cssVarName}: ${hslValue};`;
        })
        .filter(Boolean)
        .join('\n');
    };

    const defaultTheme = {
        light: {
            background: '0 0% 100%',
            foreground: '222.2 84% 4.9%',
            card: '0 0% 100%',
            cardForeground: '222.2 84% 4.9%',
            popover: '0 0% 100%',
            popoverForeground: '222.2 84% 4.9%',
            primary: '221 83% 53%',
            primaryForeground: '210 40% 98%',
            secondary: '210 40% 96.1%',
            secondaryForeground: '222.2 47.4% 11.2%',
            muted: '210 40% 96.1%',
            mutedForeground: '215.4 16.3% 46.9%',
            accent: '173 97% 39%',
            accentForeground: '210 40% 98%',
            destructive: '0 84.2% 60.2%',
            destructiveForeground: '210 40% 98%',
            success: '142.1 76.2% 36.3%',
            successForeground: '210 40% 98%',
            border: '214.3 31.8% 91.4%',
            input: '214.3 31.8% 91.4%',
            ring: '221 83% 53%',
        },
        dark: {
            background: '222 47% 11%',
            foreground: '210 40% 98%',
            card: '217 33% 17%',
            cardForeground: '210 40% 98%',
            popover: '222 47% 11%',
            popoverForeground: '210 40% 98%',
            primary: '217 91% 60%',
            primaryForeground: '222 47% 11%',
            secondary: '217 33% 17%',
            secondaryForeground: '210 40% 98%',
            muted: '217 33% 17%',
            mutedForeground: '215 20% 65%',
            accent: '173 97% 45%',
            accentForeground: '222 47% 11%',
            destructive: '0 63% 31%',
            destructiveForeground: '210 40% 98%',
            success: '142.1 70.6% 45.3%',
            successForeground: '210 40% 98%',
            border: '217 33% 27%',
            input: '217 33% 27%',
            ring: '217 91% 60%',
        }
    };

    const lightStyles = generateCssVariables(theme.light, defaultTheme.light);
    const darkStyles = generateCssVariables(theme.dark, defaultTheme.dark);

    return `
      :root {
        ${lightStyles}
      }
      .dark {
        ${darkStyles}
      }
    `;
  }, [settings, isLoading]);

  return <style dangerouslySetInnerHTML={{ __html: themeVariables }} />;
}

