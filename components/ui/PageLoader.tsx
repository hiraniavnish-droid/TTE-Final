
import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

export const PageLoader = () => {
  const { theme } = useTheme();

  const bg = theme === 'ocean'
    ? 'bg-[#0a1628]'
    : theme === 'dark'
    ? 'bg-[#0f1117]'
    : 'bg-[#F8FAFC]';

  const cardBg = theme === 'light'
    ? 'bg-white border-slate-200 shadow-xl shadow-slate-200/60'
    : theme === 'ocean'
    ? 'bg-blue-900/40 border-blue-700/40 shadow-2xl shadow-black/40'
    : 'bg-slate-800/80 border-slate-700/50 shadow-2xl shadow-black/40';

  const trackBg = theme === 'light' ? 'bg-slate-100' : 'bg-white/10';
  const labelColor = theme === 'light' ? 'text-slate-400' : 'text-slate-500';
  const dotBase = theme === 'light' ? 'bg-indigo-400' : 'bg-indigo-400';

  return (
    <div className={cn('fixed inset-0 z-[9999] flex flex-col items-center justify-center', bg)}>
      {/* Card */}
      <div className={cn('flex flex-col items-center gap-6 px-10 py-9 rounded-3xl border', cardBg)}>

        {/* Logo mark */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            {/* Plane icon SVG */}
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
            </svg>
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-indigo-500" />
        </div>

        {/* App name */}
        <div className="text-center">
          <p className={cn('text-xs font-bold uppercase tracking-[0.2em]', labelColor)}>
            The Tourism Experts
          </p>
        </div>

        {/* Animated dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={cn('w-2 h-2 rounded-full', dotBase)}
              style={{
                animation: `loaderDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Thin progress bar */}
        <div className={cn('w-36 h-0.5 rounded-full overflow-hidden', trackBg)}>
          <div
            className="h-full rounded-full nav-progress-shimmer"
            style={{ width: '60%', animation: 'topBarShimmer 1.5s ease-in-out infinite, topBarSlide 2s ease-in-out infinite alternate' }}
          />
        </div>
      </div>
    </div>
  );
};

// Thin top bar shown during in-app navigation (used by Layout)
export const NavigationBar = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] overflow-hidden pointer-events-none">
      <div className="nav-progress-bar nav-progress-shimmer h-full w-full" />
    </div>
  );
};
