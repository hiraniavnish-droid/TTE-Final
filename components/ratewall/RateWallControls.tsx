import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Minus, Plus } from 'lucide-react';

export interface RateWallControlValues {
  city: string;
  checkIn: string;
  nights: number;
  rooms: number;
  pax: number;
  plan: string;
}

interface Props {
  values: RateWallControlValues;
  cities: string[];
  plans: string[];
  onChange: (patch: Partial<RateWallControlValues>) => void;
}

const Stepper: React.FC<{ value: number; set: (n: number) => void; min: number; max: number }> = ({ value, set, min, max }) => {
  const { theme, getTextColor } = useTheme();
  return (
    <div className={cn('flex items-center rounded-lg border', theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5')}>
      <button onClick={() => set(Math.max(min, value - 1))} className="px-2.5 py-2 opacity-60 hover:opacity-100 active:scale-90 transition"><Minus size={13} /></button>
      <span className={cn('flex-1 text-center text-sm font-bold tabular-nums', getTextColor())}>{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="px-2.5 py-2 opacity-60 hover:opacity-100 active:scale-90 transition"><Plus size={13} /></button>
    </div>
  );
};

export const RateWallControls: React.FC<Props> = ({ values, cities, plans, onChange }) => {
  const { theme, getInputClass } = useTheme();
  const inputCls = cn('w-full px-3 py-2 rounded-lg border outline-none text-sm', getInputClass());
  const labelCls = cn('text-[10.5px] font-bold uppercase tracking-wider mb-1 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>City</label>
          <select value={values.city} className={cn(inputCls, '[&>option]:text-black')} onChange={e => onChange({ city: e.target.value })}>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Check-in</label>
          <input type="date" value={values.checkIn} onChange={e => onChange({ checkIn: e.target.value })} className={cn(inputCls, 'font-mono')} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
      <div>
        <label className={labelCls}>Meal plan</label>
        <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
          {plans.map(p => (
            <button key={p} onClick={() => onChange({ plan: p })}
              className={cn('flex-1 py-2 text-[12px] font-bold transition',
                values.plan === p ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
