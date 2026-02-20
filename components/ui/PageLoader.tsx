
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

export const PageLoader = () => {
  const { theme } = useTheme();
  
  return (
    <div className={cn(
      "min-h-[60vh] w-full flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300",
      theme === 'light' ? "text-slate-400" : "text-slate-500"
    )}>
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <p className="text-sm font-medium opacity-70 tracking-wide">Loading...</p>
    </div>
  );
};
