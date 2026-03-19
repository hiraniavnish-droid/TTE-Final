
import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, MapPin, ArrowLeft, ChevronRight,
  Calculator, Calendar, Users, Info, RefreshCw, BedDouble,
  Utensils, Sun, Moon, Star, Sparkles, TrendingUp, Hotel,
  Copy, Check, SortAsc, SortDesc, EyeOff, Filter
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzauWqedtFb20pNpcXKOY8ahW4pmWDjo5n5TBaKGIBcTL6ZosoTINPHz3nivFsKPXstXEPO4ciI5Lm/pub?output=csv';

const PLAN_TYPES = ['CP', 'MAP', 'AP'] as const;
const DAY_TYPES  = ['Weekday', 'Weekend'] as const;
const OCC_TYPES  = ['Single', 'Double', 'Triple'] as const;

const FEATURED_CITIES = [
  'Agra', 'Jaipur', 'Goa', 'Udaipur', 'Shimla',
  'Manali', 'Darjeeling', 'Varanasi', 'Mysore', 'Ooty',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotelRate {
  City: string;
  HOTEL: string;
  'ROOM CATEGORY': string;
  Remarks?: string;
  [key: string]: string | undefined;
}

interface CalculationResult {
  nights: number;
  totalCost: number;
  occupancy: string;
  hasInvalidRate: boolean;
  nightDetails: { date: string; type: string; rate: number | string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRate = (val: string | undefined): string => {
  if (!val || val.trim() === '' || val.toLowerCase().includes('please call') || val.toLowerCase().includes('email us'))
    return '—';
  return val.trim();
};

const isNumericRate = (val: string) => val !== '—' && !isNaN(Number(val.replace(/,/g, '')));

const getCheapestRateInfo = (rows: HotelRate[]): { rate: number; label: string } | null => {
  let cheapest = Infinity, label = '';
  rows.forEach(r => {
    const cat = (r['ROOM CATEGORY'] || '').toUpperCase();
    if (cat.includes('CNB') || cat.includes('CWB') || cat.includes('CHILD')) return;
    PLAN_TYPES.forEach(plan =>
      DAY_TYPES.forEach(day =>
        OCC_TYPES.forEach(occ => {
          const val = r[`${day} ${occ} ${plan}`];
          if (val && val.trim() !== '' && !isNaN(Number(val.replace(/,/g, '')))) {
            const num = Number(val.replace(/,/g, ''));
            if (num < cheapest) { cheapest = num; label = `${occ} · ${plan}`; }
          }
        })
      )
    );
  });
  return cheapest === Infinity ? null : { rate: cheapest, label };
};

const calculateQuote = (
  hotelData: HotelRate, checkIn: string, checkOut: string, pax: number, plan: string
): CalculationResult | null => {
  if (!hotelData || !checkIn || !checkOut) return null;
  const ci = new Date(checkIn); ci.setHours(0, 0, 0, 0);
  const co = new Date(checkOut); co.setHours(0, 0, 0, 0);
  if (isNaN(ci.getTime()) || isNaN(co.getTime()) || co <= ci) return null;
  const nights = Math.round((co.getTime() - ci.getTime()) / 86_400_000);
  const occupancy = pax === 1 ? 'Single' : pax === 2 ? 'Double' : 'Triple';
  const remarks = (hotelData.Remarks || '').toLowerCase();
  const sameRates = remarks.includes('w/d & w/e same');
  const monThu = remarks.includes('mon-thu') && remarks.includes('fri-sun');
  let totalCost = 0, hasInvalidRate = false;
  const nightDetails: { date: string; type: string; rate: number | string }[] = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(ci); d.setDate(ci.getDate() + i);
    const dow = d.getDay();
    const isWeekend = sameRates ? false : monThu ? (dow === 5 || dow === 6 || dow === 0) : (dow === 5 || dow === 6);
    const dayType = isWeekend ? 'Weekend' : 'Weekday';
    const otherDay = isWeekend ? 'Weekday' : 'Weekend';
    let rateStr = hotelData[`${dayType} ${occupancy} ${plan}`];
    // Always fall back to the other day type if this one is empty —
    // many hotels only fill one column even when rates are the same.
    if (!rateStr || rateStr.trim() === '')
      rateStr = hotelData[`${otherDay} ${occupancy} ${plan}`];
    const clean = rateStr ? rateStr.replace(/,/g, '').trim() : '';
    const rate = clean && !isNaN(Number(clean)) ? Number(clean) : NaN;
    if (isNaN(rate)) hasInvalidRate = true;
    totalCost += isNaN(rate) ? 0 : rate;
    nightDetails.push({ date: d.toLocaleDateString('en-IN'), type: dayType, rate: isNaN(rate) ? 'On Request' : rate });
  }
  return { nights, totalCost, occupancy, hasInvalidRate, nightDetails };
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-xl bg-slate-200 dark:bg-white/10', className)} />
);

// ─── Hotel Detail View ────────────────────────────────────────────────────────

const HotelView: React.FC<{ hotelName: string; rows: HotelRate[]; onBack: () => void; backLabel: string }> = ({ hotelName, rows, onBack, backLabel }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const [checkIn,  setCheckIn]  = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [pax,      setPax]      = useState(2);
  const [plan,     setPlan]     = useState('CP');
  const [roomCat,  setRoomCat]  = useState(rows[0]?.['ROOM CATEGORY'] || '');

  const selectedRow  = useMemo(() => rows.find(r => r['ROOM CATEGORY'] === roomCat) || rows[0], [rows, roomCat]);
  const calculation  = useMemo(() => calculateQuote(selectedRow, checkIn, checkOut, pax, plan), [selectedRow, checkIn, checkOut, pax, plan]);
  const cheapestInfo = useMemo(() => getCheapestRateInfo(rows), [rows]);
  const border       = theme === 'light' ? 'border-slate-100' : 'border-white/5';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack}
          className={cn('mt-1 p-2 rounded-xl border transition-colors shrink-0',
            theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/5 border-white/10 hover:bg-white/10')}>
          <ArrowLeft size={16} className={getSecondaryTextColor()} />
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-1 opacity-40', getTextColor())}>{backLabel}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('text-2xl font-bold font-serif', getTextColor())}>{hotelName}</h2>
            {cheapestInfo && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                From ₹{cheapestInfo.rate.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className={cn('flex items-center gap-1.5 mt-1 text-sm', getSecondaryTextColor())}>
            <MapPin size={12} className="text-blue-500" />
            <span>{rows[0]?.City}</span>
            <span className="opacity-30">·</span>
            <span>{rows.length} room categor{rows.length === 1 ? 'y' : 'ies'}</span>
          </div>
        </div>
      </div>

      {/* Remarks */}
      {rows[0]?.Remarks && (
        <div className={cn('flex items-start gap-3 p-4 rounded-xl border text-sm',
          theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-300')}>
          <Info size={15} className="shrink-0 mt-0.5" /><span>{rows[0].Remarks}</span>
        </div>
      )}

      {/* Quote Calculator — compact, theme-aware */}
      <div className={cn('rounded-2xl border', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
        {/* Title row */}
        <div className={cn('flex items-center gap-2 px-4 py-3 border-b', theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
          <Calculator size={14} className="text-blue-500" />
          <span className={cn('text-xs font-bold', getTextColor())}>Quote Calculator</span>
          <span className={cn('text-[10px] ml-1 opacity-40', getSecondaryTextColor())}>— select dates to estimate total cost</span>
        </div>

        {/* Inputs row */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Check-In */}
            <div>
              <label className={cn('text-[10px] font-mono uppercase tracking-wider opacity-40 flex items-center gap-1 mb-1', getTextColor())}>
                <Calendar size={9} /> Check-In
              </label>
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                className={cn('w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all',
                  theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white text-slate-800' : 'bg-white/5 border-white/10 focus:border-blue-400 text-white')} />
            </div>
            {/* Check-Out */}
            <div>
              <label className={cn('text-[10px] font-mono uppercase tracking-wider opacity-40 flex items-center gap-1 mb-1', getTextColor())}>
                <Calendar size={9} /> Check-Out
              </label>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                className={cn('w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all',
                  theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white text-slate-800' : 'bg-white/5 border-white/10 focus:border-blue-400 text-white')} />
            </div>
            {/* Occupancy */}
            <div>
              <label className={cn('text-[10px] font-mono uppercase tracking-wider opacity-40 flex items-center gap-1 mb-1', getTextColor())}>
                <Users size={9} /> Occupancy
              </label>
              <select value={pax} onChange={e => setPax(Number(e.target.value))}
                className={cn('w-full rounded-lg border px-3 py-2 text-sm outline-none appearance-none transition-all',
                  theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white text-slate-800' : 'bg-white/5 border-white/10 focus:border-blue-400 text-white')}>
                <option value={1}>Single</option>
                <option value={2}>Double</option>
                <option value={3}>Triple</option>
              </select>
            </div>
            {/* Room Type */}
            <div>
              <label className={cn('text-[10px] font-mono uppercase tracking-wider opacity-40 flex items-center gap-1 mb-1', getTextColor())}>
                <BedDouble size={9} /> Room
              </label>
              <select value={roomCat} onChange={e => setRoomCat(e.target.value)}
                className={cn('w-full rounded-lg border px-3 py-2 text-sm outline-none appearance-none transition-all',
                  theme === 'light' ? 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white text-slate-800' : 'bg-white/5 border-white/10 focus:border-blue-400 text-white')}>
                {rows.map(r => <option key={r['ROOM CATEGORY']} value={r['ROOM CATEGORY']}>{r['ROOM CATEGORY']}</option>)}
              </select>
            </div>
          </div>

          {/* Meal plan + result inline */}
          <div className={cn('flex flex-wrap items-center justify-between gap-3 pt-3 border-t', theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
            {/* Plan pills */}
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-mono uppercase opacity-40 mr-1', getTextColor())}>Plan:</span>
              {PLAN_TYPES.map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all',
                    plan === p
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : theme === 'light'
                        ? 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'
                        : 'bg-white/5 border-white/10 text-white/40 hover:border-blue-400/40 hover:text-white'
                  )}>
                  {p === 'CP' ? 'CP · Bfast' : p === 'MAP' ? 'MAP · Bfast+Din' : 'AP · All Meals'}
                </button>
              ))}
            </div>

            {/* Result */}
            {calculation ? (
              calculation.hasInvalidRate && calculation.totalCost === 0 ? (
                <div className={cn('flex items-center gap-1.5 text-sm font-medium', 'text-amber-500')}>
                  <Info size={13} /> Rate not available for this combination
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {calculation.hasInvalidRate && (
                    <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                      <Info size={10} /> Some nights on request
                    </span>
                  )}
                  <div className="text-right">
                    <p className={cn('text-[10px] font-mono uppercase opacity-40 tracking-wider', getTextColor())}>
                      {calculation.nights} night{calculation.nights !== 1 ? 's' : ''} · {calculation.occupancy} · {plan}
                    </p>
                    <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600">
                      ₹{calculation.totalCost.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <p className={cn('text-xs opacity-30 italic', getSecondaryTextColor())}>Enter dates to calculate</p>
            )}
          </div>
        </div>
      </div>

      {/* Rate Tables */}
      <div className="space-y-4">
        {rows.map((category, idx) => {
          const remarks  = (category.Remarks || '').toLowerCase();
          const isMonThu = remarks.includes('mon-thu') && remarks.includes('fri-sun');
          const wdLabel  = isMonThu ? 'Weekday (Mon–Thu)' : 'Weekday';
          const weLabel  = isMonThu ? 'Weekend (Fri–Sun)' : 'Weekend';
          return (
            <div key={idx} className={cn('rounded-2xl border overflow-hidden', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
              <div className={cn('flex items-center justify-between px-5 py-3.5 border-b', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5')}>
                <div className="flex items-center gap-2">
                  <BedDouble size={14} className="text-blue-500" />
                  <span className={cn('font-bold text-sm', getTextColor())}>{category['ROOM CATEGORY'] || 'Standard'}</span>
                </div>
                <button onClick={() => setRoomCat(category['ROOM CATEGORY'])}
                  className="text-[10px] text-blue-500 font-mono uppercase tracking-wider hover:underline flex items-center gap-1">
                  Calculate <Calculator size={9} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className={cn('text-[10px] font-mono uppercase tracking-wider', theme === 'light' ? 'bg-slate-50 text-slate-400' : 'bg-white/3 text-white/20')}>
                      <th className={cn('px-4 py-3 text-left font-bold border-r', border)}>Plan</th>
                      <th className="px-3 py-3 text-center font-bold" colSpan={3}><span className="flex items-center justify-center gap-1"><Sun size={10} />{wdLabel}</span></th>
                      <th className="px-3 py-3 text-center font-bold" colSpan={3}><span className="flex items-center justify-center gap-1"><Moon size={10} />{weLabel}</span></th>
                    </tr>
                    <tr className={cn('text-[9px] font-mono uppercase tracking-widest border-b', theme === 'light' ? 'text-slate-300 border-slate-100' : 'text-white/10 border-white/5')}>
                      <th className={cn('px-4 py-2 border-r', border)}></th>
                      {['Single','Double','Triple','Single','Double','Triple'].map((o, i) => <th key={i} className="px-3 py-2 text-center">{o}</th>)}
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', theme === 'light' ? 'divide-slate-50' : 'divide-white/5')}>
                    {PLAN_TYPES.map(p => (
                      <tr key={p} className={cn('transition-colors', theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                        <td className={cn('px-4 py-3.5 border-r', border)}>
                          <span className={cn('w-7 h-7 rounded-lg text-[10px] font-bold inline-flex items-center justify-center',
                            p === 'CP'  ? 'bg-blue-50 text-blue-600' :
                            p === 'MAP' ? 'bg-violet-50 text-violet-600' :
                                          'bg-emerald-50 text-emerald-600'
                          )}>{p}</span>
                        </td>
                        {DAY_TYPES.map(day => OCC_TYPES.map(occ => {
                          const key = `${day} ${occ} ${p}`;
                          let raw = category[key];
                          if ((category.Remarks || '').toLowerCase().includes('w/d & w/e same') && (!raw || raw.trim() === ''))
                            raw = category[`${day === 'Weekday' ? 'Weekend' : 'Weekday'} ${occ} ${p}`];
                          const display = formatRate(raw);
                          const numeric = isNumericRate(display);
                          return (
                            <td key={key} className="px-3 py-3.5 text-center">
                              {numeric
                                ? <span className={cn('font-mono font-bold text-sm', getTextColor())}>₹{Number(display.replace(/,/g, '')).toLocaleString('en-IN')}</span>
                                : <span className={cn('text-[10px] italic opacity-30', getTextColor())}>{display}</span>}
                            </td>
                          );
                        }))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={cn('px-5 py-2.5 flex gap-4 text-[10px] font-mono uppercase tracking-wider border-t', theme === 'light' ? 'border-slate-100 text-slate-300' : 'border-white/5 text-white/20')}>
                <span>CP = Breakfast</span><span>MAP = Bfast + Dinner</span><span>AP = All Meals</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── City Hotels View (Quotation Tool) ───────────────────────────────────────

type SortMode = 'price-asc' | 'price-desc' | 'name';

const FilterPill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => {
  const { theme } = useTheme();
  return (
    <button onClick={onClick}
      className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border',
        active
          ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
          : theme === 'light'
            ? 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
            : 'bg-white/5 border-white/10 text-white/50 hover:border-blue-400/40 hover:text-white'
      )}>
      {children}
    </button>
  );
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle}
      className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600'
      )}>
      {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
    </button>
  );
};

const CityView: React.FC<{
  cityName: string;
  cityRates: HotelRate[];
  onBack: () => void;
  onSelectHotel: (name: string) => void;
}> = ({ cityName, cityRates, onBack, onSelectHotel }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  // Filter state
  const [dayType,      setDayType]      = useState<'Weekday' | 'Weekend'>('Weekday');
  const [occupancy,    setOccupancy]    = useState<'Single' | 'Double' | 'Triple'>('Double');
  const [plan,         setPlan]         = useState<'CP' | 'MAP' | 'AP'>('CP');
  const [sortMode,     setSortMode]     = useState<SortMode>('price-asc');
  const [hideNoRate,   setHideNoRate]   = useState(false);
  // Per-hotel selected room category
  const [selCats, setSelCats] = useState<Record<string, string>>({});

  // Build hotel list
  const hotelNames = useMemo(() => Array.from(new Set(cityRates.map(r => r.HOTEL))), [cityRates]);

  const getRate = (row: HotelRate): number | null => {
    const otherDay = dayType === 'Weekday' ? 'Weekend' : 'Weekday';
    let raw = row[`${dayType} ${occupancy} ${plan}`];
    // Always fall back to the other day type if this one is empty
    if (!raw || raw.trim() === '')
      raw = row[`${otherDay} ${occupancy} ${plan}`];
    if (!raw || raw.trim() === '') return null;
    const num = Number(raw.replace(/,/g, '').trim());
    return isNaN(num) ? null : num;
  };

  const hotels = useMemo(() => hotelNames.map(name => {
    const rows = cityRates.filter(r => r.HOTEL === name);
    // Selected category for this hotel (default to first)
    const activeCat = selCats[name] || rows[0]?.['ROOM CATEGORY'] || '';
    const activeRow = rows.find(r => r['ROOM CATEGORY'] === activeCat) || rows[0];
    const rate = activeRow ? getRate(activeRow) : null;
    // Best rate across all categories for this combo
    const bestRate = rows.reduce((best, row) => {
      const r = getRate(row);
      if (r !== null && (best === null || r < best)) return r;
      return best;
    }, null as number | null);
    return { name, rows, activeCat, activeRow, rate, bestRate };
  }), [hotelNames, cityRates, dayType, occupancy, plan, selCats]);

  const visibleHotels = useMemo(() => {
    let list = hideNoRate ? hotels.filter(h => h.bestRate !== null) : hotels;
    return list.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      const ra = a.bestRate ?? Infinity;
      const rb = b.bestRate ?? Infinity;
      return sortMode === 'price-asc' ? ra - rb : rb - ra;
    });
  }, [hotels, sortMode, hideNoRate]);

  const noRateCount = hotels.length - hotels.filter(h => h.bestRate !== null).length;

  const cardBg = theme === 'light'
    ? 'bg-white border-slate-200'
    : 'bg-white/5 border-white/10';

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className={cn('p-2 rounded-xl border transition-colors shrink-0',
            theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/5 border-white/10 hover:bg-white/10')}>
          <ArrowLeft size={16} className={getSecondaryTextColor()} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={cn('text-2xl font-bold font-serif', getTextColor())}>{cityName}</h2>
          <p className={cn('text-[11px] mt-0.5', getSecondaryTextColor())}>
            {visibleHotels.length} of {hotels.length} properties
            {noRateCount > 0 && !hideNoRate && <span className="text-amber-500 ml-1.5">· {noRateCount} on request</span>}
          </p>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={cn('rounded-2xl border p-4 space-y-3', theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/3 border-white/10')}>
        <div className="flex items-center gap-2 mb-1">
          <Filter size={12} className="text-blue-500" />
          <span className={cn('text-[10px] font-mono uppercase tracking-widest font-bold opacity-50', getTextColor())}>Filter Rates</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Day Type */}
          <div className="space-y-1.5">
            <p className={cn('text-[9px] font-mono uppercase tracking-widest opacity-40', getTextColor())}>Day</p>
            <div className="flex gap-1.5">
              <FilterPill active={dayType === 'Weekday'} onClick={() => setDayType('Weekday')}><Sun size={10} className="inline mr-1" />Weekday</FilterPill>
              <FilterPill active={dayType === 'Weekend'} onClick={() => setDayType('Weekend')}><Moon size={10} className="inline mr-1" />Weekend</FilterPill>
            </div>
          </div>

          {/* Occupancy */}
          <div className="space-y-1.5">
            <p className={cn('text-[9px] font-mono uppercase tracking-widest opacity-40', getTextColor())}>Occupancy</p>
            <div className="flex gap-1.5">
              {(['Single','Double','Triple'] as const).map(o => (
                <FilterPill key={o} active={occupancy === o} onClick={() => setOccupancy(o)}>{o}</FilterPill>
              ))}
            </div>
          </div>

          {/* Meal Plan */}
          <div className="space-y-1.5">
            <p className={cn('text-[9px] font-mono uppercase tracking-widest opacity-40', getTextColor())}>Meal Plan</p>
            <div className="flex gap-1.5">
              {(['CP','MAP','AP'] as const).map(p => (
                <FilterPill key={p} active={plan === p} onClick={() => setPlan(p)}>
                  {p === 'CP' ? 'CP · Bfast' : p === 'MAP' ? 'MAP · Bfast+Din' : 'AP · All Meals'}
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-1.5">
            <p className={cn('text-[9px] font-mono uppercase tracking-widest opacity-40', getTextColor())}>Sort</p>
            <div className="flex gap-1.5">
              <FilterPill active={sortMode === 'price-asc'} onClick={() => setSortMode('price-asc')}><SortAsc size={10} className="inline mr-1" />Cheapest</FilterPill>
              <FilterPill active={sortMode === 'price-desc'} onClick={() => setSortMode('price-desc')}><SortDesc size={10} className="inline mr-1" />Expensive</FilterPill>
              <FilterPill active={sortMode === 'name'} onClick={() => setSortMode('name')}>A–Z</FilterPill>
            </div>
          </div>
        </div>

        {/* Hide on request toggle */}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => setHideNoRate(!hideNoRate)}
            className={cn('w-8 h-4 rounded-full transition-all relative border',
              hideNoRate ? 'bg-blue-500 border-blue-500' : theme === 'light' ? 'bg-slate-200 border-slate-300' : 'bg-white/10 border-white/20')}>
            <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all', hideNoRate ? 'left-4' : 'left-0.5')} />
          </button>
          <span className={cn('text-[11px] font-medium', getSecondaryTextColor())}>Hide "On Request" hotels</span>
          {noRateCount > 0 && <span className="text-[10px] text-amber-500 font-mono">({noRateCount} hidden)</span>}
        </div>
      </div>

      {/* Active filter summary */}
      <div className={cn('flex items-center gap-2 text-[11px] px-1', getSecondaryTextColor())}>
        <span className="opacity-50">Showing rates for:</span>
        <span className={cn('px-2 py-0.5 rounded-md font-bold text-blue-600', theme === 'light' ? 'bg-blue-50' : 'bg-blue-500/10')}>
          {dayType} · {occupancy} · {plan}
        </span>
        <span className="opacity-30">— click a hotel to see full rate table</span>
      </div>

      {/* Hotel Cards */}
      {visibleHotels.length === 0 ? (
        <div className="py-12 text-center opacity-40 flex flex-col items-center gap-2">
          <EyeOff size={28} className="opacity-30" />
          <p className={cn('text-sm font-medium', getTextColor())}>All hotels hidden</p>
          <button onClick={() => setHideNoRate(false)} className="text-blue-500 text-xs underline">Show all</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleHotels.map((hotel, i) => {
            const hasRate = hotel.bestRate !== null;
            const displayRate = hotel.rate;
            const copyText = displayRate
              ? `${hotel.name} (${hotel.activeCat}) — ${dayType} ${occupancy} ${plan}: ₹${displayRate.toLocaleString('en-IN')}`
              : `${hotel.name} — Rate on Request`;

            return (
              <div key={hotel.name}
                className={cn('rounded-2xl border overflow-hidden transition-all duration-200', cardBg,
                  hasRate ? (theme === 'light' ? 'hover:border-blue-300 hover:shadow-md' : 'hover:border-blue-400/40') : 'opacity-60'
                )}>

                {/* Card header */}
                <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b',
                  theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && sortMode === 'price-asc' && hasRate && (
                        <TrendingUp size={11} className="text-emerald-500 shrink-0" />
                      )}
                      <span className={cn('font-bold text-sm', getTextColor())}>{hotel.name}</span>
                    </div>
                    {/* Room category pills */}
                    {hotel.rows.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {hotel.rows.map(row => (
                          <button
                            key={row['ROOM CATEGORY']}
                            onClick={e => { e.stopPropagation(); setSelCats(p => ({ ...p, [hotel.name]: row['ROOM CATEGORY'] })); }}
                            className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all',
                              hotel.activeCat === row['ROOM CATEGORY']
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : theme === 'light'
                                  ? 'bg-slate-100 border-slate-200 text-slate-500 hover:border-blue-300'
                                  : 'bg-white/5 border-white/10 text-white/40 hover:border-blue-400/30'
                            )}>
                            {row['ROOM CATEGORY']}
                          </button>
                        ))}
                      </div>
                    )}
                    {hotel.rows.length === 1 && (
                      <p className={cn('text-[10px] mt-1 opacity-40', getSecondaryTextColor())}>{hotel.activeCat}</p>
                    )}
                  </div>
                </div>

                {/* Rate + actions */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    {displayRate !== null ? (
                      <>
                        <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600">
                          ₹{displayRate.toLocaleString('en-IN')}
                        </p>
                        <p className={cn('text-[10px] mt-0.5 opacity-50', getSecondaryTextColor())}>per room per night</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-amber-500 flex items-center gap-1.5">
                        <Info size={13} /> On Request
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <CopyButton text={copyText} />
                    <button
                      onClick={() => onSelectHotel(hotel.name)}
                      className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all',
                        theme === 'light'
                          ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-700'
                          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                      )}>
                      Full Rates <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const BlockedRates = () => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const [rates,    setRates]    = useState<HotelRate[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [view,     setView]     = useState<'home' | 'city' | 'hotel'>('home');
  const [selCity,  setSelCity]  = useState('');
  const [selHotel, setSelHotel] = useState('');
  const [backLabel, setBackLabel] = useState('');

  const loadRates = () => {
    setLoading(true); setError(null);
    Papa.parse(CSV_URL, {
      download: true, header: true, skipEmptyLines: 'greedy',
      transformHeader: h => h.replace(/[\u00A0\s]+/g, ' ').trim(),
      transform: v => v.trim(),
      complete: res => { setRates(res.data as HotelRate[]); setLoading(false); },
      error: err => { setError(err.message); setLoading(false); },
    });
  };

  useEffect(() => { loadRates(); }, []);

  const allCities = useMemo(() => Array.from(new Set(rates.map(r => r.City).filter(Boolean))).sort(), [rates]);

  // Top 10 featured (those present in sheet, in preferred order)
  const featuredCities = useMemo(() =>
    FEATURED_CITIES.filter(c => allCities.includes(c)).slice(0, 10), [allCities]);

  // All unique hotels with cheapest rate
  const allHotels = useMemo(() => {
    const names = Array.from(new Set(rates.map(r => r.HOTEL).filter(Boolean)));
    return names.map(name => {
      const rows = rates.filter(r => r.HOTEL === name);
      return { name, city: rows[0]?.City || '', cheapestInfo: getCheapestRateInfo(rows) };
    }).sort((a, b) => {
      if (!a.cheapestInfo) return 1;
      if (!b.cheapestInfo) return -1;
      return a.cheapestInfo.rate - b.cheapestInfo.rate;
    });
  }, [rates]);


  const hotelRows = useMemo(() => rates.filter(r => r.City === selCity && r.HOTEL === selHotel), [rates, selCity, selHotel]);

  // Search across cities + hotels
  const isSearching = search.trim().length > 0;
  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return { cities: [] as string[], hotels: [] as typeof allHotels };
    return {
      cities: allCities.filter(c => c.toLowerCase().includes(q)),
      hotels: allHotels.filter(h => h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)),
    };
  }, [search, allCities, allHotels]);

  const goToCity  = (city: string) => { setSelCity(city); setView('city'); setSearch(''); };
  const goToHotel = (city: string, name: string, label: string) => { setSelCity(city); setSelHotel(name); setBackLabel(label); setView('hotel'); setSearch(''); };

  const headerBg = theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/10';
  const inputBg  = theme === 'light' ? 'bg-slate-50 border-slate-200 focus-within:border-blue-400 focus-within:bg-white' : 'bg-white/5 border-white/10 focus-within:border-blue-400';
  const cityCard = theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-white/5 border-white/10 hover:border-blue-400/40 hover:bg-white/8';
  const hotelCard = theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-white/5 border-white/10 hover:border-blue-400/40 hover:bg-white/8';

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-20 max-w-6xl mx-auto">

      {/* Header */}
      <div className={cn('flex items-center justify-between px-5 py-4 rounded-2xl border', headerBg)}>
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-xl', theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300')}>
            <Building2 size={19} />
          </div>
          <div>
            <h1 className={cn('text-lg font-bold font-serif', getTextColor())}>Blocked Hotel Rates</h1>
            <p className={cn('text-[11px] mt-0.5', getSecondaryTextColor())}>
              {loading ? 'Syncing from Google Sheets…' : `${allHotels.length} hotels · ${allCities.length} cities`}
            </p>
          </div>
        </div>
        <button onClick={loadRates} title="Refresh"
          className={cn('p-2 rounded-xl border transition-colors', theme === 'light' ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5')}>
          <RefreshCw size={14} className={cn(loading ? 'animate-spin text-blue-500' : getSecondaryTextColor())} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-3">
          <Info size={15} className="shrink-0" />
          Failed to load. Make sure the sheet is published to the web (File → Share → Publish to web).
        </div>
      )}

      {/* Detail views */}
      {view === 'city'  && <CityView cityName={selCity} cityRates={rates.filter(r => r.City === selCity)} onBack={() => setView('home')} onSelectHotel={name => goToHotel(selCity, name, selCity)} />}
      {view === 'hotel' && <HotelView hotelName={selHotel} rows={hotelRows} onBack={() => view === 'hotel' && setView(backLabel ? 'city' : 'home')} backLabel={backLabel} />}

      {/* Home view */}
      {view === 'home' && (
        <div className="space-y-8">

          {/* Search */}
          <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border transition-all', inputBg)}>
            <Search size={15} className="opacity-40 shrink-0" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search city or hotel…"
              className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:opacity-40" />
            {search && <button onClick={() => setSearch('')} className="text-[10px] opacity-40 hover:opacity-70 font-mono uppercase tracking-wider">Clear</button>}
          </div>

          {/* ── Search results ── */}
          {isSearching && (
            <div className="space-y-6">
              {searchResults.cities.length > 0 && (
                <div>
                  <SectionLabel icon={<MapPin size={12} className="text-blue-500" />} label={`Cities (${searchResults.cities.length})`} getTextColor={getTextColor} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                    {searchResults.cities.map(city => {
                      const count = Array.from(new Set(rates.filter(r => r.City === city).map(r => r.HOTEL))).length;
                      return (
                        <button key={city} onClick={() => goToCity(city)}
                          className={cn('group text-left px-3 py-3 rounded-xl border transition-all', cityCard)}>
                          <MapPin size={12} className="text-blue-500 mb-1.5" />
                          <p className={cn('font-bold text-sm', getTextColor())}>{city}</p>
                          <p className={cn('text-[10px] opacity-40 mt-0.5', getSecondaryTextColor())}>{count} hotel{count !== 1 ? 's' : ''}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {searchResults.hotels.length > 0 && (
                <div>
                  <SectionLabel icon={<Hotel size={12} className="text-blue-500" />} label={`Hotels (${searchResults.hotels.length})`} getTextColor={getTextColor} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                    {searchResults.hotels.map(hotel => (
                      <button key={hotel.name} onClick={() => goToHotel(hotel.city, hotel.name, hotel.city)}
                        className={cn('group text-left p-4 rounded-xl border transition-all', hotelCard)}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-bold text-sm truncate', getTextColor())}>{hotel.name}</p>
                            <div className={cn('flex items-center gap-1 text-xs mt-0.5', getSecondaryTextColor())}>
                              <MapPin size={9} className="text-blue-400" />{hotel.city}
                              {hotel.cheapestInfo && <span className="text-emerald-600 font-bold ml-1.5 font-mono">₹{hotel.cheapestInfo.rate.toLocaleString('en-IN')}</span>}
                            </div>
                          </div>
                          <ChevronRight size={13} className="opacity-30 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.cities.length === 0 && searchResults.hotels.length === 0 && (
                <div className="py-16 text-center opacity-40 flex flex-col items-center gap-3">
                  <Search size={32} className="opacity-30" />
                  <p className={cn('font-medium text-sm', getTextColor())}>No results for "{search}"</p>
                </div>
              )}
            </div>
          )}

          {/* ── Default home content ── */}
          {!isSearching && (
            <>
              {/* ── Section 1: Top 10 Destinations ── */}
              <div>
                <SectionLabel icon={<Sparkles size={12} className="text-amber-500" />} label="Top 10 Destinations" getTextColor={getTextColor} />
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20" style={{ animationDelay: `${i * 50}ms` }} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                    {featuredCities.map((city, i) => {
                      const count = Array.from(new Set(rates.filter(r => r.City === city).map(r => r.HOTEL))).length;
                      const cheapest = getCheapestRateInfo(rates.filter(r => r.City === city));
                      return (
                        <button key={city} onClick={() => goToCity(city)}
                          className={cn('group text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-lg', cityCard)}>
                          {i < 3 && (
                            <span className={cn('absolute top-2.5 right-2.5 text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold border',
                              i === 0 ? 'bg-amber-100 text-amber-700 border-amber-300' :
                              i === 1 ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                        'bg-orange-100 text-orange-700 border-orange-200'
                            )}>
                              #{i + 1}
                            </span>
                          )}
                          <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
                            i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-400' : 'bg-blue-300'
                          )} />
                          <MapPin size={14} className="text-blue-500 mb-2" />
                          <p className={cn('font-bold text-sm', getTextColor())}>{city}</p>
                          <p className={cn('text-[10px] mt-1 opacity-50', getSecondaryTextColor())}>{count} hotel{count !== 1 ? 's' : ''}</p>
                          {cheapest && (
                            <p className="text-[11px] font-mono font-bold text-emerald-600 mt-1">
                              ₹{cheapest.rate.toLocaleString('en-IN')}+
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Section 2: All Hotels ── */}
              <div>
                <SectionLabel
                  icon={<Hotel size={12} className="text-blue-500" />}
                  label={loading ? 'All Hotels' : `All Hotels (${allHotels.length})`}
                  getTextColor={getTextColor}
                />
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                    {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-16" style={{ animationDelay: `${i * 30}ms` }} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                    {allHotels.map((hotel, i) => (
                      <button key={`${hotel.name}-${hotel.city}`}
                        onClick={() => goToHotel(hotel.city, hotel.name, hotel.city)}
                        className={cn('group text-left p-3.5 rounded-xl border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md', hotelCard)}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {i === 0 && <Star size={10} className="text-amber-500 fill-amber-400 shrink-0" />}
                              <p className={cn('font-semibold text-sm truncate', getTextColor())}>{hotel.name}</p>
                            </div>
                            <div className={cn('flex items-center gap-2 mt-0.5 text-[11px]', getSecondaryTextColor())}>
                              <span className="flex items-center gap-0.5 opacity-50"><MapPin size={9} />{hotel.city}</span>
                              {hotel.cheapestInfo
                                ? <span className="font-bold font-mono text-emerald-600">₹{hotel.cheapestInfo.rate.toLocaleString('en-IN')}</span>
                                : <span className="italic opacity-30">On request</span>}
                            </div>
                          </div>
                          <ChevronRight size={13} className="opacity-20 shrink-0 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Section Label Helper ─────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string; getTextColor: () => string }> = ({ icon, label, getTextColor }) => (
  <div className="flex items-center gap-2">
    {icon}
    <p className={cn('text-[10px] font-mono uppercase tracking-widest font-bold opacity-40', getTextColor())}>{label}</p>
    <div className="flex-1 h-px bg-current opacity-5" />
  </div>
);
