import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  const { theme } = useTheme();
  return (
    <div className={cn(
      'animate-pulse rounded-lg',
      theme === 'light' ? 'bg-slate-200/80' : theme === 'ocean' ? 'bg-blue-800/30' : 'bg-slate-700/50',
      className
    )} />
  );
};

export const KPISkeleton: React.FC = () => {
  const { theme } = useTheme();
  const base = theme === 'light' ? 'bg-slate-200/80' : theme === 'ocean' ? 'bg-blue-800/30' : 'bg-slate-700/50';
  return (
    <div className={cn(
      'p-4 md:p-5 rounded-xl border animate-pulse',
      theme === 'light' ? 'bg-white border-slate-200' : theme === 'ocean' ? 'bg-blue-950/70 border-blue-700/40' : 'bg-slate-800/90 border-slate-700/60'
    )}>
      <div className={cn('h-1 w-full rounded-t-xl mb-3', base)} />
      <div className={cn('h-7 w-7 rounded-lg mb-3', base)} />
      <div className={cn('h-3 w-16 rounded mb-2', base)} />
      <div className={cn('h-7 w-24 rounded mb-2', base)} />
      <div className={cn('h-2 w-20 rounded', base)} />
    </div>
  );
};

export const CardSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  const { theme } = useTheme();
  const base = theme === 'light' ? 'bg-slate-200/80' : theme === 'ocean' ? 'bg-blue-800/30' : 'bg-slate-700/50';
  return (
    <div className={cn(
      'p-6 rounded-xl border animate-pulse',
      theme === 'light' ? 'bg-white border-slate-200' : theme === 'ocean' ? 'bg-blue-950/70 border-blue-700/40' : 'bg-slate-800/90 border-slate-700/60'
    )}>
      <div className={cn('h-4 w-1/3 rounded mb-6', base)} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-3">
          <div className={cn('w-8 h-8 rounded-full shrink-0', base)} />
          <div className="flex-1 space-y-1.5">
            <div className={cn('h-3 rounded w-3/4', base)} />
            <div className={cn('h-2.5 rounded w-1/2', base)} />
          </div>
        </div>
      ))}
    </div>
  );
};
