
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function formatDate(dateStr: string) {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString(undefined, options);
}

export function formatCurrency(amount: number) {
  if (!amount || amount === 0) return 'TBD';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatCompactCurrency(amount: number) {
  if (!amount || amount === 0) return '';
  if (amount >= 10000000) return `₹ ${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹ ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹ ${(amount / 1000).toFixed(0)}k`;
  return `₹ ${amount}`;
}

export function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr); // Fallback to date
}

// --- SHARED ROOM LOGIC ---
export const useRoomCalculator = (totalPax: number, roomCapacity: number) => {
    return Math.ceil(totalPax / roomCapacity);
};
