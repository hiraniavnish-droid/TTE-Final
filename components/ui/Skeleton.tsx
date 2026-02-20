
import React from 'react';
import { cn } from '../../utils/helpers';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div 
      className={cn(
        "bg-slate-100 animate-pulse rounded-xl border border-slate-200", 
        className
      )} 
    />
  );
};
