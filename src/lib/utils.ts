
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD') {
  if (isNaN(amount)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
