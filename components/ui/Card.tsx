import React, { useRef, useState } from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  noPadding,
  onMouseMove: externalOnMouseMove,
  onMouseLeave: externalOnMouseLeave,
  style: externalStyle,
  ...props
}) => {
  const { getGlassClass, getTextColor, theme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const [glowPos, setGlowPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setGlowPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    externalOnMouseMove?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setGlowPos(null);
    externalOnMouseLeave?.(e);
  };

  const glowColor = theme === 'ocean'
    ? 'rgba(59,130,246,0.10)'
    : theme === 'dark'
      ? 'rgba(99,102,241,0.12)'
      : 'rgba(99,102,241,0.07)';

  const glowStyle: React.CSSProperties = glowPos
    ? { backgroundImage: `radial-gradient(circle 280px at ${glowPos.x}px ${glowPos.y}px, ${glowColor}, transparent)` }
    : {};

  return (
    <div
      ref={cardRef}
      className={cn(
        'transition-all duration-300',
        getGlassClass(),
        getTextColor(),
        !noPadding && 'p-6 md:p-8',
        className
      )}
      style={{ ...glowStyle, ...externalStyle }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  );
};
