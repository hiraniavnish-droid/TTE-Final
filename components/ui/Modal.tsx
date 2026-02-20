
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const { getTextColor, theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle Animation Lifecycle
  useEffect(() => {
    if (isOpen) {
        setShouldRender(true);
        // Small delay to allow render before animating in
        setTimeout(() => setIsVisible(true), 10);
    } else {
        setIsVisible(false);
        // Wait for animation to finish before unmounting
        setTimeout(() => setShouldRender(false), 300); 
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Darkened Blur Backdrop */}
      <div 
        className={cn(
            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out",
            isVisible ? "opacity-100" : "opacity-0"
        )} 
        onClick={onClose}
      />
      
      {/* Modal Content - Spring/Bouncy Animation */}
      <div className={cn(
        "relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-white transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8",
        theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white'
      )}>
        {/* Header */}
        <div className={cn("flex items-center justify-between px-6 py-5 border-b", theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
          <h2 className={cn("text-xl font-bold tracking-tight font-serif", getTextColor())}>{title}</h2>
          <button 
            onClick={onClose}
            className={cn(
                "p-2 rounded-full transition-colors active:scale-90 hover:rotate-90 duration-300", 
                theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-white/10 text-white/70'
            )}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div className={cn("p-6 max-h-[80vh] overflow-y-auto scrollbar-hide", getTextColor())}>
          {children}
        </div>
      </div>
    </div>
  );
};
