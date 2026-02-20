
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
    if (theme === 'ocean') return `bg-white/${opacity} backdrop-blur-md border border-white/20 shadow-xl`;
    if (theme === 'dark') return `bg-gray-900 border border-gray-800 shadow-sm`;
    
    // Technical Luxury: Double Ring Border
    return `bg-white border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] ring-1 ring-slate-900/5 rounded-xl`;
  };

  const getTextColor = () => {
    if (theme === 'ocean') return 'text-white';
    if (theme === 'dark') return 'text-gray-100';
    return 'text-slate-900 tracking-tight'; 
  };

  const getSecondaryTextColor = () => {
    if (theme === 'ocean') return 'text-blue-100';
    if (theme === 'dark') return 'text-gray-400';
    return 'text-slate-500 font-normal'; 
  };

  const getCardBg = () => {
    if (theme === 'ocean') return 'bg-white/10 hover:bg-white/20';
    if (theme === 'dark') return 'bg-gray-800/40 hover:bg-gray-700/50';
    
    // Technical Luxury Interactive Card
    // Uses the Double Ring border
    return 'bg-white border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] ring-1 ring-slate-900/5 transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 rounded-xl';
  };

  const getInputClass = () => {
    if (theme === 'light') {
      return 'bg-white border border-slate-300 text-slate-900 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-all duration-200 placeholder:text-slate-400 shadow-sm';
    }
    return 'bg-gray-800 border-gray-700 text-white focus:border-gray-500 placeholder:text-gray-500 rounded-lg';
  }

  const getBorderClass = () => {
    if (theme === 'light') return 'border-slate-200';
    return 'border-white/10';
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
