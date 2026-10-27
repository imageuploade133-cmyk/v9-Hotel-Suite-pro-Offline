
import * as React from 'react';
import * as icons from 'lucide-react';
import {createElement} from 'react';
import { cn } from '@/lib/utils';

type DynamicIconProps = {
  iconName: string;
  className?: string;
  style?: React.CSSProperties;
};

export const toPascalCase = (str: string) => {
  if (!str || typeof str !== 'string') return 'HelpCircle';
  // Replace all non-alphanumeric characters with a space
  const sanitized = str.replace(/[^a-zA-Z0-9 ]/g, ' ');
  return sanitized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export const DynamicIcon = ({ iconName, className, style }: DynamicIconProps) => {
  const iconKey = toPascalCase(iconName) as keyof typeof icons;
  const IconComponent = icons[iconKey];

  if (!IconComponent) {
    return <icons.HelpCircle className={className} style={style} />;
  }

  return createElement(IconComponent, { className, style });
};
