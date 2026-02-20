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
    <div className={cn("relative min-h-screen w-full overflow-hidden selection:bg-blue-100 selection:text-blue-900", className)}>
        
        {/* Technical Grid Layer - Only visible in Light Mode */}
        {theme === 'light' && (
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#F8FAFC]">
                <div 
                    className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        // Vignette Mask to fade out edges
                        maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)'
                    }}
                />
            </div>
        )}

        {/* Main Content Layer */}
        <div className="relative z-10 flex flex-col md:flex-row min-h-screen">
            {children}
        </div>
    </div>
  );
};