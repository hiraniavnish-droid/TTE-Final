
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatCompactCurrency } from '../utils/helpers';
import {
  Search, X, MapPin, Phone, Tag,
  LayoutDashboard, Users, CalendarCheck, Handshake, BookUser,
  Building2, Map, Sun, Moon, Droplets, Plus, Zap, ArrowRight,
} from 'lucide-react';

type Action = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  onAction: () => void;
  color?: string;
};

export const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { leads } = useLeads();
  const { theme, setTheme, getTextColor, getSecondaryTextColor } = useTheme();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(prev => !prev); }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIdx(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  // Quick actions shown when no query or matched by query
  const allActions: Action[] = useMemo(() => [
    { id: 'nav-dashboard',   label: 'Go to Dashboard',    description: 'Overview & analytics',   icon: LayoutDashboard, color: 'text-indigo-500', onAction: () => { navigate('/'); close(); } },
    { id: 'nav-leads',       label: 'Go to Leads',        description: 'Kanban pipeline',         icon: Users,           color: 'text-sky-500',    onAction: () => { navigate('/leads'); close(); } },
    { id: 'nav-tasks',       label: 'Go to Tasks',        description: 'Reminders & deadlines',   icon: CalendarCheck,   color: 'text-amber-500',  onAction: () => { navigate('/reminders'); close(); } },
    { id: 'nav-suppliers',   label: 'Go to Suppliers',    description: 'Vendor directory',        icon: Handshake,       color: 'text-teal-500',   onAction: () => { navigate('/suppliers'); close(); } },
    { id: 'nav-customers',   label: 'Go to Customers',    description: 'Customer profiles',       icon: BookUser,        color: 'text-violet-500', onAction: () => { navigate('/customers'); close(); } },
    { id: 'nav-rates',       label: 'Go to Blocked Rates',description: 'Hotel rate sheets',       icon: Building2,       color: 'text-rose-500',   onAction: () => { navigate('/blocked-rates'); close(); } },
    { id: 'nav-itinerary',   label: 'Itinerary Hub',      description: 'Build trip itineraries',  icon: Map,             color: 'text-emerald-500',onAction: () => { navigate('/builder'); close(); } },
    { id: 'add-lead',        label: 'Add New Lead',       description: 'Create a lead instantly', icon: Plus,            color: 'text-indigo-600', onAction: () => { close(); setTimeout(() => window.dispatchEvent(new CustomEvent('open-add-lead')), 100); } },
    { id: 'theme-light',     label: 'Switch to Light Theme', icon: Sun,     color: 'text-amber-400', onAction: () => { setTheme('light'); close(); } },
    { id: 'theme-dark',      label: 'Switch to Dark Theme',  icon: Moon,    color: 'text-slate-400',  onAction: () => { setTheme('dark'); close(); } },
    { id: 'theme-ocean',     label: 'Switch to Ocean Theme', icon: Droplets,color: 'text-blue-400',   onAction: () => { setTheme('ocean'); close(); } },
  ], [navigate, setTheme]);

  const leadResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return leads.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.contact?.phone?.includes(q) ||
      l.contact?.email?.toLowerCase().includes(q) ||
      l.tripDetails?.destination?.toLowerCase().includes(q) ||
      l.tags?.some(t => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [query, leads]);

  const actionResults = useMemo(() => {
    if (!query.trim()) return allActions.slice(0, 6);
    const q = query.toLowerCase();
    return allActions.filter(a => a.label.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
  }, [query, allActions]);

  const totalItems = leadResults.length + actionResults.length;

  // Arrow key navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => (i + 1) % Math.max(totalItems, 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => (i - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1)); }
      if (e.key === 'Enter' && totalItems > 0) {
        e.preventDefault();
        if (selectedIdx < leadResults.length) {
          close(); navigate(`/leads/${leadResults[selectedIdx].id}`);
        } else {
          actionResults[selectedIdx - leadResults.length]?.onAction();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selectedIdx, totalItems, leadResults, actionResults, navigate]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  if (!open) return null;

  const modalBg = theme === 'light'
    ? 'bg-white border-slate-200 shadow-2xl shadow-black/10'
    : theme === 'ocean' ? 'bg-blue-950 border-blue-800/60 shadow-2xl shadow-black/50'
    : 'bg-slate-900 border-slate-700/60 shadow-2xl shadow-black/50';

  const hoverBg = theme === 'light' ? 'hover:bg-slate-50' : theme === 'ocean' ? 'hover:bg-blue-900/40' : 'hover:bg-slate-800/60';
  const selectedBg = theme === 'light' ? 'bg-indigo-50' : theme === 'ocean' ? 'bg-blue-900/50' : 'bg-slate-800';

  const statusColors: Record<string, string> = {
    'New': 'bg-sky-100 text-sky-700', 'Contacted': 'bg-amber-100 text-amber-700',
    'Proposal Sent': 'bg-violet-100 text-violet-700', 'Discussion': 'bg-indigo-100 text-indigo-700',
    'Won': 'bg-emerald-100 text-emerald-700', 'Lost': 'bg-slate-100 text-slate-500',
  };

  const divider = <div className={cn('h-px mx-4', theme === 'light' ? 'bg-slate-100' : theme === 'ocean' ? 'bg-blue-800/40' : 'bg-slate-700/50')} />;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" onClick={close}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className={cn('relative w-full max-w-xl rounded-2xl border overflow-hidden', modalBg)}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 p-4 pb-3">
          <Search size={17} className="shrink-0 opacity-40" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search leads or type a command…"
            className={cn(
              'flex-1 bg-transparent border-none outline-none text-sm',
              theme === 'light' ? 'text-slate-800 placeholder-slate-400' : 'text-slate-100 placeholder-slate-500'
            )}
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity cursor-pointer">
              <X size={16} />
            </button>
          )}
          <kbd className={cn('hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono opacity-40 shrink-0', theme === 'light' ? 'border-slate-300 bg-slate-100' : 'border-slate-600 bg-slate-800')}>
            ESC
          </kbd>
        </div>

        {divider}

        <div className="max-h-[420px] overflow-y-auto">
          {/* Lead results */}
          {leadResults.length > 0 && (
            <>
              <div className={cn("px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest opacity-40", getSecondaryTextColor())}>
                Leads
              </div>
              {leadResults.map((lead, i) => (
                <button
                  key={lead.id}
                  onClick={() => { close(); navigate(`/leads/${lead.id}`); }}
                  className={cn('w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer', i === selectedIdx ? selectedBg : hoverBg)}
                >
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', theme === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300')}>
                    {lead.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-semibold capitalize truncate', getTextColor())}>{lead.name}</span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', statusColors[lead.status] || 'bg-slate-100 text-slate-500')}>{lead.status}</span>
                    </div>
                    {lead.tripDetails?.destination && (
                      <span className={cn("flex items-center gap-1 text-[11px] opacity-60", getSecondaryTextColor())}>
                        <MapPin size={9} /> {lead.tripDetails.destination}
                        {lead.contact?.phone && <><span className="opacity-40">·</span><Phone size={9} /> {lead.contact.phone}</>}
                      </span>
                    )}
                  </div>
                  {lead.tripDetails?.budget ? (
                    <span className={cn('text-[11px] font-semibold shrink-0 tabular-nums opacity-60', getSecondaryTextColor())}>{formatCompactCurrency(lead.tripDetails.budget)}</span>
                  ) : null}
                </button>
              ))}
              {actionResults.length > 0 && divider}
            </>
          )}

          {/* Actions */}
          {actionResults.length > 0 && (
            <>
              <div className={cn("px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest opacity-40", getSecondaryTextColor())}>
                {query.trim() ? 'Actions' : 'Quick Actions'}
              </div>
              {actionResults.map((action, i) => {
                const globalIdx = leadResults.length + i;
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={action.onAction}
                    className={cn('w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer', globalIdx === selectedIdx ? selectedBg : hoverBg)}
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', theme === 'light' ? 'bg-slate-100' : 'bg-slate-700/60')}>
                      <ActionIcon size={14} className={action.color || 'opacity-60'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-semibold', getTextColor())}>{action.label}</span>
                      {action.description && <p className={cn("text-[11px] opacity-50", getSecondaryTextColor())}>{action.description}</p>}
                    </div>
                    <ArrowRight size={13} className="opacity-20 shrink-0" />
                  </button>
                );
              })}
            </>
          )}

          {query.trim() && leadResults.length === 0 && actionResults.length === 0 && (
            <div className={cn('px-4 py-8 text-center text-sm opacity-40', getSecondaryTextColor())}>
              No results for "{query}"
            </div>
          )}
        </div>

        {divider}
        <div className={cn('px-4 py-2 text-[10px] flex items-center justify-between opacity-30', getSecondaryTextColor())}>
          <span className="flex items-center gap-2">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
          </span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
