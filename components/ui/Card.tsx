import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, noPadding, ...props }) => {
  const { getGlassClass, getTextColor } = useTheme();

  return (
    <div 
      className={cn(
        'transition-all duration-300',
        getGlassClass(), // Pulls the "Swiss Minimalist" shadow ring
        getTextColor(),
        !noPadding && 'p-6 md:p-8',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};