import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', type, ...props }) => {
  const { theme } = useTheme();
  const light = theme === 'light';
  const variants = {
    primary: 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 hover:border-blue-700 shadow-sm',
    secondary: light ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300' : 'bg-slate-800 text-slate-100 border border-slate-600 hover:bg-slate-700',
    danger: 'bg-red-600 text-white border border-red-600 hover:bg-red-700',
    ghost: light ? 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100' : 'bg-transparent text-slate-300 border border-transparent hover:bg-white/10',
  };
  const sizes = { sm: 'px-3 min-h-10 text-xs', md: 'px-4 min-h-[44px] text-sm', lg: 'px-5 min-h-12 text-sm' };
  return <button type={type} className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2', variants[variant], sizes[size], className)} {...props}/>;
};
