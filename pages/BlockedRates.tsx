
import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Building2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

const SHEET_ID = '1YY2b7uxPHsbXMYSYmvwASjy-lDYhqPAQx_Zmau4H5SQ';
const EMBED_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview?gid=0&rm=minimal`;
const OPEN_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0`;

export const BlockedRates = () => {
  const { theme, getTextColor } = useTheme();
  const [key, setKey]         = useState(0);
  const [loading, setLoading] = useState(true);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in duration-500">

      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-6 py-4 border-b shrink-0",
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300'
          )}>
            <Building2 size={20} />
          </div>
          <div>
            <h1 className={cn("text-xl font-bold font-serif", getTextColor())}>Blocked Hotel Rates</h1>
            <p className="text-xs opacity-40 mt-0.5">Live from Google Sheets</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); setKey(k => k + 1); }}
            className={cn(
              "p-2 rounded-lg border transition-colors",
              theme === 'light'
                ? 'text-slate-500 border-slate-200 hover:bg-slate-50'
                : 'text-slate-400 border-white/10 hover:bg-white/5'
            )}
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <a
            href={OPEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              theme === 'light'
                ? 'text-slate-600 border-slate-200 hover:bg-slate-50'
                : 'text-slate-300 border-white/10 hover:bg-white/5'
            )}
          >
            <ExternalLink size={14} /> Open in Sheets
          </a>
        </div>
      </div>

      {/* Iframe */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-slate-50">
            <Building2 size={36} className="text-slate-300 animate-pulse" />
            <p className="text-sm text-slate-400">Loading rates sheet...</p>
          </div>
        )}
        <iframe
          key={key}
          src={EMBED_URL}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          title="Blocked Hotel Rates"
        />
      </div>
    </div>
  );
};
