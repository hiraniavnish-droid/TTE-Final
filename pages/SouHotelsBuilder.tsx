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
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  Landmark, ArrowLeft, Minus, Plus, Check, Download, Copy, Loader2, ListChecks, MapPin,
} from 'lucide-react';
import { buildSouHotelOptions, listSouHotels, type SouOptionNights } from '../services/souHotelOptions';
import type { MarkupMode } from '../services/inlandRates';
import {
  SOU_ITINERARIES, TRANSPORT_REFERENCE, priceSouItinerary,
  type SouItineraryNights,
} from '../services/souItinerary';
import {
  buildSouCompareMessage, groupCompareHotelRates, fmtCompareDate, fmtINR,
  type CompareHotelRate,
} from '../services/souHotelCompareMessage';

const DURATIONS: SouOptionNights[] = [1, 2, 3];
const MARKUP_OPTIONS = [10, 12, 15, 18, 20];
const cellKey = (hotelId: string, n: number) => `${hotelId}::${n}`;

export const SouHotelsBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();

  const [checkInStr, setCheckInStr] = useState('2026-11-15');
  const [rooms, setRooms] = useState(1);
  const [pax, setPax] = useState(2);
  const [markupMode, setMarkupMode] = useState<MarkupMode>('percent');
  const [markupValue, setMarkupValue] = useState<number>(MARKUP_OPTIONS[1]);

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

  const options = useMemo(() => buildSouHotelOptions({
    checkIn: checkInStr, hotelIds: selectedHotelIds, durations: DURATIONS,
    rooms, pax, markupMode, markupValue,
  }), [checkInStr, selectedHotelIds, rooms, pax, markupMode, markupValue]);

  const cellFor = (hotelId: string, n: SouOptionNights) =>
    options.cells.find(c => c.hotelId === hotelId && c.nights === n);

  const toggleCell = (hotelId: string, n: SouOptionNights) =>
    setTicks(prev => ({ ...prev, [cellKey(hotelId, n)]: !prev[cellKey(hotelId, n)] }));

  const toggleRow = (hotelId: string) => setTicks(prev => {
    const all = DURATIONS.every(n => prev[cellKey(hotelId, n)] === true);
    const next = { ...prev };
    DURATIONS.forEach(n => { next[cellKey(hotelId, n)] = !all; });
    return next;
  });

  const selectedCells = useMemo(
    () => options.cells.filter(c => ticks[cellKey(c.hotelId, c.nights)] === true),
    [options, ticks]);

  const selectedRates: CompareHotelRate[] = useMemo(
    () => selectedCells.map(c => ({
      hotelId: c.hotelId, hotelName: c.hotelName, starLabel: c.starLabel,
      nights: c.nights, sellingTotal: c.sellingTotal,
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

  const compareGroups = useMemo(() => groupCompareHotelRates(selectedRates), [selectedRates]);

  const itineraryPrice = useMemo(
    () => includeItinerary ? priceSouItinerary({ nights: itineraryNights, pax, includeRailwayTransfer: includeTransfer }) : null,
    [includeItinerary, itineraryNights, pax, includeTransfer]);

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
      doc.text(`Check-in: ${fmtCompareDate(checkInStr)}`, 14, y); y += 6;
      doc.text(`${pax} guest(s)  ·  ${rooms} room(s)`, 14, y); y += 8;

      for (const g of compareGroups) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(`${g.hotelName}${g.starLabel ? ` (${g.starLabel})` : ''}`, 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text(g.rates.map(r => `${r.nights}N ${fmtINR(r.sellingTotal)}`).join('   ·   '), 14, y); y += 8;
      }

      if (itineraryPrice) {
        const it = itineraryPrice;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(`Sightseeing package — ${it.plan.label}`, 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text(`${fmtINR(it.sellingTotal)} for ${it.pax} guest(s) (${fmtINR(it.sellingPerPerson)}/person)`, 14, y); y += 6;
        const items = it.plan.ticketItems.map(t => t.name).join(', ');
        const wrapped = doc.splitTextToSize(items, W - 28);
        doc.text(wrapped, 14, y); y += wrapped.length * 5 + 3;
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

  const inputCls = cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass());
  const labelCls = cn('text-[11px] font-bold uppercase tracking-wider mb-1.5 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');

  const Stepper: React.FC<{ value: number; set: (n: number) => void; min?: number; max?: number }> = ({ value, set, min = 1, max = 30 }) => (
    <div className={cn('flex items-center rounded-lg border', theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5')}>
      <button onClick={() => set(Math.max(min, value - 1))} className="px-3 py-2.5 opacity-60 hover:opacity-100 active:scale-90 transition"><Minus size={14} /></button>
      <span className={cn('flex-1 text-center text-sm font-bold tabular-nums', getTextColor())}>{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="px-3 py-2.5 opacity-60 hover:opacity-100 active:scale-90 transition"><Plus size={14} /></button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/builder')} className="opacity-50 hover:opacity-100 active:scale-90 transition"><ArrowLeft size={20} /></button>
        <div className={cn('p-2 rounded-lg', theme === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-300')}><Landmark size={20} /></div>
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight leading-none', getTextColor())}>Statue of Unity Hotels</h1>
          <p className={cn('text-[12px] mt-1', getSecondaryTextColor())}>Kevadiya hotel comparison · optional sightseeing package</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* ─── Shared controls ─── */}
        <div className={cn('rounded-2xl border p-5', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10')}>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="col-span-2 lg:col-span-2">
              <label className={labelCls}>Check-in date</label>
              <input type="date" value={checkInStr} onChange={e => setCheckInStr(e.target.value)} className={cn(inputCls, 'font-mono')} />
            </div>
            <div>
              <label className={labelCls}>Rooms</label>
              <Stepper value={rooms} set={setRooms} min={1} max={20} />
            </div>
            <div>
              <label className={labelCls}>Guests</label>
              <Stepper value={pax} set={setPax} min={1} max={40} />
            </div>
            <div className="col-span-2 lg:col-span-2">
              <label className={labelCls}>Markup</label>
              <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                {MARKUP_OPTIONS.map(m => (
                  <button key={m} onClick={() => { setMarkupMode('percent'); setMarkupValue(m); }}
                    className={cn('flex-1 py-2.5 text-[12px] font-bold transition', markupMode === 'percent' && markupValue === m ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                    {m}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Hotel picker ─── */}
        <div className={cn('rounded-2xl border p-5', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10')}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} className="opacity-60" />
            <span className={cn('font-bold text-sm', getTextColor())}>Hotels to compare</span>
            <span className={cn('ml-auto text-[11px]', getSecondaryTextColor())}>{selectedHotelIds.length}/{allHotels.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allHotels.map(h => {
              const on = selectedHotelIds.includes(h.hotelId);
              return (
                <button key={h.hotelId} onClick={() => toggleHotel(h.hotelId)}
                  className={cn('px-3 py-1.5 rounded-full text-[12px] font-semibold border transition active:scale-[0.97]',
                    on ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'))}>
                  {h.hotelName}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Margin strip (internal only) ─── */}
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]', getSecondaryTextColor())}>
          <span className="font-bold uppercase tracking-wider opacity-60">Internal</span>
          {margin ? (
            <>
              <span>Net cost {margin.netLo === margin.netHi ? fmtINR(margin.netLo) : `${fmtINR(margin.netLo)} – ${fmtINR(margin.netHi)}`}</span>
              <span>Margin {margin.profitLo === margin.profitHi ? fmtINR(margin.profitLo) : `${fmtINR(margin.profitLo)} – ${fmtINR(margin.profitHi)}`}</span>
              <span className="opacity-60">per option ({selectedCells.length} ticked)</span>
            </>
          ) : (
            <span className="opacity-60">Tick a cell to see net cost and margin.</span>
          )}
        </div>

        {/* ─── Matrix ─── */}
        <div className={cn('rounded-2xl border overflow-hidden', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10')}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className={cn(theme === 'light' ? 'bg-slate-50' : 'bg-white/5')}>
                  <th className={cn('text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>Hotel</th>
                  {DURATIONS.map(n => (
                    <th key={n} className={cn('px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center w-[150px]', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>
                      {n}N / {n + 1}D
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allHotels.filter(h => selectedHotelIds.includes(h.hotelId)).map(h => (
                  <tr key={h.hotelId} className={cn('border-t', theme === 'light' ? 'border-slate-100' : 'border-white/5')}>
                    <td className="px-4 py-2.5 align-middle">
                      <button onClick={() => toggleRow(h.hotelId)} className="text-left group">
                        <span className={cn('text-[13px] font-bold', getTextColor())}>{h.hotelName}</span>
                        {h.starLabel && (
                          <span className={cn('block text-[10.5px]', getSecondaryTextColor())}>{h.starLabel}</span>
                        )}
                        <span className={cn('block text-[10px] opacity-0 group-hover:opacity-60 transition', getSecondaryTextColor())}>tick / untick the row</span>
                      </button>
                    </td>
                    {DURATIONS.map(n => {
                      const cell = cellFor(h.hotelId, n);
                      const on = ticks[cellKey(h.hotelId, n)] === true;
                      return (
                        <td key={n} className="px-2 py-2 text-center">
                          <button onClick={() => cell && toggleCell(h.hotelId, n)} disabled={!cell}
                            className={cn('w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg border text-[13px] font-mono font-bold transition active:scale-[0.97] disabled:opacity-40',
                              on ? 'bg-slate-900 border-slate-900 text-white'
                                 : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'))}>
                            <span className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 border',
                              on ? 'bg-white border-white text-slate-900' : cn(theme === 'light' ? 'border-slate-300' : 'border-white/25'))}>
                              {on && <Check size={11} strokeWidth={3.5} />}
                            </span>
                            {cell ? fmtINR(cell.sellingTotal) : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Itinerary ─── */}
        <div className={cn('rounded-2xl border p-5 space-y-3', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10')}>
          <button onClick={() => setIncludeItinerary(v => !v)} className="flex items-center gap-2.5 text-left">
            <span className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0 border transition',
              includeItinerary ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-300' : 'bg-white/5 border-white/20'))}>
              {includeItinerary && <Check size={13} strokeWidth={3.5} />}
            </span>
            <span>
              <span className={cn('text-[13px] font-bold', getTextColor())}>Include itinerary</span>
              <span className={cn('block text-[11.5px]', getSecondaryTextColor())}>
                Sightseeing package — independent of the hotel nights ticked above.
              </span>
            </span>
          </button>

          {includeItinerary && (
            <div className="pt-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Itinerary plan</label>
                  <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                    {(Object.values(SOU_ITINERARIES)).map(p => (
                      <button key={p.nights} onClick={() => setItineraryNights(p.nights)}
                        className={cn('flex-1 py-2.5 text-[12px] font-bold transition', itineraryNights === p.nights ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <button onClick={() => setIncludeTransfer(v => !v)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[12px] font-bold transition',
                      includeTransfer ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/60'))}>
                    <span className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 border',
                      includeTransfer ? 'bg-white border-white text-slate-900' : cn(theme === 'light' ? 'border-slate-300' : 'border-white/25'))}>
                      {includeTransfer && <Check size={11} strokeWidth={3.5} />}
                    </span>
                    Railway station transfer
                  </button>
                </div>
              </div>

              <div className={cn('rounded-lg p-3 text-[12px] leading-relaxed', theme === 'light' ? 'bg-slate-50 text-slate-600' : 'bg-black/20 text-white/70')}>
                {SOU_ITINERARIES[itineraryNights].ticketItems.map(t => t.name).join(' · ')}
              </div>

              {itineraryPrice && (
                <>
                  <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]', getSecondaryTextColor())}>
                    <span className="font-bold uppercase tracking-wider opacity-60">Internal</span>
                    <span>Net {fmtINR(itineraryPrice.netTotal)}</span>
                    <span>Markup {fmtINR(itineraryPrice.markupTotal)} (₹100/person/day × {itineraryPrice.pax} × {itineraryPrice.days})</span>
                    <span className="font-bold">Selling {fmtINR(itineraryPrice.sellingTotal)}</span>
                  </div>
                  <div className={cn('rounded-lg p-3 text-[11.5px] leading-relaxed italic', theme === 'light' ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300')}>
                    Golf Cart / E-Rickshaw are reference-only — never part of this price. {Object.values(TRANSPORT_REFERENCE).map(t => `${t.label}: ${fmtINR(t.perVehicle)}/vehicle (seats ${t.capacity})`).join(' · ')}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── Client-facing message ─── */}
        <div className={cn('rounded-2xl border p-5', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]' : 'bg-white/5 border-white/10')}>
          <div className="flex items-center gap-2 mb-3">
            <ListChecks size={16} className="opacity-60" />
            <span className={cn('font-bold text-sm', getTextColor())}>Message to client</span>
            <span className={cn('ml-auto text-[11px] font-mono', getSecondaryTextColor())}>{compareText().length} chars</span>
          </div>

          {selectedRates.length === 0 ? (
            <p className={cn('text-[12.5px]', getSecondaryTextColor())}>Tick the hotel rates you want to share.</p>
          ) : (
            <>
              <pre className={cn('text-[11.5px] leading-relaxed whitespace-pre-wrap font-sans p-3 rounded-lg max-h-72 overflow-y-auto',
                theme === 'light' ? 'bg-slate-50 text-slate-700' : 'bg-black/20 text-white/75')}>{compareText()}</pre>
              <div className="grid grid-cols-2 gap-2 pt-3">
                <button onClick={downloadComparePdf} disabled={comparePdfBusy}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-60">
                  {comparePdfBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF
                </button>
                <button onClick={copyCompare}
                  className={cn('flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-bold border active:scale-[0.97] transition',
                    theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80')}>
                  <Copy size={15} /> Copy
                </button>
              </div>
              <button onClick={shareCompare}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-500 active:scale-[0.97] transition">
                Share on WhatsApp
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
