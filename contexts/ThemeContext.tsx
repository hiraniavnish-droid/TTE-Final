
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeMode } from '../types';
import { localStore } from '../lib/browserStorage';

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
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStore.getItem('tte:theme');
    return stored === 'dark' || stored === 'ocean' ? stored : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStore.setItem('tte:theme', theme);
  }, [theme]);

  const getGlassClass = () => {
    if (theme === 'ocean') return 'bg-[#132b3a] border border-[#2a4859] rounded-xl shadow-sm';
    if (theme === 'dark') return 'bg-slate-800 border border-slate-700 rounded-xl shadow-sm';
    return 'bg-white border border-slate-200 rounded-xl shadow-sm';
  };

  const getTextColor = () => {
    if (theme === 'ocean') return 'text-slate-100';
    if (theme === 'dark') return 'text-slate-100';
    return 'text-slate-900 tracking-tight';
  };

  const getSecondaryTextColor = () => {
    if (theme === 'ocean') return 'text-slate-300';
    if (theme === 'dark') return 'text-slate-300';
    return 'text-slate-500 font-normal';
  };

  const getCardBg = () => theme === 'light'
    ? 'bg-white border border-slate-200 rounded-xl shadow-sm'
    : 'bg-slate-800 border border-slate-700 rounded-xl';

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
