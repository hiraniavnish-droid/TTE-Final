import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn, generateId } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  Building2, ArrowLeft, Download, Copy, Loader2, Minus, Plus, Trash2,
  AlertTriangle, LayoutGrid, Zap, MapPin,
} from 'lucide-react';
import { RAJARSHI_HOTELS, RAJARSHI_SUPPLIER, type RajCity, type RajPlan } from '../services/rajarshiData';
import { quoteStay, hotelsByCity, fmtINR, type MarkupMode } from '../services/rajarshiRates';
import { bandHotels, formatClientExport, isQuotable, type WallEntry, type QuotableRow } from '../services/rateWall';
import { buildRajarshiWall, rajarshiJumpChips } from '../services/rajarshiWall';
import { RateWallControls } from '../components/ratewall/RateWallControls';
import { RateWallCard } from '../components/ratewall/RateWallCard';

type Mode = 'package' | 'rates';
// Derived once at module load from the sheet's own festive windows.
const JUMP_CHIPS = rajarshiJumpChips();
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

  const [mode, setMode] = useState<Mode>('rates');
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

  // ── Rate wall mode ──
  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [wall, setWall] = useState({ city: CITIES[0] as string, checkIn: todayISO, nights: 1, rooms: 1, pax: 2 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const togglePick = (key: string) => setPicked(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const wallEntries = useMemo(() => buildRajarshiWall({
    city: wall.city as RajCity | 'ALL', checkIn: wall.checkIn, nights: wall.nights,
    rooms: wall.rooms, pax: wall.pax,
    markupMode, markupValue,
  }), [wall, markupMode, markupValue]);

  const banded = useMemo(() => bandHotels(wallEntries), [wallEntries]);

  const pickedSelections = useMemo(() => {
    // isQuotable rather than row.quotable — the repo's tsconfig omits strict, so
    // the boolean discriminant alone will not narrow row to QuotableRow and this
    // array would not typecheck.
    const out: { entry: WallEntry; row: QuotableRow }[] = [];
    for (const entry of wallEntries) {
      for (const row of entry.rows) {
        if (isQuotable(row) && picked.has(row.key)) out.push({ entry, row });
      }
    }
    return out.sort((a, b) => a.row.sellingTotal - b.row.sellingTotal);
  }, [wallEntries, picked]);

  const pickedTotal = pickedSelections.reduce((s, x) => s + x.row.sellingTotal, 0);

  const wallCheckOut = useMemo(() => {
    const [y, m, d] = wall.checkIn.split('-').map(Number);
    const dt = new Date(y, m - 1, d + wall.nights);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }, [wall.checkIn, wall.nights]);

  const cityLabel = wall.city === 'ALL' ? 'Kutch' : wall.city;

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

  // mealLabel is deliberately omitted: a selection can now mix meal plans, and
  // each line prints its own, so there is no single plan to state up top.
  const buildRatesText = (): string => formatClientExport(pickedSelections, {
    supplierName: RAJARSHI_SUPPLIER.name,
    cityLabel,
    clientName,
    checkIn: wall.checkIn,
    checkOut: wallCheckOut,
    nights: wall.nights,
    rooms: wall.rooms,
    pax: wall.pax,
    inclusions: 'GST included',
  });

  const activeText = mode === 'package' ? buildPackageText : buildRatesText;

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
      : pickedSelections.map(s => ({ title: s.entry.hotelName, sub: `${s.row.roomName}${s.row.planLabel ? ' · ' + s.row.planLabel : ''}`, price: fmtINR(s.row.sellingTotal) }));
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
      doc.text(mode === 'package' ? 'Kutch Package Quotation' : `${cityLabel} — Hotel Options`, 14, 22);
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

      doc.save(`${mode === 'package' ? 'Kutch Package' : cityLabel + ' Options'} — ${clientName || 'Guest'}.pdf`);
      toast.success('PDF downloaded');
    } catch (e: any) {
      toast.error('PDF failed: ' + (e?.message || 'error'));
    } finally {
      setPdfBusy(false);
    }
  };

  const inputCls = cn('w-full px-3 py-2 rounded-lg border outline-none text-sm', getInputClass());
  const compactInput = cn('px-2 py-1.5 rounded-lg border outline-none text-[13px]', getInputClass());
  const labelCls = cn('text-[10.5px] font-bold uppercase tracking-wider mb-1 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');
  const miniLabel = cn('text-[10px] font-bold uppercase tracking-wider mb-0.5 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');

  // The header's running total follows whichever mode is on screen, because the
  // export buttons beside it do too.
  const headerCount = mode === 'package' ? legQuotes.length : pickedSelections.length;
  const headerTotal = mode === 'package' ? packageTotal.sellingPrice : pickedTotal;
  const headerTotalUnknown = mode === 'package' && anyOnRequest;

  const headerBtn = cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold border active:scale-[0.97] transition',
    theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80 hover:border-white/30');

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-16">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <button onClick={() => navigate('/builder')} title="Back to the builder list" className="opacity-50 hover:opacity-100 active:scale-90 transition"><ArrowLeft size={18} /></button>
        <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-300')}><Building2 size={16} /></div>
        <div className="mr-1">
          <h1 className={cn('text-[17px] font-bold tracking-tight leading-none', getTextColor())}>{RAJARSHI_SUPPLIER.name}</h1>
          <p className={cn('text-[10px] mt-1 leading-none', getSecondaryTextColor())}>Season {RAJARSHI_SUPPLIER.season} · {RAJARSHI_SUPPLIER.location} · {RAJARSHI_HOTELS.length} hotels</p>
        </div>

        <div className={cn('inline-flex p-0.5 rounded-lg border', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
          {([['package', 'Build Package', LayoutGrid], ['rates', 'Rates', Zap]] as [Mode, string, any][]).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-bold transition-all active:scale-[0.98]',
                mode === m ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'text-slate-500 hover:text-slate-800' : 'text-white/50 hover:text-white/80'))}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className={cn('text-[11.5px] font-semibold tabular-nums', headerCount ? getTextColor() : getSecondaryTextColor())}>
            {headerCount === 0
              ? (mode === 'rates' ? 'Tick any plan to add it' : 'No nights added')
              : `${headerCount} selected · ${headerTotalUnknown ? 'On request' : fmtINR(headerTotal)}`}
          </span>
          <button onClick={copyText} title="Copy the quotation as WhatsApp-ready text — exports carry final rates only, never net or margin" className={headerBtn}>
            <Copy size={13} /> Copy
          </button>
          <button onClick={downloadPdf} disabled={pdfBusy} title="Download the quotation as a PDF — exports carry final rates only, never net or margin"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11.5px] font-bold hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-60">
            {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
          </button>
          <button onClick={openWhatsApp} title="Open WhatsApp with the quotation — exports carry final rates only, never net or margin"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11.5px] font-bold hover:bg-emerald-500 active:scale-[0.97] transition">
            Send
          </button>
        </div>
      </div>

      <div className={cn('flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border px-3 py-2.5 mb-3',
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
        <div className="flex-1 min-w-[200px]">
          <label className={miniLabel}>Guest name</label>
          <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Mr. Avnish Hirani" className={cn(compactInput, 'w-full')} />
        </div>
        <div>
          <label className={miniLabel}>Markup</label>
          <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
            {(['percent', 'flat'] as MarkupMode[]).map(m => (
              <button key={m} onClick={() => setMarkupMode(m)}
                className={cn('px-2.5 py-1.5 text-[12px] font-bold transition', markupMode === m ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                {m === 'percent' ? '%' : '₹ flat/room-night'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={miniLabel}>{markupMode === 'percent' ? 'Markup %' : 'Markup ₹/room/night'}</label>
          <input type="number" inputMode="decimal" min={0} value={markupValue}
            onChange={e => setMarkupValue(Math.max(0, Number(e.target.value) || 0))} className={cn(compactInput, 'font-mono w-28')} />
        </div>
      </div>

      {mode === 'package' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
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
          </div>

          <div className="lg:col-span-2">
            <div className={cn('rounded-2xl border p-5 lg:sticky lg:top-4', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]' : 'bg-white/5 border-white/10')}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={16} className="opacity-60" />
                <span className={cn('font-bold text-sm', getTextColor())}>Package Summary</span>
              </div>

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
      ) : (
        <div className="space-y-3">
          <RateWallControls
            jumps={JUMP_CHIPS}
            allLabel="All Kutch"
            values={wall}
            cities={CITIES as string[]}
            onChange={patch => { setWall(w => ({ ...w, ...patch })); if (patch.city) setPicked(new Set()); }}
          />

          {banded.bands.length === 0 && banded.onRequestOnly.length === 0 && (
            <p className={cn('text-[12px] text-center py-8', getSecondaryTextColor())}>
              No hotels listed for {cityLabel}.
            </p>
          )}

          {banded.bands.map(band => (
            <div key={band.id} className="space-y-1.5">
              {band.label && (
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    band.id === 'premium' ? 'bg-violet-100 text-violet-700'
                      : band.id === 'mid' ? 'bg-sky-100 text-sky-700'
                      : band.id === 'similar' ? 'bg-slate-100 text-slate-700'
                      : 'bg-emerald-100 text-emerald-700')}>{band.label}</span>
                  <span className={cn('flex-1 h-px', theme === 'light' ? 'bg-slate-200' : 'bg-white/10')} />
                </div>
              )}
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                {band.entries.map(entry => (
                  <RateWallCard key={entry.hotelId} entry={entry}
                    bandTone={band.id === 'premium' ? 'border-l-violet-400' : band.id === 'mid' ? 'border-l-sky-400' : band.id === 'similar' ? 'border-l-slate-400' : 'border-l-emerald-400'}
                    selectedKeys={picked} onToggle={togglePick} />
                ))}
              </div>
            </div>
          ))}

          {banded.onRequestOnly.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">On request</span>
                <span className={cn('flex-1 h-px', theme === 'light' ? 'bg-slate-200' : 'bg-white/10')} />
              </div>
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
                {banded.onRequestOnly.map(entry => (
                  <RateWallCard key={entry.hotelId} entry={entry} bandTone="border-l-amber-400"
                    selectedKeys={picked} onToggle={togglePick} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function nightsLabel(n: number) { return `${n}N/${n + 1}D`; }
