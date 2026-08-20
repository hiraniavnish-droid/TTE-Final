// ============================================================
// Statue of Unity Hotels — quotation builder.
//
// A separate page from SouTentCityBuilder.tsx (Cottage/Villa rates, untouched
// by design) — this one is a multi-hotel comparison tool over the Kevadiya
// hotel set already in inlandData.ts/inlandWall.ts, modeled directly on Rann
// Utsav's "Compare Options" tab: tick multiple hotels × multiple night
// counts, optionally append a sightseeing itinerary package, share one
// WhatsApp message. All hotel pricing comes from buildInlandWall() via
// souHotelOptions.ts — nothing here re-derives a room rate.
//
// Two-column on wide screens: the left column (controls, hotel grid,
// itinerary) scrolls; the right column (client message) is sticky so an
// employee never has to scroll away from the working area to see it.
// ============================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  Landmark, ArrowLeft, Minus, Plus, Check, Download, Copy, Loader2, ListChecks, AlertTriangle,
} from 'lucide-react';
import { buildSouHotelOptions, listSouHotels, type SouOptionNights } from '../services/souHotelOptions';
import { budgetStatus, type BudgetStatus } from '../services/rateWall';
import type { MarkupMode } from '../services/inlandRates';
import {
  SOU_ITINERARIES, TRANSPORT_REFERENCE, priceSouItinerary,
  type SouItineraryNights,
} from '../services/souItinerary';
import {
  buildSouCompareMessage, groupCompareHotelRates, fmtCompareDate, fmtINR, addDaysISO,
  type CompareHotelRate,
} from '../services/souHotelCompareMessage';

const DURATIONS: SouOptionNights[] = [1, 2, 3];
const cellKey = (hotelId: string, n: number) => `${hotelId}::${n}`;

// The two plan buckets Kevadiya's sheets actually print (CPAI/CP-only rooms,
// and MAPAI or a derived '(MAP)' dinner-supplement row) — matches the same
// grouping quoteTrainerEngine.ts / RateWallCard's global quick-pick use.
type PlanChoice = 'cp' | 'map';
const PLAN_PREFERENCE: Record<PlanChoice, string> = { cp: 'CPAI', map: 'MAPAI' };

export const SouHotelsBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();

  const [checkInStr, setCheckInStr] = useState('2026-11-15');
  const [rooms, setRooms] = useState(1);
  const [pax, setPax] = useState(2);
  const [extraMattress, setExtraMattress] = useState(0);
  const [markupMode, setMarkupMode] = useState<MarkupMode>('percent');
  const [markupValue, setMarkupValue] = useState(15);
  const [plan, setPlan] = useState<PlanChoice>('cp');
  const [budgetPerPerson, setBudgetPerPerson] = useState<number | undefined>(undefined);
  const [hideOverBudget, setHideOverBudget] = useState(false);

  // Rooms auto-suggests ceil(guests/2) as guests changes, but only while the
  // agent hasn't diverged from the last suggestion — same behaviour as the
  // main Inland Rate Wall (pages/InlandBuilder.tsx), so a party of 4 defaults
  // to 2 rooms instead of silently pricing 4 guests into 1.
  const suggestedRoomsRef = useRef(rooms);
  useEffect(() => {
    const suggestion = Math.max(1, Math.ceil(pax / 2));
    if (rooms === suggestedRoomsRef.current && rooms !== suggestion) setRooms(suggestion);
    suggestedRoomsRef.current = suggestion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pax]);

  const allHotels = useMemo(() => listSouHotels(), []);
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  const [includeItinerary, setIncludeItinerary] = useState(false);
  const [itineraryNights, setItineraryNights] = useState<SouItineraryNights>(1);
  const [includeTransfer, setIncludeTransfer] = useState(false);

  const [comparePdfBusy, setComparePdfBusy] = useState(false);

  // Default to every hotel selected once the list resolves, so the grid isn't
  // empty on first load.
  useEffect(() => {
    if (allHotels.length && selectedHotelIds.length === 0) {
      setSelectedHotelIds(allHotels.map(h => h.hotelId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHotels]);

  const toggleHotel = (id: string) =>
    setSelectedHotelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAllHotels = () => setSelectedHotelIds(allHotels.map(h => h.hotelId));
  const selectNoHotels = () => setSelectedHotelIds([]);

  const options = useMemo(() => buildSouHotelOptions({
    checkIn: checkInStr, hotelIds: selectedHotelIds, durations: DURATIONS,
    rooms, pax, extraMattress, markupMode, markupValue, preferredPlan: PLAN_PREFERENCE[plan],
  }), [checkInStr, selectedHotelIds, rooms, pax, extraMattress, markupMode, markupValue, plan]);

  const itineraryPrice = useMemo(
    () => includeItinerary ? priceSouItinerary({ nights: itineraryNights, pax, includeRailwayTransfer: includeTransfer }) : null,
    [includeItinerary, itineraryNights, pax, includeTransfer]);

  const cellFor = (hotelId: string, n: SouOptionNights) =>
    options.cells.find(c => c.hotelId === hotelId && c.nights === n);

  const toggleCell = (hotelId: string, n: SouOptionNights) =>
    setTicks(prev => ({ ...prev, [cellKey(hotelId, n)]: !prev[cellKey(hotelId, n)] }));

  // Budget is a per-person figure for the whole booking (matches the same
  // convention as the main Rate Wall's budgetStatus — see rateWall.ts). When
  // a package is included, the figure a client actually judges against is
  // the COMBINED hotel + package total, not the hotel alone.
  const totalBudget = budgetPerPerson ? budgetPerPerson * pax : undefined;
  const cellBudget = (sellingTotal: number): BudgetStatus | null =>
    budgetStatus(sellingTotal + (itineraryPrice?.sellingTotal ?? 0), totalBudget);

  const selectedCells = useMemo(
    () => options.cells.filter(c => ticks[cellKey(c.hotelId, c.nights)] === true),
    [options, ticks]);

  const selectedRates: CompareHotelRate[] = useMemo(
    () => selectedCells.map(c => ({
      hotelId: c.hotelId, hotelName: c.hotelName, starLabel: c.starLabel,
      nights: c.nights, sellingTotal: c.sellingTotal, clientNote: c.clientNote,
    })), [selectedCells]);

  // Internal-only margin strip.
  const margin = useMemo(() => {
    if (selectedCells.length === 0) return null;
    const nets = selectedCells.map(c => c.netTotal);
    const profits = selectedCells.map(c => c.markupAmount);
    return {
      netLo: Math.min(...nets), netHi: Math.max(...nets),
      profitLo: Math.min(...profits), profitHi: Math.max(...profits),
    };
  }, [selectedCells]);

  const compareGroups = useMemo(
    () => groupCompareHotelRates(selectedRates, itineraryPrice?.sellingTotal ?? 0),
    [selectedRates, itineraryPrice]);

  const compareText = (): string => buildSouCompareMessage({
    checkIn: checkInStr, rooms, pax, rates: selectedRates, itinerary: itineraryPrice,
  });

  const copyCompare = () => {
    const t = compareText();
    if (!t) { toast.error('Tick at least one hotel rate first.'); return; }
    navigator.clipboard.writeText(t).then(
      () => toast.success('Comparison copied — paste into WhatsApp!'),
      () => toast.error('Copy failed'),
    );
  };

  const shareCompare = () => {
    const t = compareText();
    if (!t) { toast.error('Tick at least one hotel rate first.'); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  };

  const downloadComparePdf = async () => {
    if (selectedRates.length === 0 || comparePdfBusy) { if (!comparePdfBusy) toast.error('Tick at least one hotel rate first.'); return; }
    setComparePdfBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210; let y = 18;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('THE TOURISM EXPERTS', W / 2, y, { align: 'center' }); y += 7;
      doc.setFontSize(12);
      doc.text('Statue of Unity — Kevadiya Hotels', W / 2, y, { align: 'center' }); y += 10;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`${pax} guest(s)  ·  ${rooms} room(s)`, 14, y); y += 8;

      const itineraryTotal = itineraryPrice?.sellingTotal ?? 0;
      compareGroups.forEach((g, gi) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(`Option ${gi + 1}: ${g.hotelName}${g.starLabel ? ` (${g.starLabel})` : ''}`, 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
        g.rates.forEach(r => {
          const combined = r.sellingTotal + itineraryTotal;
          const perPerson = Math.round(combined / pax);
          const checkOut = fmtCompareDate(addDaysISO(checkInStr, r.nights));
          const label = `${r.nights}N/${r.nights + 1}D${itineraryPrice ? ' — SOU KV Package' : ''}`;
          doc.text(`${label}: ${fmtCompareDate(checkInStr)} to ${checkOut}  —  ${fmtINR(combined)} (${fmtINR(perPerson)}/person)`, 14, y);
          y += 5;
          if (r.clientNote) {
            doc.setFont('helvetica', 'italic');
            doc.text(`   ⚠ ${r.clientNote}`, 14, y);
            doc.setFont('helvetica', 'normal');
            y += 5;
          }
        });
        y += 3;
      });

      if (itineraryPrice) {
        const it = itineraryPrice;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(`What's Included — ${it.plan.label} Sightseeing Package`, 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
        it.plan.ticketItems.forEach((t, idx) => {
          doc.text(`${idx + 1}. ${t.name}`, 14, y); y += 5;
        });
        if (it.transferNetTotal > 0) { doc.text(`${it.plan.ticketItems.length + 1}. Railway station transfer`, 14, y); y += 5; }
        y += 2;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
        doc.text('For your reference — not included in the package above:', 14, y); y += 4.5;
        Object.values(TRANSPORT_REFERENCE).forEach(t => {
          doc.text(`${t.label}: ${fmtINR(t.perVehicle)}/vehicle (seats ${t.capacity})`, 14, y); y += 4.5;
        });
        y += 3;
      }

      doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text('All rates include GST.', 14, y);
      doc.save(`SOU-Hotels-${checkInStr}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setComparePdfBusy(false);
    }
  };

  const inputCls = cn('w-full px-2.5 py-2 rounded-lg border outline-none text-[13px]', getInputClass());
  const labelCls = cn('text-[10px] font-bold uppercase tracking-wider mb-1 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');
  const cardCls = cn('rounded-xl border p-3', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10');

  const Stepper: React.FC<{ value: number; set: (n: number) => void; min?: number; max?: number }> = ({ value, set, min = 1, max = 30 }) => (
    <div className={cn('flex items-center rounded-lg border', theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5')}>
      <button onClick={() => set(Math.max(min, value - 1))} className="px-1.5 py-1.5 opacity-60 hover:opacity-100 active:scale-90 transition"><Minus size={12} /></button>
      <span className={cn('flex-1 text-center text-[12.5px] font-bold tabular-nums', getTextColor())}>{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="px-1.5 py-1.5 opacity-60 hover:opacity-100 active:scale-90 transition"><Plus size={12} /></button>
    </div>
  );

  const MessagePanel = (
    <div className={cn(cardCls, 'shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] flex flex-col min-h-0')}>
      <div className="flex items-center gap-2 mb-2.5 shrink-0">
        <ListChecks size={15} className="opacity-60" />
        <span className={cn('font-bold text-[13px]', getTextColor())}>Message to client</span>
        <span className={cn('ml-auto text-[10.5px] font-mono', getSecondaryTextColor())}>{compareText().length} chars</span>
      </div>

      {selectedRates.length === 0 ? (
        <p className={cn('text-[12px]', getSecondaryTextColor())}>Tick the hotel rates you want to share.</p>
      ) : (
        <>
          <pre className={cn('text-[11px] leading-relaxed whitespace-pre-wrap font-sans p-2.5 rounded-lg overflow-y-auto flex-1 min-h-[120px]',
            theme === 'light' ? 'bg-slate-50 text-slate-700' : 'bg-black/20 text-white/75')}>{compareText()}</pre>
          <div className="grid grid-cols-2 gap-2 pt-2.5 shrink-0">
            <button onClick={downloadComparePdf} disabled={comparePdfBusy}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-60">
              {comparePdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
            </button>
            <button onClick={copyCompare}
              className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-bold border active:scale-[0.97] transition',
                theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80')}>
              <Copy size={14} /> Copy
            </button>
          </div>
          <button onClick={shareCompare}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-lg bg-emerald-600 text-white text-[12.5px] font-bold hover:bg-emerald-500 active:scale-[0.97] transition shrink-0">
            Share on WhatsApp
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="w-full animate-in fade-in duration-500 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={() => navigate('/builder')} className="opacity-50 hover:opacity-100 active:scale-90 transition"><ArrowLeft size={18} /></button>
        <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-300')}><Landmark size={17} /></div>
        <h1 className={cn('text-lg font-bold tracking-tight leading-none', getTextColor())}>Statue of Unity Hotels</h1>
        <span className={cn('text-[11.5px]', getSecondaryTextColor())}>Kevadiya hotel comparison</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3 items-start">
        {/* ─── Left: everything that changes the numbers ─── */}
        <div className="space-y-2.5 min-w-0">
          {/* ─── Shared controls + hotel picker, one dense card ─── */}
          <div className={cardCls}>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[142px]">
                <label className={labelCls}>Check-in</label>
                <input type="date" value={checkInStr} onChange={e => setCheckInStr(e.target.value)} className={cn(inputCls, 'font-mono py-1.5')} />
              </div>
              <div className="w-[76px]">
                <label className={labelCls}>Rooms</label>
                <Stepper value={rooms} set={setRooms} min={1} max={20} />
              </div>
              <div className="w-[76px]">
                <label className={labelCls}>Guests</label>
                <Stepper value={pax} set={setPax} min={1} max={40} />
              </div>
              <div className="w-[86px]">
                <label className={labelCls}>Mattress</label>
                <Stepper value={extraMattress} set={setExtraMattress} min={0} max={10} />
              </div>
              <div className="w-[76px]">
                <label className={labelCls}>Plan</label>
                <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                  {(['cp', 'map'] as PlanChoice[]).map(p => (
                    <button key={p} onClick={() => setPlan(p)}
                      className={cn('flex-1 py-1.5 text-[11.5px] font-bold uppercase transition', plan === p ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-[150px]">
                <label className={labelCls}>{markupMode === 'percent' ? 'Markup %' : 'Markup ₹/rm/nt'}</label>
                <div className="flex gap-1">
                  <div className={cn('flex rounded-lg border overflow-hidden shrink-0', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                    {(['percent', 'flat'] as MarkupMode[]).map(m => (
                      <button key={m} onClick={() => setMarkupMode(m)}
                        className={cn('px-2 py-1.5 text-[11px] font-bold transition', markupMode === m ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                        {m === 'percent' ? '%' : '₹'}
                      </button>
                    ))}
                  </div>
                  <input type="number" inputMode="decimal" min={0} value={markupValue}
                    onChange={e => { const n = parseFloat(e.target.value); setMarkupValue(!isNaN(n) && n >= 0 ? n : 0); }}
                    className={cn(inputCls, 'font-mono flex-1 py-1.5')} />
                </div>
              </div>
              <div className="w-[110px]">
                <label className={labelCls}>Budget/person</label>
                <input type="number" inputMode="decimal" min={0} step={100} placeholder="e.g. 6000"
                  value={budgetPerPerson ?? ''}
                  onChange={e => setBudgetPerPerson(e.target.value ? Math.max(0, Number(e.target.value)) : undefined)}
                  className={cn(inputCls, 'font-mono py-1.5')} />
              </div>
              {!!budgetPerPerson && (
                <div>
                  <label className={labelCls}>&nbsp;</label>
                  <button onClick={() => setHideOverBudget(v => !v)}
                    className={cn('px-2.5 py-1.5 rounded-lg border text-[11px] font-bold whitespace-nowrap transition',
                      hideOverBudget ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'))}>
                    Hide over budget
                  </button>
                </div>
              )}
              <div>
                <label className={labelCls}>&nbsp;</label>
                <button onClick={() => setIncludeItinerary(v => !v)}
                  className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold whitespace-nowrap transition',
                    includeItinerary ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'))}>
                  <span className={cn('w-3 h-3 rounded flex items-center justify-center shrink-0 border',
                    includeItinerary ? 'bg-white border-white text-slate-900' : cn(theme === 'light' ? 'border-slate-300' : 'border-white/25'))}>
                    {includeItinerary && <Check size={9} strokeWidth={3.5} />}
                  </span>
                  Include itinerary
                </button>
              </div>
            </div>

            {includeItinerary && (
              <div className={cn('mt-3 pt-3 border-t space-y-2.5', theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Itinerary plan</label>
                    <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                      {(Object.values(SOU_ITINERARIES)).map(p => (
                        <button key={p.nights} onClick={() => setItineraryNights(p.nights)}
                          className={cn('flex-1 py-1.5 text-[12px] font-bold transition', itineraryNights === p.nights ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => setIncludeTransfer(v => !v)}
                      className={cn('w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11.5px] font-bold transition',
                        includeTransfer ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'))}>
                      <span className={cn('w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border',
                        includeTransfer ? 'bg-white border-white text-slate-900' : cn(theme === 'light' ? 'border-slate-300' : 'border-white/25'))}>
                        {includeTransfer && <Check size={10} strokeWidth={3.5} />}
                      </span>
                      Railway transfer
                    </button>
                  </div>
                </div>

                <div className={cn('rounded-lg p-2.5 text-[11.5px] leading-relaxed', theme === 'light' ? 'bg-slate-50 text-slate-600' : 'bg-black/20 text-white/70')}>
                  {SOU_ITINERARIES[itineraryNights].ticketItems.map(t => t.name).join(' · ')}
                </div>

                {itineraryPrice && (
                  <>
                    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]', getSecondaryTextColor())}>
                      <span className="font-bold uppercase tracking-wider opacity-60">Internal</span>
                      <span>Net {fmtINR(itineraryPrice.netTotal)}</span>
                      <span>Markup {fmtINR(itineraryPrice.markupTotal)} (₹100/pax/day × {itineraryPrice.pax} × {itineraryPrice.days})</span>
                      <span className="font-bold">Selling {fmtINR(itineraryPrice.sellingTotal)}</span>
                    </div>
                    <div className={cn('rounded-lg p-2.5 text-[10.5px] leading-relaxed italic', theme === 'light' ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300')}>
                      Golf Cart / E-Rickshaw are reference-only — never part of this price. {Object.values(TRANSPORT_REFERENCE).map(t => `${t.label}: ${fmtINR(t.perVehicle)}/vehicle (seats ${t.capacity})`).join(' · ')}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={cn('mt-3 pt-3 border-t', theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>Hotels</span>
                <span className={cn('text-[10.5px]', getSecondaryTextColor())}>{selectedHotelIds.length}/{allHotels.length} selected</span>
                <div className="ml-auto flex gap-1.5">
                  <button onClick={selectAllHotels} className={cn('text-[10.5px] font-bold px-2 py-0.5 rounded', theme === 'light' ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-white/50 hover:text-white/90 hover:bg-white/10')}>Select all</button>
                  <button onClick={selectNoHotels} className={cn('text-[10.5px] font-bold px-2 py-0.5 rounded', theme === 'light' ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-white/50 hover:text-white/90 hover:bg-white/10')}>Select none</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allHotels.map(h => {
                  const on = selectedHotelIds.includes(h.hotelId);
                  return (
                    <button key={h.hotelId} onClick={() => toggleHotel(h.hotelId)}
                      className={cn('px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition active:scale-[0.97]',
                        on ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'))}>
                      {h.hotelName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Margin strip (internal only) ─── */}
          <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] px-0.5', getSecondaryTextColor())}>
            <span className="font-bold uppercase tracking-wider opacity-60">Internal</span>
            {margin ? (
              <>
                <span>Net {margin.netLo === margin.netHi ? fmtINR(margin.netLo) : `${fmtINR(margin.netLo)}–${fmtINR(margin.netHi)}`}</span>
                <span>Margin {margin.profitLo === margin.profitHi ? fmtINR(margin.profitLo) : `${fmtINR(margin.profitLo)}–${fmtINR(margin.profitHi)}`}</span>
                <span className="opacity-60">({selectedCells.length} ticked)</span>
              </>
            ) : (
              <span className="opacity-60">Tick a cell to see net cost and margin.</span>
            )}
          </div>

          {/* ─── Hotel cards — 2-3 per row so more hotels fit without scrolling ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
            {allHotels.filter(h => selectedHotelIds.includes(h.hotelId)).map(h => {
              const reason = options.unquotable.get(h.hotelId);
              return (
                <div key={h.hotelId} className={cn('rounded-xl border p-2.5', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                  <div className="mb-1.5">
                    <span className={cn('text-[12.5px] font-bold', getTextColor())}>{h.hotelName}</span>
                    {h.starLabel && <span className={cn('ml-1.5 text-[10px]', getSecondaryTextColor())}>{h.starLabel}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DURATIONS.map(n => {
                      const cell = cellFor(h.hotelId, n);
                      const on = ticks[cellKey(h.hotelId, n)] === true;
                      const budget = cell ? cellBudget(cell.sellingTotal) : null;
                      const hiddenByBudget = !!(cell && hideOverBudget && budget && !budget.fits);
                      return (
                        <button key={n} onClick={() => cell && !hiddenByBudget && toggleCell(h.hotelId, n)} disabled={!cell || hiddenByBudget}
                          title={!cell && reason ? reason : hiddenByBudget ? 'Over the stated budget' : cell?.clientNote}
                          className={cn('flex flex-col items-center justify-center gap-0 px-1 py-1.5 rounded-lg border text-[12px] font-mono font-bold transition active:scale-[0.97] disabled:opacity-50',
                            on ? 'bg-slate-900 border-slate-900 text-white'
                               : cell?.clientNote ? cn(theme === 'light' ? 'bg-amber-50 border-amber-300 text-slate-700' : 'bg-amber-500/10 border-amber-500/40 text-white/70')
                               : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'))}>
                          <span className={cn('text-[9px] font-sans font-bold normal-case opacity-60')}>{n}N</span>
                          {cell && !hiddenByBudget ? (
                            <>
                              <span className="flex items-center gap-1">
                                <span className={cn('w-3 h-3 rounded flex items-center justify-center shrink-0 border',
                                  on ? 'bg-white border-white text-slate-900' : cn(theme === 'light' ? 'border-slate-300' : 'border-white/25'))}>
                                  {on && <Check size={9} strokeWidth={3.5} />}
                                </span>
                                {fmtINR(cell.sellingTotal)}
                                {cell.clientNote && <AlertTriangle size={9} className={on ? 'text-amber-300' : 'text-amber-600'} />}
                              </span>
                              {cell.planLabel && (
                                <span className={cn('text-[8.5px] font-sans font-semibold normal-case truncate max-w-full', on ? 'text-white/70' : 'opacity-50')}>{cell.planLabel}</span>
                              )}
                              {budget && (
                                <span title={budget.bucket === 'best-fit' ? 'Best fit' : budget.bucket === 'under' ? 'Under budget' : 'Over budget'}
                                  className={cn('text-[8.5px] font-sans font-bold normal-case',
                                    budget.bucket === 'best-fit' ? (on ? 'text-emerald-300' : 'text-emerald-600')
                                      : budget.bucket === 'under' ? (on ? 'text-sky-300' : 'text-sky-600')
                                      : (on ? 'text-rose-300' : 'text-rose-600'))}>
                                  {fmtINR(Math.round((cell.sellingTotal + (itineraryPrice?.sellingTotal ?? 0)) / pax))}/pp
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10.5px] font-sans normal-case opacity-50">{hiddenByBudget ? 'Over budget' : 'On request'}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Right: client message, pinned so it never needs scrolling to reach ─── */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:flex lg:flex-col">
          {MessagePanel}
        </div>
      </div>
    </div>
  );
};
