import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';
import { useCountUp } from '../../hooks/useCountUp';

interface RadialGaugeProps {
  value: number;       // 0-100 percentage
  label: string;
  subtext?: string;
  colorFrom?: string;
  colorTo?: string;
  onClick?: () => void;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  value, label, subtext,
  colorFrom = '#f59e0b', colorTo = '#10b981',
  onClick,
}) => {
  const { theme, getTextColor, getCardBg } = useTheme();
  const animated = useCountUp(Math.round(value * 10), 1200);
  const displayValue = (animated / 10).toFixed(1);

  const size = 72;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Only fill 270° of the circle (3/4 arc), starting from bottom-left
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const filled = arcLength * (Math.min(value, 100) / 100);

  // Rotation so arc starts from bottom-left (-225deg = 135deg clockwise from top = bottom-left start)
  const rotation = 135;

  const gradId = `rg-grad-${label.replace(/\s/g, '')}`;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 md:p-5 rounded-2xl border transition-all duration-300 group cursor-pointer relative overflow-hidden',
        'hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]',
        getCardBg(),
        theme === 'light' ? 'border-slate-100 shadow-sm' : ''
      )}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-amber-400 to-emerald-400" />
      {/* Corner glow */}
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-amber-400 pointer-events-none" />

      <div className="flex items-center gap-3">
        {/* Gauge SVG */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={colorFrom} />
                <stop offset="100%" stopColor={colorTo} />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
            />
            {/* Fill */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.25,0.46,0.45,0.94)' }}
            />
          </svg>
          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: `rotate(-${rotation}deg)` }}>
            <span className={cn("text-base font-bold tabular-nums leading-none", getTextColor())}>{displayValue}%</span>
          </div>
        </div>

        {/* Label */}
        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-0.5", getTextColor())}>{label}</p>
          {subtext && <p className={cn("text-[9px] md:text-[10px] opacity-50", getTextColor())}>{subtext}</p>}
        </div>
      </div>
    </div>
  );
};
