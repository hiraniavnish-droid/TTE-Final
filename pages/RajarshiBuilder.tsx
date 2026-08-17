import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn, generateId } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  Building2, ArrowLeft, Download, Copy, Loader2, Minus, Plus, Trash2,
  AlertTriangle, LayoutGrid, ListChecks, MapPin,
} from 'lucide-react';
import { RAJARSHI_HOTELS, RAJARSHI_SUPPLIER, type RajCity, type RajPlan } from '../services/rajarshiData';
import { quoteStay, hotelsByCity, fmtINR, type MarkupMode, type StayQuoteResult } from '../services/rajarshiRates';

type Mode = 'package' | 'options';
const CITIES = Object.keys(hotelsByCity()) as RajCity[];
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

interface Leg {
  id: string;
  city: RajCity;
  hotelId: string;
  roomIdx: number;
  plan: RajPlan;
  checkIn: string;
  nights: number;
  rooms: number;
  extraPersons: number;
}

const newLeg = (): Leg => ({
  id: generateId(), city: CITIES[0], hotelId: hotelsByCity()[CITIES[0]][0].id, roomIdx: 0,
  plan: 'CPAI', checkIn: '2026-11-15', nights: 1, rooms: 1, extraPersons: 0,
});

const Stepper: React.FC<{ value: number; set: (n: number) => void; min?: number; max?: number }> = ({ value, set, min = 0, max = 20 }) => {
  const { theme, getTextColor } = useTheme();
  return (
    <div className={cn('flex items-center rounded-lg border', theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5')}>
      <button onClick={() => set(Math.max(min, value - 1))} className="px-2.5 py-2 opacity-60 hover:opacity-100 active:scale-90 transition"><Minus size={13} /></button>
      <span className={cn('flex-1 text-center text-sm font-bold tabular-nums', getTextColor())}>{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="px-2.5 py-2 opacity-60 hover:opacity-100 active:scale-90 transition"><Plus size={13} /></button>
    </div>
  );
};

export const RajarshiBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass, getBorderClass } = useTheme();

  const [mode, setMode] = useState<Mode>('package');
  const [clientName, setClientName] = useState('');
  const [markupMode, setMarkupMode] = useState<MarkupMode>('percent');
  const [markupValue, setMarkupValue] = useState(15);
  const [pdfBusy, setPdfBusy] = useState(false);

  // ── Package mode ──
  const [legs, setLegs] = useState<Leg[]>([newLeg()]);
  const updateLeg = (id: string, patch: Partial<Leg>) => setLegs(p => p.map(l => l.id === id ? { ...l, ...patch } : l));
  const addLeg = () => setLegs(p => [...p, newLeg()]);
  const removeLeg = (id: string) => setLegs(p => p.length > 1 ? p.filter(l => l.id !== id) : p);

  const legQuotes = useMemo(() => legs.map(leg => {
    const hotel = RAJARSHI_HOTELS.find(h => h.id === leg.hotelId);
    const room = hotel?.rooms[leg.roomIdx];
    if (!hotel || !room) return null;
    return { leg, hotel, room, quote: quoteStay({ hotel, room, plan: leg.plan, checkIn: leg.checkIn, nights: leg.nights, rooms: leg.rooms, extraPersons: leg.extraPersons, markupMode, markupValue }) };
  }).filter((x): x is NonNullable<typeof x> => x != null), [legs, markupMode, markupValue]);

  const packageTotal = useMemo(() => legQuotes.reduce((acc, l) => ({
    netCost: acc.netCost + l.quote.netCost,
    markupAmount: acc.markupAmount + l.quote.markupAmount,
    sellingPrice: acc.sellingPrice + l.quote.sellingPrice,
  }), { netCost: 0, markupAmount: 0, sellingPrice: 0 }), [legQuotes]);

  const anyOnRequest = legQuotes.some(l => l.quote.anyOnRequest);

  // ── Options mode ──
  const [optCity, setOptCity] = useState<RajCity>(CITIES[0]);
  const [optCheckIn, setOptCheckIn] = useState('2026-11-15');
  const [optNights, setOptNights] = useState(1);
  const [optRooms, setOptRooms] = useState(1);
  const [optPlan, setOptPlan] = useState<RajPlan>('CPAI');
  const [selectedHotelRooms, setSelectedHotelRooms] = useState<Set<string>>(new Set());

  const cityHotels = hotelsByCity()[optCity] || [];
  const toggleOption = (key: string) => setSelectedHotelRooms(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const optionResults = useMemo(() => {
    const out: { key: string; hotel: typeof RAJARSHI_HOTELS[number]; room: typeof RAJARSHI_HOTELS[number]['rooms'][number]; quote: StayQuoteResult }[] = [];
    for (const hotel of cityHotels) {
      for (let ri = 0; ri < hotel.rooms.length; ri++) {
        const key = `${hotel.id}::${ri}`;
        if (!selectedHotelRooms.has(key)) continue;
        const room = hotel.rooms[ri];
        out.push({ key, hotel, room, quote: quoteStay({ hotel, room, plan: optPlan, checkIn: optCheckIn, nights: optNights, rooms: optRooms, extraPersons: 0, markupMode, markupValue }) });
      }
    }
    return out.sort((a, b) => a.quote.sellingPrice - b.quote.sellingPrice);
  }, [cityHotels, selectedHotelRooms, optPlan, optCheckIn, optNights, optRooms, markupMode, markupValue]);

  // ── Shared output builders ──
  const nightsLabel = (n: number) => `${n}N/${n + 1}D`;

  const buildPackageText = (): string => {
    if (!legQuotes.length) return '';
    const L: string[] = ['*THE TOURISM EXPERTS*', '*Kutch Package Quotation*', ''];
    if (clientName) L.push(`Guest: ${clientName}`);
    L.push('');
    legQuotes.forEach((l, i) => {
      L.push(`*${i + 1}. ${l.hotel.name}* (${l.hotel.city})`);
      L.push(`${l.room.name} · ${l.leg.plan} · ${fmtDate(l.leg.checkIn)} · ${nightsLabel(l.leg.nights)} · ${l.leg.rooms} room(s)`);
      if (l.quote.anyOnRequest) L.push(`Rate: On Request — please contact us to confirm`);
      else L.push(`Price: ${fmtINR(l.quote.sellingPrice)}`);
      L.push('');
    });
    if (!anyOnRequest) L.push(`*GRAND TOTAL: ${fmtINR(packageTotal.sellingPrice)}*`);
    L.push('');
    L.push('_Rates as quoted. Subject to availability at time of booking._');
    L.push('The Tourism Experts');
    return L.join('\n');
  };

  const buildOptionsText = (): string => {
    if (!optionResults.length) return '';
    const L: string[] = ['*THE TOURISM EXPERTS*', `*${optCity} — Hotel Options*`, ''];
    if (clientName) L.push(`Guest: ${clientName}`);
    L.push(`Check-in: ${fmtDate(optCheckIn)}  |  ${nightsLabel(optNights)}  |  Rooms: ${optRooms}  |  ${optPlan}`);
    L.push('');
    optionResults.forEach((o, i) => {
      L.push(`*Option ${i + 1}: ${o.hotel.name}*`);
      L.push(`${o.room.name}${o.hotel.descriptor ? ` · ${o.hotel.descriptor}` : ''}`);
      L.push(o.quote.anyOnRequest ? 'Price: On Request' : `Price: ${fmtINR(o.quote.sellingPrice)}`);
      L.push('');
    });
    L.push('_Rates as quoted. Subject to availability at time of booking._');
    L.push('The Tourism Experts');
    return L.join('\n');
  };

  const activeText = mode === 'package' ? buildPackageText : buildOptionsText;

  const copyText = () => {
    const t = activeText();
    if (!t) { toast.error('Add at least one hotel first.'); return; }
    navigator.clipboard.writeText(t).then(() => toast.success('Copied — paste into WhatsApp!'), () => toast.error('Copy failed'));
  };
  const openWhatsApp = () => {
    const t = activeText();
    if (!t) { toast.error('Add at least one hotel first.'); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  };

  const downloadPdf = async () => {
    if (pdfBusy) return;
    const rows = mode === 'package'
      ? legQuotes.map(l => ({ title: `${l.hotel.name} (${l.hotel.city})`, sub: `${l.room.name} · ${l.leg.plan} · ${fmtDate(l.leg.checkIn)} · ${nightsLabel(l.leg.nights)} · ${l.leg.rooms} room(s)`, price: l.quote.anyOnRequest ? 'On Request' : fmtINR(l.quote.sellingPrice) }))
      : optionResults.map(o => ({ title: o.hotel.name, sub: `${o.room.name}${o.hotel.descriptor ? ` · ${o.hotel.descriptor}` : ''}`, price: o.quote.anyOnRequest ? 'On Request' : fmtINR(o.quote.sellingPrice) }));
    if (!rows.length) { toast.error('Add at least one hotel first.'); return; }
    setPdfBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210; let y = 0;
      const slate = [15, 23, 42] as const; const muted = [100, 116, 139] as const;

      doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text('THE TOURISM EXPERTS', 14, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(203, 213, 225);
      doc.text(mode === 'package' ? 'Kutch Package Quotation' : `${optCity} — Hotel Options`, 14, 22);
      y = 40;

      doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(clientName || 'Guest Quotation', 14, y); y += 9;

      rows.forEach((r, i) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...slate);
        doc.text(`${i + 1}. ${r.title}`, 14, y); y += 5.5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
        doc.text(r.sub, 14, y); y += 5.5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...slate);
        doc.text(r.price, W - 14, y - 5.5, { align: 'right' });
        doc.setDrawColor(226, 232, 240); doc.line(14, y, W - 14, y); y += 6;
      });

      if (mode === 'package' && !anyOnRequest) {
        y += 3;
        doc.setFillColor(240, 244, 248); doc.rect(14, y - 4, W - 28, 12, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...slate);
        doc.text('GRAND TOTAL', 18, y + 3.5);
        doc.text(fmtINR(packageTotal.sellingPrice), W - 18, y + 3.5, { align: 'right' });
      }

      doc.save(`${mode === 'package' ? 'Kutch Package' : optCity + ' Options'} — ${clientName || 'Guest'}.pdf`);
      toast.success('PDF downloaded');
    } catch (e: any) {
      toast.error('PDF failed: ' + (e?.message || 'error'));
    } finally {
      setPdfBusy(false);
    }
  };

  const inputCls = cn('w-full px-3 py-2 rounded-lg border outline-none text-sm', getInputClass());
  const labelCls = cn('text-[10.5px] font-bold uppercase tracking-wider mb-1 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/builder')} className="opacity-50 hover:opacity-100 active:scale-90 transition"><ArrowLeft size={20} /></button>
        <div className={cn('p-2 rounded-lg', theme === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-300')}><Building2 size={20} /></div>
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight leading-none', getTextColor())}>{RAJARSHI_SUPPLIER.name}</h1>
          <p className={cn('text-[12px] mt-1', getSecondaryTextColor())}>Season {RAJARSHI_SUPPLIER.season} · {RAJARSHI_SUPPLIER.location} · {RAJARSHI_HOTELS.length} hotels</p>
        </div>
      </div>

      <div className={cn('inline-flex p-1 rounded-xl border mb-6', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
        {([['package', 'Build Package', LayoutGrid], ['options', 'Compare Options', ListChecks]] as [Mode, string, any][]).map(([m, label, Icon]) => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-all active:scale-[0.98]',
              mode === m ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'text-slate-500 hover:text-slate-800' : 'text-white/50 hover:text-white/80'))}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className={cn('rounded-2xl border p-5 space-y-4', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10')}>
            <div>
              <label className={labelCls}>Guest name</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Mr. Avnish Hirani" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Markup</label>
                <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
                  {(['percent', 'flat'] as MarkupMode[]).map(m => (
                    <button key={m} onClick={() => setMarkupMode(m)}
                      className={cn('flex-1 py-2 text-[12px] font-bold transition', markupMode === m ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                      {m === 'percent' ? '%' : '₹ flat/room-night'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>{markupMode === 'percent' ? 'Markup %' : 'Markup ₹/room/night'}</label>
                <input type="number" inputMode="decimal" min={0} value={markupValue}
                  onChange={e => setMarkupValue(Math.max(0, Number(e.target.value) || 0))} className={cn(inputCls, 'font-mono')} />
              </div>
            </div>
          </div>

          {mode === 'package' ? (
            <div className="space-y-3">
              {legs.map((leg, idx) => {
                const cHotels = hotelsByCity()[leg.city] || [];
                const hotel = cHotels.find(h => h.id === leg.hotelId) || cHotels[0];
                const room = hotel?.rooms[leg.roomIdx] || hotel?.rooms[0];
                return (
                  <div key={leg.id} className={cn('rounded-2xl border p-4 space-y-3', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[11px] font-bold uppercase tracking-wide', getSecondaryTextColor())}>Night {idx + 1}</span>
                      {legs.length > 1 && <button onClick={() => removeLeg(leg.id)} className="text-rose-500 hover:text-rose-600"><Trash2 size={14} /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>City</label>
                        <select value={leg.city} className={cn(inputCls, '[&>option]:text-black')}
                          onChange={e => { const city = e.target.value as RajCity; const h = hotelsByCity()[city][0]; updateLeg(leg.id, { city, hotelId: h.id, roomIdx: 0 }); }}>
                          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Hotel</label>
                        <select value={leg.hotelId} className={cn(inputCls, '[&>option]:text-black')}
                          onChange={e => updateLeg(leg.id, { hotelId: e.target.value, roomIdx: 0 })}>
                          {cHotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Room type</label>
                        <select value={leg.roomIdx} className={cn(inputCls, '[&>option]:text-black')}
                          onChange={e => updateLeg(leg.id, { roomIdx: Number(e.target.value) })}>
                          {hotel?.rooms.map((r, ri) => <option key={ri} value={ri}>{r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Meal plan</label>
                        <select value={leg.plan} className={cn(inputCls, '[&>option]:text-black')}
                          onChange={e => updateLeg(leg.id, { plan: e.target.value as RajPlan })}>
                          {(['EPAI', 'CPAI', 'MAPAI'] as RajPlan[]).filter(p => room?.rates.base?.[p] != null || (hotel?.tiers || []).some(t => room?.rates[t.id]?.[p] != null)).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Check-in</label>
                        <input type="date" value={leg.checkIn} onChange={e => updateLeg(leg.id, { checkIn: e.target.value })} className={cn(inputCls, 'font-mono')} />
                      </div>
                      <div>
                        <label className={labelCls}>Nights</label>
                        <Stepper value={leg.nights} set={n => updateLeg(leg.id, { nights: n })} min={1} max={14} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Rooms</label>
                        <Stepper value={leg.rooms} set={n => updateLeg(leg.id, { rooms: n })} min={1} max={20} />
                      </div>
                      <div>
                        <label className={labelCls}>Extra persons</label>
                        <Stepper value={leg.extraPersons} set={n => updateLeg(leg.id, { extraPersons: n })} />
                      </div>
                    </div>
                    {hotel?.notes?.length ? (
                      <div className={cn('text-[10.5px] px-2.5 py-2 rounded-lg', theme === 'light' ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300')}>
                        {hotel.notes.join(' · ')}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <button onClick={addLeg}
                className={cn('w-full py-2.5 rounded-xl text-[13px] font-bold border border-dashed transition active:scale-[0.98]',
                  theme === 'light' ? 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700' : 'border-white/20 text-white/50 hover:border-white/40')}>
                + Add another night / hotel
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn('rounded-2xl border p-4 space-y-3', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City</label>
                    <select value={optCity} className={cn(inputCls, '[&>option]:text-black')}
                      onChange={e => { setOptCity(e.target.value as RajCity); setSelectedHotelRooms(new Set()); }}>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Meal plan</label>
                    <select value={optPlan} className={cn(inputCls, '[&>option]:text-black')} onChange={e => setOptPlan(e.target.value as RajPlan)}>
                      {(['EPAI', 'CPAI', 'MAPAI'] as RajPlan[]).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Check-in</label>
                    <input type="date" value={optCheckIn} onChange={e => setOptCheckIn(e.target.value)} className={cn(inputCls, 'font-mono')} />
                  </div>
                  <div>
                    <label className={labelCls}>Nights</label>
                    <Stepper value={optNights} set={setOptNights} min={1} max={14} />
                  </div>
                  <div>
                    <label className={labelCls}>Rooms</label>
                    <Stepper value={optRooms} set={setOptRooms} min={1} max={20} />
                  </div>
                </div>
              </div>

              <div className={cn('rounded-2xl border divide-y', theme === 'light' ? 'bg-white border-slate-200 divide-slate-100' : 'bg-white/5 border-white/10 divide-white/10')}>
                {cityHotels.map(hotel => (
                  <div key={hotel.id} className="p-3.5">
                    <div className={cn('text-[13px] font-bold mb-1.5', getTextColor())}>{hotel.name}</div>
                    <div className="space-y-1">
                      {hotel.rooms.map((room, ri) => {
                        const key = `${hotel.id}::${ri}`;
                        const checked = selectedHotelRooms.has(key);
                        return (
                          <label key={key} className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] cursor-pointer select-none', theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                            <input type="checkbox" checked={checked} onChange={() => toggleOption(key)} className="w-3.5 h-3.5 accent-slate-900 shrink-0" />
                            <span className={getTextColor()}>{room.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className={cn('rounded-2xl border p-5 lg:sticky lg:top-4', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]' : 'bg-white/5 border-white/10')}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} className="opacity-60" />
              <span className={cn('font-bold text-sm', getTextColor())}>{mode === 'package' ? 'Package Summary' : 'Compared Options'}</span>
            </div>

            {mode === 'package' ? (
              <div className="space-y-2.5">
                {legQuotes.map(l => (
                  <div key={l.leg.id} className={cn('flex justify-between items-start text-[12.5px] pb-2 border-b', getBorderClass())}>
                    <div className="pr-2">
                      <div className={cn('font-semibold', getTextColor())}>{l.hotel.name}</div>
                      <div className={getSecondaryTextColor()}>{l.room.name} · {nightsLabel(l.leg.nights)}</div>
                    </div>
                    <span className={cn('font-mono font-bold shrink-0', l.quote.anyOnRequest ? 'text-amber-500' : getTextColor())}>
                      {l.quote.anyOnRequest ? 'On Req.' : fmtINR(l.quote.sellingPrice)}
                    </span>
                  </div>
                ))}
                {anyOnRequest && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">One or more nights are On Request — confirm with the supplier before quoting a total.</p>
                  </div>
                )}
                {!anyOnRequest && (
                  <div className={cn('flex justify-between items-center mt-2 p-3 rounded-xl', theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/10')}>
                    <span className="text-[13px] font-bold uppercase tracking-wide">Grand Total</span>
                    <span className="text-xl font-bold font-mono">{fmtINR(packageTotal.sellingPrice)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {optionResults.length === 0 && (
                  <p className={cn('text-[12px] text-center py-6', getSecondaryTextColor())}>Tick room types on the left to compare them here.</p>
                )}
                {optionResults.map((o, i) => (
                  <div key={o.key} className={cn('p-3 rounded-xl border', i === 0 && !o.quote.anyOnRequest ? (theme === 'light' ? 'border-emerald-300 bg-emerald-50/50' : 'border-emerald-500/30 bg-emerald-500/5') : getBorderClass())}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={cn('text-[13px] font-bold', getTextColor())}>{o.hotel.name}</div>
                        <div className={cn('text-[11px]', getSecondaryTextColor())}>{o.room.name}{o.hotel.descriptor ? ` · ${o.hotel.descriptor}` : ''}</div>
                      </div>
                      <span className={cn('font-mono font-bold text-[13px] shrink-0', o.quote.anyOnRequest ? 'text-amber-500' : getTextColor())}>
                        {o.quote.anyOnRequest ? 'On Req.' : fmtINR(o.quote.sellingPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-4">
              <button onClick={downloadPdf} disabled={pdfBusy}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-60">
                {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF
              </button>
              <button onClick={copyText}
                className={cn('flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-bold border active:scale-[0.97] transition',
                  theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80')}>
                <Copy size={15} /> Copy
              </button>
            </div>
            <button onClick={openWhatsApp}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-500 active:scale-[0.97] transition">
              Share on WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function nightsLabel(n: number) { return `${n}N/${n + 1}D`; }
