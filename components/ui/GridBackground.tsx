import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface GridBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({ children, className }) => {
  const { theme } = useTheme();

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden", className)}>

        {/* Light Mode: dot-grid on white */}
        {theme === 'light' && (
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#F8FAFC]">
                <div
                    className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)'
                    }}
                />
            </div>
        )}

        {/* Dark Mode: deep slate with subtle noise */}
        {theme === 'dark' && (
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#0f1117]">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'radial-gradient(#818cf8 1px, transparent 1px)',
                        backgroundSize: '28px 28px',
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-transparent to-slate-950/50" />
            </div>
        )}

        {/* Ocean Mode: deep navy with subtle wave pattern */}
        {theme === 'ocean' && (
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#0a1628]">
                <div
                    className="absolute inset-0 opacity-[0.05]"
                    style={{
                        backgroundImage: 'radial-gradient(#60a5fa 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-transparent to-indigo-950/30" />
            </div>
        )}

        {/* Main Content Layer */}
        <div className="relative z-10 flex flex-col md:flex-row min-h-screen">
            {children}
        </div>
    </div>
  );
};