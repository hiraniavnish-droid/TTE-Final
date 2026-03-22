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
    <button
      type="button"
      title={`Call ${phoneNumber}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        window.location.href = `tel:${cleanNumber}`;
      }}
      className={cn(
        "w-11 h-11 rounded-full transition-all duration-200 flex items-center justify-center shrink-0",
        theme === 'light'
          ? 'text-slate-400 hover:bg-green-100 hover:text-green-600'
          : 'text-white/40 hover:bg-green-500/20 hover:text-green-400',
        className
      )}
    >
      <Phone size={18} />
    </button>
  );
};