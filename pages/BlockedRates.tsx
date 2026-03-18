
import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import {
  Search, Building2, MapPin, ArrowLeft, ChevronRight,
  Calculator, Calendar, Users, Info, RefreshCw, BedDouble,
  Utensils, Sun, Moon, Star, Sparkles, TrendingUp
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzauWqedtFb20pNpcXKOY8ahW4pmWDjo5n5TBaKGIBcTL6ZosoTINPHz3nivFsKPXstXEPO4ciI5Lm/pub?output=csv';

const PLAN_TYPES = ['CP', 'MAP', 'AP'] as const;
const DAY_TYPES  = ['Weekday', 'Weekend'] as const;
const OCC_TYPES  = ['Single', 'Double', 'Triple'] as const;

// Popular destinations shown at the top with images
const FEATURED_CITIES = [
  'Agra', 'Jaipur', 'Goa', 'Udaipur', 'Shimla',
  'Manali', 'Darjeeling', 'Varanasi', 'Mysore', 'Ooty',
  'Jodhpur', 'Rishikesh', 'Amritsar', 'Mumbai',
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
    let rateStr = hotelData[`${dayType} ${occupancy} ${plan}`];
    if (sameRates && (!rateStr || rateStr.trim() === ''))
      rateStr = hotelData[`${isWeekend ? 'Weekday' : 'Weekend'} ${occupancy} ${plan}`];
    const clean = rateStr ? rateStr.replace(/,/g, '').trim() : '';
    const rate = clean && !isNaN(Number(clean)) ? Number(clean) : NaN;
    if (isNaN(rate)) hasInvalidRate = true;
    totalCost += isNaN(rate) ? 0 : rate;
    nightDetails.push({ date: d.toLocaleDateString('en-IN'), type: dayType, rate: isNaN(rate) ? 'On Request' : rate });
  }
  return { nights, totalCost, occupancy, hasInvalidRate, nightDetails };
};

// ─── Skeleton Components ──────────────────────────────────────────────────────

const SkeletonFeatured = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="h-32 rounded-2xl bg-slate-200 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
    ))}
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
    {Array.from({ length: 18 }).map((_, i) => (
      <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" style={{ animationDelay: `${i * 30}ms` }} />
    ))}
  </div>
);

// ─── Hotel Detail View ────────────────────────────────────────────────────────

const HotelView: React.FC<{ hotelName: string; rows: HotelRate[]; onBack: () => void }> = ({ hotelName, rows, onBack }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const [checkIn,  setCheckIn]  = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [pax,      setPax]      = useState(2);
  const [plan,     setPlan]     = useState('CP');
  const [roomCat,  setRoomCat]  = useState(rows[0]?.['ROOM CATEGORY'] || '');

  const selectedRow  = useMemo(() => rows.find(r => r['ROOM CATEGORY'] === roomCat) || rows[0], [rows, roomCat]);
  const calculation  = useMemo(() => calculateQuote(selectedRow, checkIn, checkOut, pax, plan), [selectedRow, checkIn, checkOut, pax, plan]);
  const cheapestInfo = useMemo(() => getCheapestRateInfo(rows), [rows]);

  const border = theme === 'light' ? 'border-slate-200' : 'border-white/10';
  const rowHover = theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5';

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
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('text-2xl font-bold font-serif', getTextColor())}>{hotelName}</h2>
            {cheapestInfo && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                From ₹{cheapestInfo.rate.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className={cn('flex items-center gap-1.5 mt-1 text-sm', getSecondaryTextColor())}>
            <MapPin size={13} className="text-blue-500" />
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
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>{rows[0].Remarks}</span>
        </div>
      )}

      {/* Quote Calculator */}
      <div className={cn('rounded-2xl overflow-hidden border', theme === 'light' ? 'bg-slate-900 border-slate-800' : 'bg-slate-800 border-white/10')}>
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Calculator size={17} className="text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Quick Quote Calculator</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Instant rate estimate per stay</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Check-In',  icon: <Calendar size={10} />, content: <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full bg-transparent text-white text-sm outline-none mt-1" /> },
              { label: 'Check-Out', icon: <Calendar size={10} />, content: <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full bg-transparent text-white text-sm outline-none mt-1" /> },
              { label: 'Occupancy', icon: <Users size={10} />, content:
                <select value={pax} onChange={e => setPax(Number(e.target.value))} className="w-full bg-transparent text-white text-sm outline-none mt-1 appearance-none">
                  <option value={1} className="bg-slate-900">Single</option>
                  <option value={2} className="bg-slate-900">Double</option>
                  <option value={3} className="bg-slate-900">Triple</option>
                </select>
              },
              { label: 'Room Type', icon: <BedDouble size={10} />, content:
                <select value={roomCat} onChange={e => setRoomCat(e.target.value)} className="w-full bg-transparent text-white text-sm outline-none mt-1 appearance-none">
                  {rows.map(r => <option key={r['ROOM CATEGORY']} value={r['ROOM CATEGORY']} className="bg-slate-900">{r['ROOM CATEGORY']}</option>)}
                </select>
              },
            ].map(({ label, icon, content }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/30 flex items-center gap-1">{icon} {label}</label>
                {content}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="flex gap-2">
              {PLAN_TYPES.map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className={cn('px-5 py-2 rounded-xl text-[10px] font-mono uppercase font-bold tracking-widest border transition-all',
                    plan === p ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10')}>
                  {p}
                </button>
              ))}
            </div>
            {calculation && (
              <div className="text-right">
                {calculation.hasInvalidRate ? (
                  <p className="text-amber-400 text-sm flex items-center gap-1.5"><Info size={13} /> Rate on Request</p>
                ) : (
                  <div>
                    <p className="text-[10px] font-mono uppercase text-white/30 tracking-widest">Estimated Total</p>
                    <p className="text-3xl font-bold font-mono text-white tracking-tight">₹{calculation.totalCost.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-white/20 font-mono">{calculation.nights} night{calculation.nights !== 1 ? 's' : ''} · {calculation.occupancy}</p>
                  </div>
                )}
              </div>
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
            <div key={idx} className={cn('rounded-2xl border overflow-hidden transition-all', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
              <div className={cn('flex items-center justify-between px-5 py-3.5 border-b', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5')}>
                <div className="flex items-center gap-2">
                  <BedDouble size={14} className="text-blue-500" />
                  <span className={cn('font-bold text-sm', getTextColor())}>{category['ROOM CATEGORY'] || 'Standard'}</span>
                </div>
                <button onClick={() => setRoomCat(category['ROOM CATEGORY'])}
                  className="text-[10px] text-blue-500 font-mono uppercase tracking-wider hover:underline flex items-center gap-1">
                  Use in calculator <Calculator size={9} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className={cn('text-[10px] font-mono uppercase tracking-wider', theme === 'light' ? 'bg-slate-50/80 text-slate-400' : 'bg-white/3 text-white/20')}>
                      <th className={cn('px-4 py-3 text-left font-bold border-r', border)}>Plan</th>
                      <th className="px-3 py-3 text-center font-bold" colSpan={3}>
                        <span className="flex items-center justify-center gap-1"><Sun size={10} />{wdLabel}</span>
                      </th>
                      <th className="px-3 py-3 text-center font-bold" colSpan={3}>
                        <span className="flex items-center justify-center gap-1"><Moon size={10} />{weLabel}</span>
                      </th>
                    </tr>
                    <tr className={cn('text-[9px] font-mono uppercase tracking-widest border-b', theme === 'light' ? 'text-slate-300 border-slate-100' : 'text-white/10 border-white/5')}>
                      <th className={cn('px-4 py-2 border-r', border)}></th>
                      {['Single', 'Double', 'Triple', 'Single', 'Double', 'Triple'].map((o, i) => (
                        <th key={i} className="px-3 py-2 text-center">{o}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', theme === 'light' ? 'divide-slate-50' : 'divide-white/5')}>
                    {PLAN_TYPES.map(p => (
                      <tr key={p} className={cn('transition-colors', rowHover)}>
                        <td className={cn('px-4 py-3.5 border-r', border)}>
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 text-[10px] font-bold flex items-center justify-center">{p}</span>
                          </div>
                        </td>
                        {DAY_TYPES.map(day =>
                          OCC_TYPES.map(occ => {
                            const key = `${day} ${occ} ${p}`;
                            let raw = category[key];
                            if ((category.Remarks || '').toLowerCase().includes('w/d & w/e same') && (!raw || raw.trim() === ''))
                              raw = category[`${day === 'Weekday' ? 'Weekend' : 'Weekday'} ${occ} ${p}`];
                            const display = formatRate(raw);
                            const numeric = isNumericRate(display);
                            return (
                              <td key={key} className="px-3 py-3.5 text-center">
                                {numeric ? (
                                  <span className={cn('font-mono font-bold text-sm', getTextColor())}>
                                    ₹{Number(display.replace(/,/g, '')).toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className={cn('text-[10px] italic opacity-40', getTextColor())}>{display}</span>
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

// ─── City Hotels View ─────────────────────────────────────────────────────────

const CityView: React.FC<{
  cityName: string;
  hotels: { name: string; cheapestInfo: { rate: number; label: string } | null }[];
  onBack: () => void;
  onSelectHotel: (name: string) => void;
}> = ({ cityName, hotels, onBack, onSelectHotel }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  // Sort: cheapest first, "on request" at bottom
  const sorted = useMemo(() =>
    [...hotels].sort((a, b) => {
      if (!a.cheapestInfo && !b.cheapestInfo) return 0;
      if (!a.cheapestInfo) return 1;
      if (!b.cheapestInfo) return -1;
      return a.cheapestInfo.rate - b.cheapestInfo.rate;
    }), [hotels]);

  const topHotel = sorted[0];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className={cn('p-2 rounded-xl border transition-colors',
            theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/5 border-white/10 hover:bg-white/10')}>
          <ArrowLeft size={16} className={getSecondaryTextColor()} />
        </button>
        <div>
          <h2 className={cn('text-2xl font-bold font-serif', getTextColor())}>{cityName}</h2>
          <p className={cn('text-xs mt-0.5', getSecondaryTextColor())}>{hotels.length} propert{hotels.length !== 1 ? 'ies' : 'y'} available</p>
        </div>
      </div>

      {/* Top pick banner */}
      {topHotel?.cheapestInfo && (
        <div
          onClick={() => onSelectHotel(topHotel.name)}
          className="relative overflow-hidden rounded-2xl cursor-pointer group"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(https://picsum.photos/seed/${encodeURIComponent(cityName)}/800/300)`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="relative p-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-200 font-bold">Best Value Pick</span>
              </div>
              <h3 className="text-xl font-bold text-white font-serif">{topHotel.name}</h3>
              <p className="text-blue-200 text-sm mt-1">
                From <span className="text-white font-bold font-mono text-lg">₹{topHotel.cheapestInfo.rate.toLocaleString('en-IN')}</span>
                <span className="text-blue-300 text-xs ml-2">· {topHotel.cheapestInfo.label}</span>
              </p>
            </div>
            <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ChevronRight size={18} className="text-white group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* All hotels */}
      <div>
        <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-3 font-bold opacity-40', getTextColor())}>All Properties</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((hotel, i) => (
            <button key={hotel.name} onClick={() => onSelectHotel(hotel.name)}
              className={cn('group text-left p-4 rounded-xl border transition-all duration-200',
                theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-white/5 border-white/10 hover:border-blue-400/40 hover:bg-white/10')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {i === 0 && <TrendingUp size={11} className="text-emerald-500 shrink-0" />}
                    <span className={cn('font-bold text-sm truncate', getTextColor())}>{hotel.name}</span>
                  </div>
                  <p className={cn('text-xs', getSecondaryTextColor())}>
                    {hotel.cheapestInfo
                      ? <>₹<span className="font-bold font-mono text-emerald-600">{hotel.cheapestInfo.rate.toLocaleString('en-IN')}</span> <span className="opacity-60">· {hotel.cheapestInfo.label}</span></>
                      : <span className="italic opacity-50">Rate on request</span>}
                  </p>
                </div>
                <ChevronRight size={14} className={cn('shrink-0 mt-1 opacity-30 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all', getSecondaryTextColor())} />
              </div>
            </button>
          ))}
        </div>
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
      error: (err) => { setError(err.message); setLoading(false); },
    });
  };

  useEffect(() => { loadRates(); }, []);

  // All unique cities in the sheet
  const allCities = useMemo(() => Array.from(new Set(rates.map(r => r.City).filter(Boolean))).sort(), [rates]);

  // Cities present in the sheet that are also in our featured list (preserving featured order)
  const featuredCities = useMemo(() => FEATURED_CITIES.filter(c => allCities.includes(c)), [allCities]);

  // Non-featured cities for the "All" section
  const otherCities = useMemo(() => allCities.filter(c => !FEATURED_CITIES.includes(c)), [allCities]);

  // Filtered results when searching
  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return { cities: [], hotels: [] };
    const cities = allCities.filter(c => c.toLowerCase().includes(q));
    const hotelNames = Array.from(new Set(rates.filter(r => r.HOTEL?.toLowerCase().includes(q)).map(r => r.HOTEL)));
    const hotels = hotelNames.map(name => {
      const rows = rates.filter(r => r.HOTEL === name);
      return { name, city: rows[0]?.City || '', cheapestInfo: getCheapestRateInfo(rows) };
    });
    return { cities, hotels };
  }, [search, allCities, rates]);

  const hotelsInCity = useMemo(() => {
    if (!selCity) return [];
    const cityRates = rates.filter(r => r.City === selCity);
    return Array.from(new Set(cityRates.map(r => r.HOTEL))).map(name => ({
      name,
      cheapestInfo: getCheapestRateInfo(cityRates.filter(r => r.HOTEL === name))
    }));
  }, [rates, selCity]);

  const hotelRows = useMemo(() => rates.filter(r => r.City === selCity && r.HOTEL === selHotel), [rates, selCity, selHotel]);

  const handleSelectCity = (city: string) => { setSelCity(city); setView('city'); setSearch(''); };
  const handleSelectHotel = (name: string) => { setSelHotel(name); setView('hotel'); };

  const isSearching = search.trim().length > 0;

  // ── UI helpers
  const headerBg = theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/10';
  const inputBg  = theme === 'light' ? 'bg-slate-50 border-slate-200 focus-within:border-blue-400 focus-within:bg-white' : 'bg-white/5 border-white/10 focus-within:border-blue-400';

  return (
    <div className="space-y-6 animate-in fade-in duration-400 pb-20 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className={cn('flex items-center justify-between px-5 py-4 rounded-2xl border shadow-sm', headerBg)}>
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-xl', theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300')}>
            <Building2 size={20} />
          </div>
          <div>
            <h1 className={cn('text-lg font-bold font-serif', getTextColor())}>Blocked Hotel Rates</h1>
            <p className={cn('text-[11px] mt-0.5', getSecondaryTextColor())}>
              {loading ? 'Syncing from Google Sheets…' : `${rates.length} rates · ${allCities.length} cities`}
            </p>
          </div>
        </div>
        <button onClick={loadRates} title="Refresh"
          className={cn('p-2 rounded-xl border transition-colors', theme === 'light' ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5')}>
          <RefreshCw size={14} className={cn(loading ? 'animate-spin text-blue-500' : getSecondaryTextColor())} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-3">
          <Info size={15} className="shrink-0" />
          Failed to load sheet. Make sure it's published to the web (File → Share → Publish to web).
        </div>
      )}

      {/* ── City / Hotel detail views ── */}
      {view === 'city'  && <CityView  cityName={selCity}   hotels={hotelsInCity} onBack={() => setView('cities')} onSelectHotel={handleSelectHotel} />}
      {view === 'hotel' && <HotelView hotelName={selHotel} rows={hotelRows}       onBack={() => setView('city')} />}

      {/* ── City list view ── */}
      {view === 'cities' && (
        <div className="space-y-8">

          {/* Search bar */}
          <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm transition-all', inputBg)}>
            <Search size={15} className="opacity-40 shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search city or hotel…"
              className="flex-1 bg-transparent outline-none text-sm font-medium placeholder:opacity-40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs opacity-40 hover:opacity-70 font-mono uppercase tracking-wider">Clear</button>
            )}
          </div>

          {/* ── Search results ── */}
          {isSearching && (
            <div className="space-y-6">
              {searchResults.cities.length > 0 && (
                <div>
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-3 font-bold opacity-40', getTextColor())}>Cities</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {searchResults.cities.map(city => {
                      const count = Array.from(new Set(rates.filter(r => r.City === city).map(r => r.HOTEL))).length;
                      return (
                        <button key={city} onClick={() => handleSelectCity(city)}
                          className={cn('group text-left p-4 rounded-xl border transition-all',
                            theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-white/5 border-white/10 hover:border-blue-400/40')}>
                          <MapPin size={13} className="text-blue-500 mb-2" />
                          <p className={cn('font-bold text-sm', getTextColor())}>{city}</p>
                          <p className={cn('text-[11px] mt-0.5 opacity-50', getSecondaryTextColor())}>{count} hotel{count !== 1 ? 's' : ''}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {searchResults.hotels.length > 0 && (
                <div>
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-3 font-bold opacity-40', getTextColor())}>Hotels</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.hotels.map(hotel => (
                      <button key={hotel.name}
                        onClick={() => { setSelCity(hotel.city); setSelHotel(hotel.name); setView('hotel'); setSearch(''); }}
                        className={cn('group text-left p-4 rounded-xl border transition-all',
                          theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md' : 'bg-white/5 border-white/10 hover:border-blue-400/40')}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={cn('font-bold text-sm', getTextColor())}>{hotel.name}</p>
                            <div className={cn('flex items-center gap-1 mt-1 text-xs', getSecondaryTextColor())}>
                              <MapPin size={10} className="text-blue-400" />{hotel.city}
                              {hotel.cheapestInfo && <span className="text-emerald-600 font-bold ml-2">₹{hotel.cheapestInfo.rate.toLocaleString('en-IN')}</span>}
                            </div>
                          </div>
                          <ChevronRight size={14} className="opacity-30 mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.cities.length === 0 && searchResults.hotels.length === 0 && (
                <div className="py-16 text-center opacity-40 flex flex-col items-center gap-3">
                  <Search size={36} className="opacity-30" />
                  <p className={cn('font-medium', getTextColor())}>No results for "{search}"</p>
                </div>
              )}
            </div>
          )}

          {/* ── Default (no search) ── */}
          {!isSearching && (
            <>
              {/* Popular destinations */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-amber-500" />
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest font-bold opacity-50', getTextColor())}>Popular Destinations</p>
                </div>

                {loading ? <SkeletonFeatured /> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(featuredCities.length > 0 ? featuredCities : FEATURED_CITIES.slice(0, 8)).map(city => {
                      const isAvailable = allCities.includes(city);
                      const hotelCount = isAvailable ? Array.from(new Set(rates.filter(r => r.City === city).map(r => r.HOTEL))).length : 0;
                      const cheapest = isAvailable ? getCheapestRateInfo(rates.filter(r => r.City === city)) : null;

                      return (
                        <button key={city}
                          onClick={() => isAvailable && handleSelectCity(city)}
                          disabled={!isAvailable}
                          className={cn('group relative overflow-hidden rounded-2xl h-32 text-left transition-all duration-300',
                            isAvailable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl' : 'opacity-40 cursor-not-allowed grayscale'
                          )}
                        >
                          {/* Background image */}
                          <img
                            src={`https://picsum.photos/seed/${encodeURIComponent(city)}/400/200`}
                            alt={city}
                            className="absolute inset-0 w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent" />

                          {/* Content */}
                          <div className="absolute inset-0 p-4 flex flex-col justify-end">
                            <p className="text-white font-bold text-sm font-serif leading-tight">{city}</p>
                            {isAvailable ? (
                              <p className="text-white/60 text-[10px] mt-0.5">
                                {hotelCount} hotel{hotelCount !== 1 ? 's' : ''}
                                {cheapest && <span className="text-emerald-400 font-bold ml-1.5">· ₹{cheapest.rate.toLocaleString('en-IN')}+</span>}
                              </p>
                            ) : (
                              <p className="text-white/40 text-[10px] italic mt-0.5">Not in sheet</p>
                            )}
                          </div>

                          {/* Hover arrow */}
                          {isAvailable && (
                            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight size={13} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* All other destinations */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin size={13} className="text-blue-500" />
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest font-bold opacity-50', getTextColor())}>
                    {loading ? 'All Destinations' : `All Destinations (${allCities.length})`}
                  </p>
                </div>

                {loading ? <SkeletonGrid /> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {allCities.map(city => {
                      const isFeatured = FEATURED_CITIES.includes(city);
                      const count = Array.from(new Set(rates.filter(r => r.City === city).map(r => r.HOTEL))).length;
                      return (
                        <button key={city} onClick={() => handleSelectCity(city)}
                          className={cn('group text-left px-3 py-2.5 rounded-xl border transition-all duration-150',
                            isFeatured
                              ? theme === 'light' ? 'bg-blue-50 border-blue-100 hover:border-blue-300 hover:bg-blue-50' : 'bg-blue-500/10 border-blue-500/20 hover:border-blue-400/40'
                              : theme === 'light' ? 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50' : 'bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/8'
                          )}>
                          <p className={cn('font-semibold text-xs truncate', getTextColor())}>{city}</p>
                          <p className={cn('text-[10px] mt-0.5 opacity-40', getSecondaryTextColor())}>{count}h</p>
                        </button>
                      );
                    })}
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
