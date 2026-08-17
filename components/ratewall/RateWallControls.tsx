import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { RAJARSHI_HOTELS } from '../../services/rajarshiData';

// The meal plan is deliberately absent: every plan a room publishes is now
// priced on its own cell inside the card, so there is nothing global to pick.
export interface RateWallControlValues {
  city: string;
  checkIn: string;
  nights: number;
  rooms: number;
  pax: number;
}

interface Props {
  values: RateWallControlValues;
  cities: string[];
  onChange: (patch: Partial<RateWallControlValues>) => void;
}

// Local numeric arithmetic only. toISOString() forces UTC and in IST renders
// the day BEFORE the one the agent stepped to, which silently moves a stay
// across a festive-window boundary.
const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ── Festive jump chips, derived from the sheet's own windows ──────────────
//
// Deduping by the window's `from` date (the obvious rule) does NOT work on this
// data: eight hotels each print their own Diwali start between 05 and 08 Nov,
// so a from-date dedupe yields four chips all reading 'Diwali Date' and the
// agent never reaches Christmas or Uttrayan. Dedupe by FESTIVAL instead —
// first matching token in the label wins — and take the earliest window for
// each. That is the question the chip actually answers: "jump me to Diwali".
const FESTIVALS: { re: RegExp; label: string }[] = [
  { re: /diwali/i, label: 'Diwali' },
  { re: /christmas/i, label: 'Christmas' },
  { re: /new year/i, label: 'New Year' },
  { re: /uttrayan/i, label: 'Uttrayan' },
  { re: /republic/i, label: 'Republic Day' },
  { re: /full moon/i, label: 'Full Moon' },
];

// Which festival a label names is decided by whichever token appears EARLIEST
// in the printed text, not by the order of the table above: 'Christmas Date &
// Dec 2026 Full Moon' is a Christmas window, and 'Uttrayan, Republic Day & Jan
// 2027 Full Moon' is an Uttrayan one.
function festivalOf(label: string): string | null {
  let best: { at: number; label: string } | null = null;
  for (const f of FESTIVALS) {
    const at = label.search(f.re);
    if (at < 0) continue;
    if (!best || at < best.at) best = { at, label: f.label };
  }
  return best ? best.label : null;
}

function festiveJumps(): { label: string; date: string }[] {
  const earliest = new Map<string, string>();
  for (const h of RAJARSHI_HOTELS) {
    for (const t of h.tiers) {
      for (const w of t.windows) {
        const fest = festivalOf(w.label || t.label);
        if (!fest) continue;
        const prev = earliest.get(fest);
        if (!prev || w.from < prev) earliest.set(fest, w.from);
      }
    }
  }
  return Array.from(earliest, ([label, date]) => ({ label, date }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 4);
}

const Stepper: React.FC<{ value: number; set: (n: number) => void; min: number; max: number }> = ({ value, set, min, max }) => {
  const { theme, getTextColor } = useTheme();
  return (
    <div className={cn('flex items-center rounded-lg border', theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5')}>
      <button onClick={() => set(Math.max(min, value - 1))} className="px-1.5 py-1.5 opacity-60 hover:opacity-100 active:scale-90 transition"><Minus size={12} /></button>
      <span className={cn('w-7 text-center text-[13px] font-bold tabular-nums', getTextColor())}>{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="px-1.5 py-1.5 opacity-60 hover:opacity-100 active:scale-90 transition"><Plus size={12} /></button>
    </div>
  );
};

export const RateWallControls: React.FC<Props> = ({ values, cities, onChange }) => {
  const { theme, getInputClass, getSecondaryTextColor } = useTheme();
  const jumps = useMemo(festiveJumps, []);

  const labelCls = cn('text-[10px] font-bold uppercase tracking-wider mb-0.5 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');
  const fieldCls = cn('px-2 py-1.5 rounded-lg border outline-none text-[13px]', getInputClass());
  const stepBtn = cn('px-1.5 py-1.5 border rounded-lg opacity-70 hover:opacity-100 active:scale-90 transition',
    theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5');

  const chipBase = 'px-2 py-0.5 rounded-full text-[10.5px] font-bold transition active:scale-95';
  const plainChip = cn(chipBase, theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white/70 hover:bg-white/20');
  const festiveChip = cn(chipBase, theme === 'light' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20');

  return (
    <div className={cn('rounded-xl border px-3 py-2.5', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <label className={labelCls}>City</label>
          <select value={values.city} className={cn(fieldCls, 'w-[150px] [&>option]:text-black')} onChange={e => onChange({ city: e.target.value })}>
            <option value="ALL">All Kutch</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Check-in</label>
          <div className="flex items-center gap-1">
            <button title="Previous day" onClick={() => onChange({ checkIn: addDays(values.checkIn, -1) })} className={stepBtn}><ChevronLeft size={13} /></button>
            <input type="date" value={values.checkIn} onChange={e => e.target.value && onChange({ checkIn: e.target.value })} className={cn(fieldCls, 'font-mono')} />
            <button title="Next day" onClick={() => onChange({ checkIn: addDays(values.checkIn, 1) })} className={stepBtn}><ChevronRight size={13} /></button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Nights</label>
          <Stepper value={values.nights} set={n => onChange({ nights: n })} min={1} max={14} />
        </div>
        <div>
          <label className={labelCls}>Rooms</label>
          <Stepper value={values.rooms} set={n => onChange({ rooms: n })} min={1} max={20} />
        </div>
        <div>
          <label className={labelCls}>Guests</label>
          <Stepper value={values.pax} set={n => onChange({ pax: n })} min={1} max={40} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', getSecondaryTextColor())}>Jump</span>
        <button className={plainChip} onClick={() => onChange({ checkIn: todayISO() })}>Today</button>
        <button className={plainChip} onClick={() => onChange({ checkIn: addDays(todayISO(), 7) })}>+1 week</button>
        {jumps.map(j => (
          <button key={j.label} className={festiveChip} title={`${j.label} — from ${j.date}`} onClick={() => onChange({ checkIn: j.date })}>
            {j.label} · {shortDate(j.date)}
          </button>
        ))}
      </div>
    </div>
  );
};
