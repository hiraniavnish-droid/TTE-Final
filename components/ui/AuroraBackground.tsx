import React from 'react';
import { cn } from '../../utils/helpers';
import { useTheme } from '../../contexts/ThemeContext';

interface AuroraBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({ children, className }) => {
  const { theme } = useTheme();

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden selection:bg-blue-100 selection:text-blue-900", className)}>
        
        {/* Aurora Layer - Only visible in Light Mode to keep other themes intact */}
        {theme === 'light' && (
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Base Fill */}
                <div className="absolute inset-0 bg-[#F8FAFC]" />

                {/* Orb 1: Top Left (Blue/Cyan) */}
                <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] bg-blue-200/40 rounded-full blur-[80px] animate-float-slow mix-blend-multiply" />
                
                {/* Orb 2: Bottom Right (Indigo/Purple) */}
                <div className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] bg-indigo-200/40 rounded-full blur-[80px] animate-float-slower mix-blend-multiply" />
                
                {/* Noise Texture Overlay (Prevents banding, adds tactile feel) */}
                <div 
                    className="absolute inset-0 opacity-[0.25] mix-blend-overlay"
                    style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
                    }}
                />
            </div>
        )}

        {/* Main Content Layer (Floats above Aurora) */}
        <div className="relative z-10 flex flex-col md:flex-row min-h-screen">
            {children}
        </div>

        {/* Animation Styles */}
        <style>{`
            @keyframes float-slow {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(20px) scale(1.05); }
            }
            @keyframes float-slower {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-30px) scale(1.1); }
            }
            .animate-float-slow {
                animation: float-slow 10s ease-in-out infinite;
            }
            .animate-float-slower {
                animation: float-slower 15s ease-in-out infinite reverse;
            }
        `}</style>
    </div>
  );
};