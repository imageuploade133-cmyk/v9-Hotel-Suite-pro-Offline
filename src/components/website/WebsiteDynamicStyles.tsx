
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

const defaultTheme = {
    primary: '#111111',
    'accent-gold': '#C5A059',
    ivory: '#F9F9F7',
    charcoal: '#1A1A1A',
    'background-light': '#FFFFFF',
    'background-dark': '#0A0A0A',
};

const defaultBranding = {
    'display-font': 'Poppins',
    'body-font': 'Nunito Sans',
};

export function WebsiteDynamicStyles() {
  const firestore = useFirestore();
  const settingsDocRef = React.useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'global');
  }, [firestore]);
  const { data: settings, isLoading } = useDoc<any>(settingsDocRef);

  const themeVariables = React.useMemo(() => {
    if (isLoading) return '';

    const theme = settings?.websiteData?.theme || {};
    const branding = settings?.websiteData?.branding || {};
    const mergedTheme = { ...defaultTheme, ...theme };
    const mergedBranding = { ...defaultBranding, ...branding };

    const colorStyles = Object.entries(mergedTheme)
        .map(([key, value]) => {
          if (!value) return null;
          const hslValue = String(value).includes('#') ? hexToHsl(String(value)) : value;
          return `--website-${key}: ${hslValue};`;
        })
        .filter(Boolean)
        .join('\n');

    const fontStyles = Object.entries(mergedBranding)
        .map(([key, value]) => {
          if (!value) return null;
          // Font family names can have spaces, so they need to be quoted if necessary.
          const fontValue = String(value).includes(' ') ? `"${value}"` : value;
          return `--website-${key.replace('Font', '-font')}: ${fontValue};`;
        })
        .filter(Boolean)
        .join('\n');

    return `
      :root {
        ${colorStyles}
        ${fontStyles}
      }
    `;
  }, [settings, isLoading]);

  return <style dangerouslySetInnerHTML={{ __html: themeVariables }} />;
}
