import React from 'react';
import { Phone } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface DialButtonProps {
  phoneNumber?: string;
  className?: string;
}

export const DialButton: React.FC<DialButtonProps> = ({ phoneNumber, className }) => {
  const { theme } = useTheme();

  if (!phoneNumber) return null;

  // Clean the number: Keep only digits and the leading +
  const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');

  return (
    <a
      href={`tel:${cleanNumber}`}
      title={`Call ${phoneNumber}`}
      onClick={(e) => e.stopPropagation()} // Prevent parent click events (like card navigation)
      className={cn(
        "w-11 h-11 rounded-full transition-all duration-200 flex items-center justify-center shrink-0", // Fixed 44px size
        // Theme-aware default state
        theme === 'light' 
          ? 'text-slate-400 hover:bg-green-100 hover:text-green-600' 
          : 'text-white/40 hover:bg-green-500/20 hover:text-green-400',
        className
      )}
    >
      <Phone size={18} />
    </a>
  );
};