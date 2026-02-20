
import React from 'react';
import { cn } from '../../utils/helpers';

interface SparklineProps {
  data?: number[];
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate' | 'purple' | 'indigo' | 'cyan';
  className?: string;
  height?: number;
  width?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ 
  data = [10, 15, 12, 20, 18, 25, 22, 30], 
  color = 'slate',
  className,
  height = 30,
  width = 80
}) => {
  // Generate path data
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const colors: Record<string, string> = {
    emerald: 'stroke-emerald-500',
    blue: 'stroke-blue-500',
    amber: 'stroke-amber-500',
    rose: 'stroke-rose-500',
    slate: 'stroke-slate-400',
    purple: 'stroke-purple-500',
    indigo: 'stroke-indigo-500',
    cyan: 'stroke-cyan-500',
  };

  // Safe fallback if color key doesn't exist
  const strokeColor = colors[color] || colors.slate;
  const fillColor = strokeColor.replace('stroke-', 'text-');

  return (
    <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`} 
        className={cn("overflow-visible", className)}
    >
        <polyline
            points={points}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={strokeColor}
        />
        {/* End dot */}
        <circle 
            cx={width} 
            cy={height - ((data[data.length - 1] - min) / range) * height} 
            r="2" 
            className={cn("fill-current", fillColor)} 
        />
    </svg>
  );
};
