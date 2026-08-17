import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  Tent, ArrowLeft, Calendar, Users, Moon, Percent, IndianRupee, Download, Copy,
  Building2, User, Bed, Loader2, AlertTriangle, Minus, Plus,
} from 'lucide-react';
import {
  quoteResort, quoteTentCity, resortTier, tcTier, TC_TENT_TYPES, TC_TIER_LABEL,
  isSuite, fmtINR, RESORT_SEASON, TC_SEASON, TC_SUITE, type TCTentType, type QuoteResult,
} from '../services/rannUtsavRates';
import { COMMISSION_OPTIONS } from '../services/leadCostingEngine';

type Product = 'resort' | 'tentcity';
const DISCOUNTS = [0, 5, 6, 7];

const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const RannUtsavBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();

  const [product, setProduct] = useState<Product>('tentcity');
  const [clientName, setClientName] = useState('');
  const [tent, setTent] = useState<TCTentType>('Super Premium Tent');
  const [checkInStr, setCheckInStr] = useState('2026-11-15');
  const [nights, setNights] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [occupancy, setOccupancy] = useState<'double' | 'single'>('double');
  const [extraPersons, setExtraPersons] = useState(0);
  const [children, setChildren] = useState(0);
  // Client-facing page: commission never affects any figure shown here (the client
  // side is rack − discount + extras + GST). Pinned so the shared engine signature
  // is satisfied; the supplier/profit half of its result is simply not rendered.
  const commissionPct = COMMISSION_OPTIONS[0];
  const [discount, setDiscount] = useState(0);
  const [customDiscountOpen, setCustomDiscountOpen] = useState(false);
  const [customDiscountStr, setCustomDiscountStr] = useState('');
  const isCustomDiscount = customDiscountOpen || !DISCOUNTS.includes(discount);
  const [pdfBusy, setPdfBusy] = useState(false);

  const checkIn = useMemo(() => new Date(checkInStr + 'T00:00:00'), [checkInStr]);
  const suite = product === 'tentcity' && isSuite(tent);
  const maxNights = product === 'resort' ? 2 : 3;
  const season = product === 'resort' ? RESORT_SEASON : TC_SEASON;
  const outOfSeason = isNaN(checkIn.getTime()) || checkIn < season.start || checkIn > season.end;

  const nightsOpts = product === 'resort' ? [1, 2] : [1, 2, 3];
  const effNights = Math.min(nights, maxNights);

  const quote: QuoteResult | null = useMemo(() => {
    if (outOfSeason) return null;
    if (product === 'resort') {
      return quoteResort({ checkIn, nights: effNights, rooms, single: occupancy === 'single', extraPax: extraPersons, commissionPct, discountPct: discount });
    }
    return quoteTentCity({ tent, checkIn, nights: effNights, rooms, single: occupancy === 'single' && !suite, extraMattress: extraPersons, commissionPct, discountPct: discount });
  }, [product, tent, checkIn, effNights, rooms, occupancy, extraPersons, commissionPct, discount, outOfSeason, suite]);

  const productLabel = product === 'resort' ? 'Rann Tent Resort' : 'Rann Utsav — The Tent City';
  const tentLabel = product === 'resort' ? 'Premium AC Tent' : tent;
  const nightsLabel = `${effNights}N / ${effNights + 1}D`;
  const extraLabel = product === 'resort' ? 'Extra persons' : 'Extra mattress';

  // ─── Quotation text (WhatsApp) ───
  const buildText = (): string => {
    if (!quote) return '';
    const L: string[] = [];
    L.push('*THE TOURISM EXPERTS*');
    L.push('*Rann Utsav 2026-27 Quotation*');
    L.push('');
    if (clientName) L.push(`Guest: ${clientName}`);
    L.push(`Package: ${productLabel}`);
    L.push(`Accommodation: ${tentLabel}`);
    L.push(`Check-in: ${fmtDate(checkIn)}  |  ${nightsLabel}`);
    L.push(`Rooms: ${rooms}  |  ${suite ? 'Suite' : occupancy === 'single' ? 'Single occupancy' : 'Double occupancy'}`);
    if (children) L.push(`Children under 6: ${children} (complimentary)`);
    L.push('');
    if (quote.perNight) {
      L.push('Nightly rate (per couple):');
      quote.perNight.forEach(p => L.push(`  ${fmtDate(p.date)} — ${p.tier}: ${fmtINR(p.rate)}`));
    } else if (quote.tcTierUsed) {
      L.push(`Rate basis: ${TC_TIER_LABEL[quote.tcTierUsed]}`);
    }
    L.push('');
    L.push(`Room rent: ${fmtINR(quote.roomRent)}`);
    if (quote.discountPct > 0) L.push(`Discount (${quote.discountPct}%): -${fmtINR(quote.clientDiscountAmount)}`);
    quote.extras.forEach(e => L.push(`${e.label}: ${fmtINR(e.amount)}`));
    L.push(`Sub-total: ${fmtINR(quote.clientBeforeTax)}`);
    L.push(`GST @18%: ${fmtINR(quote.clientGst)}`);
    L.push('');
    L.push(`*GRAND TOTAL: ${fmtINR(quote.sellingPrice)}*`);
    L.push('');
    L.push('_Rates inclusive of taxes as shown. Extra mattress/person charges are not discountable._');
    L.push('The Tourism Experts · +91 7096090666 · rannutsav.in');
    return L.join('\n');
  };

  const copyText = () => {
    const t = buildText();
    if (!t) { toast.error('Complete the quote first.'); return; }
    navigator.clipboard.writeText(t).then(
      () => toast.success('Quotation copied — paste into WhatsApp!'),
      () => toast.error('Copy failed'),
    );
  };

  const openWhatsApp = () => {
    const t = buildText();
    if (!t) { toast.error('Complete the quote first.'); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  };

  // ─── PDF ───
  const downloadPdf = async () => {
    if (!quote || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210; let y = 0;
      const slate = [15, 23, 42] as const; const muted = [100, 116, 139] as const;

      // header band
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text('THE TOURISM EXPERTS', 14, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(203, 213, 225);
      doc.text('Rann Utsav 2026-27  ·  Quotation', 14, 22);
      doc.setFontSize(8); doc.text('+91 7096090666   ·   rannutsav.in', W - 14, 22, { align: 'right' });
      y = 40;

      // guest / package box
      doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(clientName || 'Guest Quotation', 14, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...muted);
      const meta = [
        `Package: ${productLabel}`,
        `Accommodation: ${tentLabel}   |   ${nightsLabel}`,
        `Check-in: ${fmtDate(checkIn)}    Rooms: ${rooms}   |   ${suite ? 'Suite' : occupancy === 'single' ? 'Single occupancy' : 'Double occupancy'}`,
        children ? `Children under 6: ${children} (complimentary)` : '',
      ].filter(Boolean);
      meta.forEach(m => { doc.text(m, 14, y); y += 6; });
      y += 3;

      // nightly breakdown (resort) or basis (tent city)
      doc.setDrawColor(226, 232, 240); doc.line(14, y, W - 14, y); y += 7;
      doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('Price Breakdown', 14, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);

      const row = (label: string, value: string, bold = false, color = slate) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color);
        doc.text(label, 14, y); doc.text(value, W - 14, y, { align: 'right' }); y += 6.5;
      };

      if (quote.perNight) {
        quote.perNight.forEach(p => row(`${fmtDate(p.date)} — ${p.tier} (per couple)`, fmtINR(p.rate), false, muted));
      } else if (quote.tcTierUsed) {
        row(`Rate basis: ${TC_TIER_LABEL[quote.tcTierUsed]}`, '', false, muted);
      }
      row(`Room rent${rooms > 1 ? ` (${rooms} rooms)` : ''}${occupancy === 'single' && !suite ? ' · single occ. 75%' : ''}`, fmtINR(quote.roomRent), true);
      if (quote.discountPct > 0) row(`Discount (${quote.discountPct}%)`, '- ' + fmtINR(quote.clientDiscountAmount), false, [194, 65, 12] as any);
      quote.extras.forEach(e => row(e.label + (e.note ? `  (${e.note})` : ''), fmtINR(e.amount), false, muted));
      doc.setDrawColor(226, 232, 240); doc.line(14, y - 2, W - 14, y - 2); y += 3;
      row('Sub-total', fmtINR(quote.clientBeforeTax));
      row('GST @ 18%', fmtINR(quote.clientGst), false, muted);
      y += 2;

      // grand total band
      doc.setFillColor(240, 244, 248); doc.rect(14, y - 4, W - 28, 12, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...slate);
      doc.text('GRAND TOTAL', 18, y + 3.5);
      doc.text(fmtINR(quote.sellingPrice), W - 18, y + 3.5, { align: 'right' }); y += 18;

      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...muted);
      doc.text('Rates inclusive of taxes as shown. Extra mattress / extra person charges are not discountable.', 14, y); y += 4;
      doc.text('Children below 6 years complimentary. Subject to availability at time of booking.', 14, y);

      doc.save(`Rann Utsav Quote — ${clientName || 'Guest'}.pdf`);
      toast.success('Quotation PDF downloaded');
    } catch (e: any) {
      toast.error('PDF failed: ' + (e?.message || 'error'));
    } finally {
      setPdfBusy(false);
    }
  };

  const inputCls = cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass());
  const labelCls = cn('text-[11px] font-bold uppercase tracking-wider mb-1.5 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');

  const Stepper: React.FC<{ value: number; set: (n: number) => void; min?: number; max?: number }> = ({ value, set, min = 0, max = 20 }) => (
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
        <div className={cn('p-2 rounded-lg', theme === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-300')}><Tent size={20} /></div>
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight leading-none', getTextColor())}>Rann Utsav Quotation</h1>
          <p className={cn('text-[12px] mt-1', getSecondaryTextColor())}>Season 2026-27 · Tent Resort & Tent City rate builder</p>
        </div>
      </div>

      {/* Product tabs */}
      <div className={cn('inline-flex p-1 rounded-xl border mb-6', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
        {([['tentcity', 'Rann Utsav Tent City'], ['resort', 'Rann Tent Resort']] as [Product, string][]).map(([p, label]) => (
          <button key={p} onClick={() => { setProduct(p); setNights(2); if (p === 'resort') setOccupancy('double'); }}
            className={cn('px-4 py-2 rounded-lg text-[13px] font-bold transition-all active:scale-[0.98]',
              product === p ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'text-slate-500 hover:text-slate-800' : 'text-white/50 hover:text-white/80'))}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Form ─── */}
        <div className="lg:col-span-3 space-y-5">
          <div className={cn('rounded-2xl border p-5 space-y-4', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]' : 'bg-white/5 border-white/10')}>
            <div>
              <label className={labelCls}>Guest name</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Mr. Avnish Hirani" className={inputCls} />
            </div>

            {product === 'tentcity' && (
              <div>
                <label className={labelCls}>Accommodation type</label>
                <select value={tent} onChange={e => setTent(e.target.value as TCTentType)} className={cn(inputCls, '[&>option]:text-black')}>
                  {TC_TENT_TYPES.map(t => <option key={t} value={t}>{t}{isSuite(t) ? ` (${TC_SUITE[t].pax} pax, flat)` : ''}</option>)}
                </select>
              </div>
            )}
            {product === 'resort' && (
              <div className={cn('rounded-lg px-3 py-2.5 text-sm font-semibold border', theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/70')}>
                <Tent size={13} className="inline mr-1.5 -mt-0.5" /> Premium AC Tent — single room type
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Check-in date</label>
                <input type="date" value={checkInStr} onChange={e => setCheckInStr(e.target.value)} className={cn(inputCls, 'font-mono')} />
              </div>
              <div>
                <label className={labelCls}>Duration</label>
                <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                  {nightsOpts.map(n => (
                    <button key={n} onClick={() => setNights(n)}
                      className={cn('flex-1 py-2.5 text-[12px] font-bold transition', effNights === n ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                      {n}N/{n + 1}D
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Rooms / Tents</label>
                <Stepper value={rooms} set={setRooms} min={1} max={30} />
              </div>
              {!suite && (
                <div>
                  <label className={labelCls}>Occupancy</label>
                  <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                    {(['double', 'single'] as const).map(o => (
                      <button key={o} onClick={() => setOccupancy(o)}
                        className={cn('flex-1 py-2.5 text-[12px] font-bold capitalize transition', occupancy === o ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                        {o}{o === 'single' ? ' (75%)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{extraLabel} <span className="opacity-50 normal-case">(not discounted)</span></label>
                <Stepper value={extraPersons} set={setExtraPersons} />
              </div>
              <div>
                <label className={labelCls}>Children under 6 <span className="opacity-50 normal-case">(free)</span></label>
                <Stepper value={children} set={setChildren} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Discount on room rent</label>
              <div className="flex gap-2">
                {DISCOUNTS.map(d => (
                  <button key={d} onClick={() => { setDiscount(d); setCustomDiscountOpen(false); setCustomDiscountStr(''); }}
                    className={cn('flex-1 py-2.5 rounded-lg text-sm font-bold border transition active:scale-[0.97]',
                      !isCustomDiscount && discount === d ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/50'))}>
                    {d === 0 ? 'None' : d + '%'}
                  </button>
                ))}
                <button
                  onClick={() => { setCustomDiscountOpen(true); setCustomDiscountStr(isCustomDiscount && discount ? String(discount) : ''); }}
                  className={cn('flex-1 py-2.5 rounded-lg text-sm font-bold border transition active:scale-[0.97] flex items-center justify-center gap-1',
                    isCustomDiscount ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/50'))}>
                  <Percent size={13} /> Custom
                </button>
              </div>
              {isCustomDiscount && (
                <div className="mt-2 relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.5}
                    autoFocus
                    value={customDiscountStr}
                    onChange={e => {
                      const raw = e.target.value;
                      setCustomDiscountStr(raw);
                      const n = parseFloat(raw);
                      setDiscount(!isNaN(n) && n >= 0 ? Math.min(n, 100) : 0);
                    }}
                    placeholder="Enter custom % (e.g. 8.5)"
                    className={cn(inputCls, 'pr-9 font-mono')}
                  />
                  <span className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Live quote ─── */}
        <div className="lg:col-span-2">
          <div className={cn('rounded-2xl border p-5 lg:sticky lg:top-4', theme === 'light' ? 'bg-white border-slate-200 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]' : 'bg-white/5 border-white/10')}>
            <div className="flex items-center gap-2 mb-4">
              <IndianRupee size={16} className="opacity-60" />
              <span className={cn('font-bold text-sm', getTextColor())}>Live Quotation</span>
            </div>

            {outOfSeason ? (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">Check-in is outside the {product === 'resort' ? 'Resort (10 Nov 2026 – 28 Feb 2027)' : 'Tent City (1 Nov 2026 – 7 Mar 2027)'} season. Pick an in-season date.</p>
              </div>
            ) : quote && (
              <div className="space-y-1.5 text-sm">
                {quote.tcTierUsed && (
                  <div className={cn('flex items-center gap-1.5 text-[11px] font-bold mb-2 px-2 py-1 rounded-md',
                    quote.tcTierUsed === 's2' ? 'bg-rose-50 text-rose-600' : quote.tcTierUsed === 's1' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                    <Moon size={11} /> {TC_TIER_LABEL[quote.tcTierUsed]}
                  </div>
                )}
                {quote.perNight && (
                  <div className="mb-2 space-y-1">
                    {quote.perNight.map((p, i) => (
                      <div key={i} className="flex justify-between text-[12px]">
                        <span className={getSecondaryTextColor()}>{fmtDate(p.date)} · <b className={p.tier === 'Premium' ? 'text-rose-500' : p.tier === 'Economy' ? 'text-sky-500' : 'text-amber-500'}>{p.tier}</b></span>
                        <span className={cn('font-mono', getTextColor())}>{fmtINR(p.rate)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Line label="Room rent" value={fmtINR(quote.roomRent)} bold />
                {quote.discountPct > 0 && <Line label={`Discount (${quote.discountPct}%)`} value={'- ' + fmtINR(quote.clientDiscountAmount)} accent />}
                {quote.extras.map((e, i) => <Line key={i} label={e.label} value={fmtINR(e.amount)} muted />)}
                <div className={cn('h-px my-2', theme === 'light' ? 'bg-slate-200' : 'bg-white/10')} />
                <Line label="Sub-total" value={fmtINR(quote.clientBeforeTax)} />
                <Line label="GST @ 18%" value={fmtINR(quote.clientGst)} muted />
                <div className={cn('flex justify-between items-center mt-3 p-3 rounded-xl', theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/10')}>
                  <span className="text-[13px] font-bold uppercase tracking-wide">Grand Total</span>
                  <span className="text-xl font-bold font-mono">{fmtINR(quote.sellingPrice)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Line: React.FC<{ label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }> = ({ label, value, bold, muted, accent }) => {
  const { getTextColor, getSecondaryTextColor } = useTheme();
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={cn('text-[12.5px]', accent ? 'text-orange-600 font-semibold' : muted ? getSecondaryTextColor() : bold ? cn('font-bold', getTextColor()) : getTextColor())}>{label}</span>
      <span className={cn('font-mono text-[13px]', accent ? 'text-orange-600 font-semibold' : bold ? cn('font-bold', getTextColor()) : muted ? getSecondaryTextColor() : getTextColor())}>{value}</span>
    </div>
  );
};
