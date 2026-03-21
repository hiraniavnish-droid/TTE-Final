
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ThemeMode } from '../types';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  getGlassClass: (opacity?: string) => string;
  getTextColor: () => string;
  getSecondaryTextColor: () => string;
  getCardBg: () => string;
  getInputClass: () => string;
  getBorderClass: () => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');

  // "High-Definition" Card Style: The Double Ring
  // bg-white border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] ring-1 ring-slate-900/5

  const getGlassClass = (opacity = '10') => {
    if (theme === 'ocean') return `bg-blue-950/60 backdrop-blur-xl border border-blue-600/20 shadow-2xl shadow-blue-950/40 rounded-2xl`;
    if (theme === 'dark') return `bg-slate-800/80 backdrop-blur-md border border-slate-700/50 shadow-xl shadow-black/20 rounded-2xl`;
    // Light: elevated card with subtle depth
    return `bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-[0_2px_12px_0_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 rounded-2xl`;
  };

  const getTextColor = () => {
    if (theme === 'ocean') return 'text-slate-100';
    if (theme === 'dark') return 'text-slate-100';
    return 'text-slate-900 tracking-tight';
  };

  const getSecondaryTextColor = () => {
    if (theme === 'ocean') return 'text-blue-200/80';
    if (theme === 'dark') return 'text-slate-400';
    return 'text-slate-500 font-normal';
  };

  const getCardBg = () => {
    if (theme === 'ocean') return 'bg-blue-950/60 hover:bg-blue-900/50 border border-blue-800/40 rounded-xl';
    if (theme === 'dark') return 'bg-slate-800 hover:bg-slate-700/80 border border-slate-700/50 rounded-xl';

    // Technical Luxury Interactive Card
    // Uses the Double Ring border
    return 'bg-white border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] ring-1 ring-slate-900/5 transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 rounded-xl';
  };

  const getInputClass = () => {
    if (theme === 'light') {
      return 'bg-white border border-slate-300 text-slate-900 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all duration-200 placeholder:text-slate-400 shadow-sm';
    }
    if (theme === 'ocean') {
      return 'bg-blue-950/60 border-blue-700/40 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder:text-slate-500 rounded-lg';
    }
    return 'bg-slate-800 border-slate-600 text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 placeholder:text-slate-500 rounded-lg';
  }

  const getBorderClass = () => {
    if (theme === 'light') return 'border-slate-200';
    if (theme === 'ocean') return 'border-blue-800/40';
    return 'border-slate-700/60';
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      getGlassClass,
      getTextColor,
      getSecondaryTextColor,
      getCardBg,
      getInputClass,
      getBorderClass
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
