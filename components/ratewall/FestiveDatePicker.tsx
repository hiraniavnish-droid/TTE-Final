// ============================================================
// Small calendar popover that circles festive/blackout dates (see
// services/kevadiyaFestiveDates.ts) so an agent notices before quoting a
// date that falls in one, without changing how the date is actually picked
// — the native <input type="date"> next to this stays fully functional;
// this is a purely additive, optional affordance. Selecting a day here
// just calls onChange with the same ISO string the native input would.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { festiveRangesFor, KEVADIYA_FESTIVE_RANGES } from '../../services/kevadiyaFestiveDates';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

interface Props {
  value: string; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
}

export const FestiveDatePicker: React.FC<Props> = ({ value, onChange }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const [open, setOpen] = useState(false);
  const [y, m, d] = value.split('-').map(Number);
  const [viewYear, setViewYear] = useState(y || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState((m || 1) - 1); // 0-indexed
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const openPicker = () => {
    setViewYear(y || new Date().getFullYear());
    setViewMonth((m || 1) - 1);
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    let nm = viewMonth + delta, ny = viewYear;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    setViewMonth(nm); setViewYear(ny);
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Ranges touching the visible month, for the legend below the grid.
  const monthStart = toISO(viewYear, viewMonth, 1);
  const monthEnd = toISO(viewYear, viewMonth, daysInMonth);
  const visibleRanges = KEVADIYA_FESTIVE_RANGES.filter(r => r.start <= monthEnd && r.end >= monthStart);

  return (
    <div className="relative" ref={boxRef}>
      <button type="button" onClick={() => (open ? setOpen(false) : openPicker())}
        title="Show festive dates"
        className={cn('flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 transition',
          theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30')}>
        <CalendarDays size={14} />
      </button>

      {open && (
        <div className={cn('absolute z-30 top-9 left-0 w-64 rounded-xl border p-3 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.25)]',
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10')}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded opacity-60 hover:opacity-100 transition"><ChevronLeft size={14} /></button>
            <span className={cn('text-[12px] font-bold', getTextColor())}>{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1 rounded opacity-60 hover:opacity-100 transition"><ChevronRight size={14} /></button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAY_LABELS.map((w, idx) => (
              <div key={idx} className={cn('text-center text-[9px] font-bold uppercase', getSecondaryTextColor())}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day == null) return <div key={idx} />;
              const iso = toISO(viewYear, viewMonth, day);
              const festive = festiveRangesFor(iso);
              const isSelected = iso === value;
              return (
                <button key={idx} type="button" onClick={() => { onChange(iso); setOpen(false); }}
                  title={festive.length ? festive.map(f => `${f.label} (${f.source})`).join(' · ') : undefined}
                  className={cn('relative w-7 h-7 rounded-full text-[11px] font-semibold transition flex items-center justify-center',
                    isSelected ? 'bg-slate-900 text-white'
                      : festive.length ? cn(theme === 'light' ? 'text-rose-600 ring-2 ring-rose-400 ring-inset hover:bg-rose-50' : 'text-rose-300 ring-2 ring-rose-500/60 ring-inset hover:bg-rose-500/10')
                      : cn(theme === 'light' ? 'text-slate-700 hover:bg-slate-100' : 'text-white/70 hover:bg-white/10'))}>
                  {day}
                </button>
              );
            })}
          </div>

          {visibleRanges.length > 0 && (
            <div className={cn('mt-2.5 pt-2.5 border-t space-y-1', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
              {visibleRanges.map((r, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className={cn('mt-1 w-1.5 h-1.5 rounded-full shrink-0', theme === 'light' ? 'bg-rose-400' : 'bg-rose-500')} />
                  <span className={cn('text-[10px] leading-tight', getSecondaryTextColor())}>
                    <span className="font-semibold">{r.label}</span> — {r.source}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
