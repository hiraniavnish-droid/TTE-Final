import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';
interface CardProps extends React.HTMLAttributes<HTMLDivElement> { children: React.ReactNode; noPadding?: boolean; }
export const Card: React.FC<CardProps> = ({ children, className, noPadding, ...props }) => {
  const { getGlassClass, getTextColor } = useTheme();
  return <div className={cn('crm-card min-w-0', getGlassClass(), getTextColor(), !noPadding && 'p-4 sm:p-5 lg:p-6', className)} {...props}>{children}</div>;
};
