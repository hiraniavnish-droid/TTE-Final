
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
    // Primary: Solid Slate-900 (Enterprise)
    primary: theme === 'light'
        ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm border border-transparent'
        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md',
    
    // Secondary: Clean White with Border
    secondary: theme === 'light'
        ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm'
        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
    
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    
    ghost: theme === 'light' 
        ? 'bg-transparent text-slate-600 hover:bg-slate-100'
        : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
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
