
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatCompactCurrency } from '../utils/helpers';
import { Search, X, MapPin, Phone, Tag } from 'lucide-react';

export const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { leads } = useLeads();
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return leads
      .filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.contact?.phone?.includes(q) ||
        l.contact?.email?.toLowerCase().includes(q) ||
        l.tripDetails?.destination?.toLowerCase().includes(q) ||
        l.tags?.some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, leads]);

  const handleSelect = (id: string) => {
    setOpen(false);
    navigate(`/leads/${id}`);
  };

  if (!open) return null;

  const modalBg = theme === 'light'
    ? 'bg-white border-slate-200 shadow-2xl'
    : theme === 'ocean'
    ? 'bg-blue-950 border-blue-800/60 shadow-2xl shadow-black/40'
    : 'bg-slate-900 border-slate-700/60 shadow-2xl shadow-black/40';

  const inputBg = theme === 'light'
    ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
    : theme === 'ocean'
    ? 'bg-blue-900/40 border-blue-700/40 text-slate-100 placeholder-slate-500'
    : 'bg-slate-800 border-slate-700/50 text-slate-100 placeholder-slate-500';

  const hoverBg = theme === 'light' ? 'hover:bg-slate-50' : theme === 'ocean' ? 'hover:bg-blue-900/40' : 'hover:bg-slate-800/60';

  const statusColors: Record<string, string> = {
    'New': 'bg-sky-100 text-sky-700',
    'Contacted': 'bg-amber-100 text-amber-700',
    'Proposal Sent': 'bg-violet-100 text-violet-700',
    'Discussion': 'bg-indigo-100 text-indigo-700',
    'Won': 'bg-emerald-100 text-emerald-700',
    'Lost': 'bg-slate-100 text-slate-500',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn('relative w-full max-w-lg rounded-2xl border overflow-hidden', modalBg)}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 pb-3">
          <Search size={18} className="shrink-0 opacity-40" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search leads by name, phone, destination…"
            className={cn(
              'flex-1 bg-transparent border-none outline-none text-sm',
              theme === 'light' ? 'text-slate-800 placeholder-slate-400' : 'text-slate-100 placeholder-slate-500'
            )}
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity">
              <X size={16} />
            </button>
          )}
          <kbd className={cn(
            'hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono opacity-40 shrink-0',
            theme === 'light' ? 'border-slate-300 bg-slate-100' : 'border-slate-600 bg-slate-800'
          )}>
            ESC
          </kbd>
        </div>

        {/* Divider */}
        <div className={cn('h-px mx-4', theme === 'light' ? 'bg-slate-100' : theme === 'ocean' ? 'bg-blue-800/40' : 'bg-slate-700/50')} />

        {/* Results */}
        {query.trim() === '' ? (
          <div className={cn('px-4 py-6 text-center text-sm opacity-40', getSecondaryTextColor())}>
            Start typing to search leads…
          </div>
        ) : results.length === 0 ? (
          <div className={cn('px-4 py-6 text-center text-sm opacity-40', getSecondaryTextColor())}>
            No leads found for "{query}"
          </div>
        ) : (
          <ul className="py-2 max-h-80 overflow-y-auto">
            {results.map(lead => (
              <li key={lead.id}>
                <button
                  onClick={() => handleSelect(lead.id)}
                  className={cn(
                    'w-full px-4 py-3 flex items-start gap-3 text-left transition-colors',
                    hoverBg
                  )}
                >
                  {/* Avatar / initials */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                    theme === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300'
                  )}>
                    {lead.name?.charAt(0).toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-semibold capitalize', getTextColor())}>{lead.name}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', statusColors[lead.status] || 'bg-slate-100 text-slate-500')}>
                        {lead.status}
                      </span>
                    </div>
                    <div className={cn('flex items-center gap-3 mt-0.5 flex-wrap', getSecondaryTextColor())}>
                      {lead.tripDetails?.destination && (
                        <span className="flex items-center gap-1 text-[11px] opacity-70">
                          <MapPin size={10} /> {lead.tripDetails.destination}
                        </span>
                      )}
                      {lead.contact?.phone && (
                        <span className="flex items-center gap-1 text-[11px] opacity-70">
                          <Phone size={10} /> {lead.contact.phone}
                        </span>
                      )}
                      {lead.tags && lead.tags.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] opacity-70">
                          <Tag size={10} /> {lead.tags.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {lead.tripDetails?.budget ? (
                    <span className={cn('text-[11px] font-semibold shrink-0 opacity-60', getSecondaryTextColor())}>
                      {formatCompactCurrency(lead.tripDetails.budget)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Footer hint */}
        <div className={cn(
          'px-4 py-2.5 border-t text-[10px] flex items-center justify-between opacity-40',
          theme === 'light' ? 'border-slate-100' : theme === 'ocean' ? 'border-blue-800/40' : 'border-slate-700/50',
          getSecondaryTextColor()
        )}>
          <span>{results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''}` : 'No results'}</span>
          <span>↵ to open · Esc to close</span>
        </div>
      </div>
    </div>
  );
};
