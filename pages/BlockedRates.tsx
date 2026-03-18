
import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { PageLoader } from '../components/ui/PageLoader';
import {
  Search, Building2, MapPin, ArrowLeft, ChevronRight,
  Calculator, Calendar, Users, Info, RefreshCw, BedDouble,
  Utensils, Sun, Moon
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzauWqedtFb20pNpcXKOY8ahW4pmWDjo5n5TBaKGIBcTL6ZosoTINPHz3nivFsKPXstXEPO4ciI5Lm/pub?output=csv';

const PLAN_TYPES  = ['CP', 'MAP', 'AP'] as const;
const DAY_TYPES   = ['Weekday', 'Weekend'] as const;
const OCC_TYPES   = ['Single', 'Double', 'Triple'] as const;

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
  let cheapest = Infinity;
  let label = '';
  rows.forEach(r => {
    const cat = (r['ROOM CATEGORY'] || '').toUpperCase();
    if (cat.includes('CNB') || cat.includes('CWB') || cat.includes('CHILD')) return;
    PLAN_TYPES.forEach(plan =>
      DAY_TYPES.forEach(day =>
        OCC_TYPES.forEach(occ => {
          const key = `${day} ${occ} ${plan}`;
          const val = r[key];
          if (val && val.trim() !== '' && !isNaN(Number(val.replace(/,/g, '')))) {
            const num = Number(val.replace(/,/g, ''));
            if (num < cheapest) { cheapest = num; label = `${occ} ${plan}`; }
          }
        })
      )
    );
  });
  return cheapest === Infinity ? null : { rate: cheapest, label };
};

const calculateQuote = (
  hotelData: HotelRate,
  checkIn: string,
  checkOut: string,
  pax: number,
  plan: string
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

  let totalCost = 0;
  let hasInvalidRate = false;
  const nightDetails = [];

  for (let i = 0; i < nights; i++) {
    const d = new Date(ci); d.setDate(ci.getDate() + i);
    const dow = d.getDay();
    let isWeekend = sameRates ? false : monThu ? (dow === 5 || dow === 6 || dow === 0) : (dow === 5 || dow === 6);
    const dayType = isWeekend ? 'Weekend' : 'Weekday';
    let rateStr = hotelData[`${dayType} ${occupancy} ${plan}`];
    if (sameRates && (!rateStr || rateStr.trim() === '')) {
      rateStr = hotelData[`${isWeekend ? 'Weekday' : 'Weekend'} ${occupancy} ${plan}`];
    }
    const clean = rateStr ? rateStr.replace(/,/g, '').trim() : '';
    const rate = clean && !isNaN(Number(clean)) ? Number(clean) : NaN;
    if (isNaN(rate)) hasInvalidRate = true;
    totalCost += isNaN(rate) ? 0 : rate;
    nightDetails.push({ date: d.toLocaleDateString('en-IN'), type: dayType, rate: isNaN(rate) ? 'On Request' : rate });
  }

  return { nights, totalCost, occupancy, hasInvalidRate, nightDetails };
};

// ─── Sub-views ────────────────────────────────────────────────────────────────

// Hotel detail with rate table + quote calculator
const HotelView: React.FC<{
  hotelName: string;
  rows: HotelRate[];
  onBack: () => void;
}> = ({ hotelName, rows, onBack }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const [checkIn,  setCheckIn]  = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [pax,      setPax]      = useState(2);
  const [plan,     setPlan]     = useState('CP');
  const [roomCat,  setRoomCat]  = useState(rows[0]?.['ROOM CATEGORY'] || '');

  const selectedRow = useMemo(() => rows.find(r => r['ROOM CATEGORY'] === roomCat) || rows[0], [rows, roomCat]);
  const calculation = useMemo(() => calculateQuote(selectedRow, checkIn, checkOut, pax, plan), [selectedRow, checkIn, checkOut, pax, plan]);

  const cardBg  = theme === 'light' ? 'bg-white border-slate-200'          : 'bg-white/5 border-white/10';
  const headBg  = theme === 'light' ? 'bg-slate-50 border-b border-slate-100' : 'bg-white/5 border-b border-white/10';
  const inputCls = cn(
    'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
    theme === 'light' ? 'bg-white border-slate-200 focus:border-blue-400' : 'bg-white/10 border-white/10 text-white focus:border-blue-400'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className={cn('p-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/5 border-white/10 hover:bg-white/10')}
        >
          <ArrowLeft size={16} className={getSecondaryTextColor()} />
        </button>
        <div>
          <h2 className={cn('text-2xl font-bold font-serif', getTextColor())}>{hotelName}</h2>
          <p className={cn('text-xs mt-0.5', getSecondaryTextColor())}>{rows[0]?.City}</p>
        </div>
      </div>

      {/* Remarks */}
      {rows[0]?.Remarks && (
        <div className={cn('flex items-start gap-3 p-4 rounded-xl border', theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-300')}>
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-sm">{rows[0].Remarks}</p>
        </div>
      )}

      {/* Quote Calculator */}
      <Card className={cn('border', theme === 'light' ? 'bg-slate-900' : 'bg-slate-800')}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Calculator size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Quick Quote Calculator</h3>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Instant rate estimate</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5"><Calendar size={11} /> Check-In</label>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5"><Calendar size={11} /> Check-Out</label>
            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5"><Users size={11} /> Occupancy</label>
            <select value={pax} onChange={e => setPax(Number(e.target.value))}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400 transition-colors appearance-none">
              <option value={1} className="bg-slate-900">Single</option>
              <option value={2} className="bg-slate-900">Double</option>
              <option value={3} className="bg-slate-900">Triple</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5"><BedDouble size={11} /> Room Type</label>
            <select value={roomCat} onChange={e => setRoomCat(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400 transition-colors appearance-none">
              {rows.map(r => (
                <option key={r['ROOM CATEGORY']} value={r['ROOM CATEGORY']} className="bg-slate-900">
                  {r['ROOM CATEGORY']}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex gap-2">
            {PLAN_TYPES.map(p => (
              <button key={p} onClick={() => setPlan(p)}
                className={cn('px-5 py-2 rounded-xl text-[10px] font-mono uppercase font-bold tracking-widest transition-all border',
                  plan === p ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                )}>
                {p}
              </button>
            ))}
          </div>

          {calculation && (
            <div className="text-right">
              {calculation.hasInvalidRate ? (
                <div className="text-amber-400 text-sm font-medium flex items-center gap-2">
                  <Info size={14} /> Rate on Request
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-mono uppercase text-white/30 tracking-widest">Estimated Total</p>
                  <p className="text-3xl font-bold font-mono text-white">
                    ₹{calculation.totalCost.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[10px] text-white/30 font-mono">
                    {calculation.nights} night{calculation.nights !== 1 ? 's' : ''} · {calculation.occupancy}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Rate Tables per room category */}
      <div className="space-y-5">
        {rows.map((category, idx) => {
          const remarks = (category.Remarks || '').toLowerCase();
          const isMonThu = remarks.includes('mon-thu') && remarks.includes('fri-sun');
          const wdLabel = isMonThu ? 'Weekday (Mon–Thu)' : 'Weekday';
          const weLabel = isMonThu ? 'Weekend (Fri–Sun)' : 'Weekend';

          return (
            <div key={idx} className={cn('rounded-2xl border overflow-hidden', cardBg)}>
              {/* Room category header */}
              <div className={cn('flex items-center justify-between px-5 py-4', headBg)}>
                <div className="flex items-center gap-2">
                  <BedDouble size={15} className="text-blue-500 shrink-0" />
                  <span className={cn('font-bold text-sm', getTextColor())}>{category['ROOM CATEGORY'] || 'Standard'}</span>
                </div>
                <button
                  onClick={() => setRoomCat(category['ROOM CATEGORY'])}
                  className="text-[10px] text-blue-500 font-mono uppercase tracking-wider font-bold hover:underline flex items-center gap-1"
                >
                  Calculate <Calculator size={10} />
                </button>
              </div>

              {/* Rate table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className={cn('text-[10px] font-mono uppercase tracking-wider', theme === 'light' ? 'bg-slate-50 text-slate-400' : 'bg-white/5 text-white/30')}>
                      <th className="px-5 py-3 text-left font-bold border-r border-slate-100 dark:border-white/5">Plan</th>
                      <th className="px-3 py-3 text-center font-bold" colSpan={3}>
                        <span className="flex items-center justify-center gap-1"><Sun size={11} />{wdLabel}</span>
                      </th>
                      <th className="px-3 py-3 text-center font-bold" colSpan={3}>
                        <span className="flex items-center justify-center gap-1"><Moon size={11} />{weLabel}</span>
                      </th>
                    </tr>
                    <tr className={cn('text-[9px] font-mono uppercase tracking-widest border-b', theme === 'light' ? 'text-slate-400 border-slate-100' : 'text-white/20 border-white/5')}>
                      <th className="px-5 py-2 text-left border-r border-slate-100 dark:border-white/5"></th>
                      {['Single', 'Double', 'Triple', 'Single', 'Double', 'Triple'].map((o, i) => (
                        <th key={i} className="px-3 py-2 text-center">{o}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', theme === 'light' ? 'divide-slate-50' : 'divide-white/5')}>
                    {PLAN_TYPES.map(p => (
                      <tr key={p} className={cn('transition-colors', theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                        <td className={cn('px-5 py-4 border-r', theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Utensils size={11} />
                            </div>
                            <span className={cn('font-bold text-xs', getTextColor())}>{p}</span>
                          </div>
                        </td>
                        {DAY_TYPES.map(day =>
                          OCC_TYPES.map(occ => {
                            const key = `${day} ${occ} ${p}`;
                            let raw = category[key];
                            const sameR = (category.Remarks || '').toLowerCase().includes('w/d & w/e same');
                            if (sameR && (!raw || raw.trim() === '')) {
                              const other = day === 'Weekday' ? 'Weekend' : 'Weekday';
                              raw = category[`${other} ${occ} ${p}`];
                            }
                            const display = formatRate(raw);
                            const numeric = isNumericRate(display);
                            return (
                              <td key={key} className={cn('px-3 py-4 text-center', !numeric && (theme === 'light' ? 'bg-slate-50/50' : 'bg-white/2'))}>
                                {numeric ? (
                                  <span className={cn('font-mono font-bold text-sm', getTextColor())}>
                                    ₹{Number(display.replace(/,/g, '')).toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className={cn('text-[10px] italic', getSecondaryTextColor())}>{display}</span>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className={cn('px-5 py-3 flex gap-4 text-[10px] font-mono uppercase tracking-wider border-t', theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-white/5 text-white/30')}>
                <span>CP: Breakfast</span>
                <span>MAP: Bfast + Dinner</span>
                <span>AP: All Meals</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// City view – hotels list
const CityView: React.FC<{
  cityName: string;
  hotels: { name: string; cheapestInfo: { rate: number; label: string } | null }[];
  onBack: () => void;
  onSelectHotel: (name: string) => void;
}> = ({ cityName, hotels, onBack, onSelectHotel }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const cardBg = theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg' : 'bg-white/5 border-white/10 hover:border-blue-400/30 hover:bg-white/10';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className={cn('p-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/5 border-white/10 hover:bg-white/10')}>
          <ArrowLeft size={16} className={getSecondaryTextColor()} />
        </button>
        <div>
          <h2 className={cn('text-2xl font-bold font-serif', getTextColor())}>{cityName}</h2>
          <p className={cn('text-xs mt-0.5', getSecondaryTextColor())}>{hotels.length} propert{hotels.length === 1 ? 'y' : 'ies'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hotels.map(hotel => (
          <button key={hotel.name} onClick={() => onSelectHotel(hotel.name)}
            className={cn('group text-left p-5 rounded-2xl border transition-all duration-200', cardBg)}>
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={14} className="text-blue-500 shrink-0" />
                  <span className={cn('font-bold text-sm truncate', getTextColor())}>{hotel.name}</span>
                </div>
                <p className={cn('text-xs mt-2', getSecondaryTextColor())}>
                  {hotel.cheapestInfo
                    ? <>Starting ₹<span className="font-bold font-mono text-emerald-600">{hotel.cheapestInfo.rate.toLocaleString('en-IN')}</span> · {hotel.cheapestInfo.label}</>
                    : 'Rate on request'}
                </p>
              </div>
              <ChevronRight size={16} className={cn('shrink-0 ml-3 mt-1 transition-transform group-hover:translate-x-1', getSecondaryTextColor())} />
            </div>
          </button>
        ))}
      </div>
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
  const [view,     setView]     = useState<'cities' | 'city' | 'hotel'>('cities');
  const [selCity,  setSelCity]  = useState('');
  const [selHotel, setSelHotel] = useState('');

  const loadRates = () => {
    setLoading(true); setError(null);
    Papa.parse(CSV_URL, {
      download: true, header: true, skipEmptyLines: 'greedy',
      transformHeader: (h) => h.replace(/[\u00A0\s]+/g, ' ').trim(),
      transform: (v) => v.trim(),
      complete: (res) => { setRates(res.data as HotelRate[]); setLoading(false); },
      error: (err)    => { setError(err.message); setLoading(false); }
    });
  };

  useEffect(() => { loadRates(); }, []);

  // Derived data
  const cities = useMemo(() => Array.from(new Set(rates.map(r => r.City).filter(Boolean))).sort(), [rates]);

  const filteredCities = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cities;
    return cities.filter(c => c.toLowerCase().includes(q));
  }, [cities, search]);

  const hotelsInCity = useMemo(() => {
    if (!selCity) return [];
    const cityRates = rates.filter(r => r.City === selCity);
    const hotelNames = Array.from(new Set(cityRates.map(r => r.HOTEL)));
    return hotelNames.map(name => ({
      name,
      cheapestInfo: getCheapestRateInfo(cityRates.filter(r => r.HOTEL === name))
    }));
  }, [rates, selCity]);

  const hotelRows = useMemo(() =>
    rates.filter(r => r.City === selCity && r.HOTEL === selHotel),
    [rates, selCity, selHotel]
  );

  const handleSelectCity = (city: string) => { setSelCity(city); setView('city'); };
  const handleSelectHotel = (name: string) => { setSelHotel(name); setView('hotel'); };
  const handleBackToCity = () => setView('city');
  const handleBackToCities = () => { setView('cities'); setSelCity(''); };

  // ── Render ────────────────────────────────────────────────────────────────

  const headerBg = theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10';
  const cardBg   = theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-white/5 border-white/10 hover:border-blue-400/30 hover:bg-white/10';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-6xl mx-auto">

      {/* Page Header */}
      <div className={cn('flex items-center justify-between px-6 py-4 rounded-2xl border', headerBg)}>
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300')}>
            <Building2 size={20} />
          </div>
          <div>
            <h1 className={cn('text-xl font-bold font-serif', getTextColor())}>Blocked Hotel Rates</h1>
            <p className={cn('text-xs mt-0.5', getSecondaryTextColor())}>
              {loading ? 'Loading…' : `${rates.length} entries across ${cities.length} cities`}
            </p>
          </div>
        </div>
        <button onClick={loadRates} title="Refresh"
          className={cn('p-2 rounded-lg border transition-colors', theme === 'light' ? 'border-slate-200 hover:bg-slate-50 text-slate-500' : 'border-white/10 hover:bg-white/5 text-white/40')}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <PageLoader />}

      {error && (
        <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-3">
          <Info size={16} className="shrink-0" />
          <span>Failed to load rates: {error}. Make sure the sheet is published to the web.</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* City list view */}
          {view === 'cities' && (
            <div className="space-y-6">
              {/* Search */}
              <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                <Search size={16} className="opacity-40 shrink-0" />
                <input
                  type="text" placeholder="Search city or hotel…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:opacity-40"
                />
              </div>

              {/* City grid */}
              {filteredCities.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-3 opacity-40">
                  <MapPin size={40} className="opacity-50" />
                  <p className={cn('font-medium', getTextColor())}>No cities found for "{search}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredCities.map(city => {
                    const count = Array.from(new Set(rates.filter(r => r.City === city).map(r => r.HOTEL))).length;
                    return (
                      <button key={city} onClick={() => handleSelectCity(city)}
                        className={cn('group text-left p-4 rounded-xl border transition-all duration-200', cardBg)}>
                        <MapPin size={14} className="text-blue-500 mb-2" />
                        <p className={cn('font-bold text-sm truncate', getTextColor())}>{city}</p>
                        <p className={cn('text-[11px] mt-1', getSecondaryTextColor())}>
                          {count} hotel{count !== 1 ? 's' : ''}
                        </p>
                        <ChevronRight size={12} className={cn('mt-2 transition-transform group-hover:translate-x-1 opacity-40', getSecondaryTextColor())} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* City hotels view */}
          {view === 'city' && (
            <CityView
              cityName={selCity}
              hotels={hotelsInCity}
              onBack={handleBackToCities}
              onSelectHotel={handleSelectHotel}
            />
          )}

          {/* Hotel detail view */}
          {view === 'hotel' && (
            <HotelView
              hotelName={selHotel}
              rows={hotelRows}
              onBack={handleBackToCity}
            />
          )}
        </>
      )}
    </div>
  );
};
