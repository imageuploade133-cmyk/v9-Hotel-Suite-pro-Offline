
'use client';

import * as icons from 'lucide-react';
import { createElement } from 'react';

const toPascalCase = (str: string) => {
  if (!str) return 'HelpCircle';
  return str.replace(/(^\w|-\w|\s\w)/g, (text) => text.replace(/[-_\s]/, "").toUpperCase());
};

export const getLucideIcon = (name: string) => {
  const iconKey = toPascalCase(name) as keyof typeof icons;
  return icons[iconKey] || icons.HelpCircle;
};
