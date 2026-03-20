
import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}) => {
  const { theme } = useTheme();
  
  const variants = {
    // Primary: Indigo → Blue gradient with glow
    primary: theme === 'light'
        ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:from-indigo-500 hover:to-blue-400 shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 border border-transparent'
        : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white shadow-md shadow-indigo-500/30',

    // Secondary: Clean outlined with colored border
    secondary: theme === 'light'
        ? 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm'
        : theme === 'ocean'
          ? 'bg-blue-900/50 border border-blue-700/50 text-blue-100 hover:bg-blue-800/60 hover:border-blue-600/60'
          : 'bg-slate-700/80 border border-slate-600/70 text-slate-200 hover:bg-slate-600/80 hover:border-slate-500',

    danger: 'bg-gradient-to-r from-red-600 to-rose-500 text-white hover:from-red-500 hover:to-rose-400 shadow-sm shadow-red-500/20',

    ghost: theme === 'light'
        ? 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        : theme === 'ocean'
          ? 'bg-transparent text-blue-100/70 hover:bg-blue-800/40 hover:text-blue-100'
          : 'bg-transparent text-slate-400 hover:bg-slate-700/60 hover:text-slate-100'
  };

  const sizes = {
    sm: 'px-3 h-8 text-xs font-medium',
    md: 'px-3 h-9 text-sm md:px-5 md:h-10 font-semibold', // Responsive: Compact on Mobile, Standard on Desktop
    lg: 'px-6 h-12 text-base font-semibold'
  };

  return (
    <button 
      className={cn(
        'rounded-lg transition-all duration-200 ease-out flex items-center justify-center gap-2',
        // Interaction: Tactile click only, no bouncy hover
        'active:scale-95',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
};
