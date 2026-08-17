import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  Home, ArrowLeft, Percent, IndianRupee, Download, Copy,
  Loader2, AlertTriangle, Minus, Plus, Flame,
} from 'lucide-react';
import {
  quoteCottage, quoteVilla, PLANS, PLAN_LABEL, COTTAGE_TYPES, VILLA_TYPES, VILLA_PAX,
  fmtINR, FULL_SEASON, type Plan, type CottageType, type VillaType, type QuoteResult,
} from '../services/souTentCityRates';
import { COMMISSION_OPTIONS } from '../services/leadCostingEngine';

type Product = 'cottage' | 'villa';
const DISCOUNTS = [0, 5, 6, 7];

const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const SouTentCityBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();

  const [product, setProduct] = useState<Product>('cottage');
  const [clientName, setClientName] = useState('');
  const [plan, setPlan] = useState<Plan>('Experiential');
  const [cottageType, setCottageType] = useState<CottageType>('Premium Cottage');
  const [villa, setVilla] = useState<VillaType>('Royal Villa');
  const [checkInStr, setCheckInStr] = useState('2026-11-10');
  const [nights, setNights] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [occupancy, setOccupancy] = useState<'double' | 'single'>('double');
  const [extraMattress, setExtraMattress] = useState(0);
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
  const outOfSeason = isNaN(checkIn.getTime()) || checkIn < FULL_SEASON.start || checkIn > FULL_SEASON.end;

  const quote: QuoteResult | null = useMemo(() => {
    if (outOfSeason) return null;
    if (product === 'cottage') {
      return quoteCottage({ plan, roomType: cottageType, checkIn, nights, rooms, single: occupancy === 'single', extraMattress, commissionPct, discountPct: discount });
    }
    return quoteVilla({ villa, checkIn, nights, rooms, extraMattress, commissionPct, discountPct: discount });
  }, [product, plan, cottageType, villa, checkIn, nights, rooms, occupancy, extraMattress, commissionPct, discount, outOfSeason]);

  const productLabel = product === 'cottage' ? `${cottageType} — ${PLAN_LABEL[plan]}` : `${villa} (Experiential, flat, ${VILLA_PAX[villa]} pax)`;
  const nightsLabel = `${nights}N / ${nights + 1}D`;
  const maxPax = product === 'villa' ? VILLA_PAX[villa] : undefined;

  // ─── Quotation text (WhatsApp) ───
  const buildText = (): string => {
    if (!quote) return '';
    const L: string[] = [];
    L.push('*THE TOURISM EXPERTS*');
    L.push('*Statue of Unity — Tent City-1 Quotation*');
    L.push('');
    if (clientName) L.push(`Guest: ${clientName}`);
    L.push(`Accommodation: ${productLabel}`);
    L.push(`Check-in: ${fmtDate(checkIn)}  |  ${nightsLabel}`);
    L.push(`${product === 'cottage' ? 'Cottages' : 'Villas'}: ${rooms}  |  ${product === 'cottage' ? (occupancy === 'single' ? 'Single occupancy' : 'Double occupancy') : `Max ${maxPax} pax/villa`}`);
    if (children) L.push(`Children under 6: ${children} (complimentary)`);
    L.push('');
    if (quote.perNight) {
      L.push('Nightly rate (per person):');
      quote.perNight.forEach(p => L.push(`  ${fmtDate(p.date)} — ${fmtINR(p.perPerson)}${p.peak ? `  [+${fmtINR(p.peakAmount)}/cottage ${p.peak} surcharge]` : ''}`));
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
    L.push('_Rates exclusive of tickets, transfers & non-included meals unless on Experiential plan. Extra mattress charges are not discountable._');
    L.push('The Tourism Experts');
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

      doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text('THE TOURISM EXPERTS', 14, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(203, 213, 225);
      doc.text('Statue of Unity — Tent City-1  ·  Quotation', 14, 22);
      y = 40;

      doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(clientName || 'Guest Quotation', 14, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...muted);
      const meta = [
        `Accommodation: ${productLabel}`,
        `Check-in: ${fmtDate(checkIn)}   |   ${nightsLabel}`,
        `${product === 'cottage' ? 'Cottages' : 'Villas'}: ${rooms}   |   ${product === 'cottage' ? (occupancy === 'single' ? 'Single occupancy' : 'Double occupancy') : `Max ${maxPax} pax/villa`}`,
        children ? `Children under 6: ${children} (complimentary)` : '',
      ].filter(Boolean);
      meta.forEach(m => { doc.text(m, 14, y); y += 6; });
      y += 3;

      doc.setDrawColor(226, 232, 240); doc.line(14, y, W - 14, y); y += 7;
      doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('Price Breakdown', 14, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);

      const row = (label: string, value: string, bold = false, color = slate) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color);
        doc.text(label, 14, y); doc.text(value, W - 14, y, { align: 'right' }); y += 6.5;
      };

      if (quote.perNight) {
        quote.perNight.forEach(p => row(`${fmtDate(p.date)} — per person${p.peak ? ` (${p.peak} peak)` : ''}`, fmtINR(p.perPerson) + (p.peak ? ` +${fmtINR(p.peakAmount)}/cottage` : ''), false, muted));
      }
      row(`Room rent${rooms > 1 ? ` (${rooms})` : ''}${product === 'cottage' && occupancy === 'single' ? ' · single occ. 75%' : ''}`, fmtINR(quote.roomRent), true);
      if (quote.discountPct > 0) row(`Discount (${quote.discountPct}%)`, '- ' + fmtINR(quote.clientDiscountAmount), false, [194, 65, 12] as any);
      quote.extras.forEach(e => row(e.label + (e.note ? `  (${e.note})` : ''), fmtINR(e.amount), false, muted));
      doc.setDrawColor(226, 232, 240); doc.line(14, y - 2, W - 14, y - 2); y += 3;
      row('Sub-total', fmtINR(quote.clientBeforeTax));
      row('GST @ 18%', fmtINR(quote.clientGst), false, muted);
      y += 2;

      doc.setFillColor(240, 244, 248); doc.rect(14, y - 4, W - 28, 12, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...slate);
      doc.text('GRAND TOTAL', 18, y + 3.5);
      doc.text(fmtINR(quote.sellingPrice), W - 18, y + 3.5, { align: 'right' }); y += 18;

      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...muted);
      doc.text('Rates exclusive of tickets, transfers & non-included meals unless on the Experiential plan. Extra mattress charges are not discountable.', 14, y); y += 4;
      doc.text('Children below 6 years complimentary. Subject to availability at time of booking.', 14, y);

      doc.save(`SOU Tent City Quote — ${clientName || 'Guest'}.pdf`);
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
        <div className={cn('p-2 rounded-lg', theme === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-300')}><Home size={20} /></div>
        <div>
          <h1 className={cn('text-2xl font-bold tracking-tight leading-none', getTextColor())}>SOU Tent City-1 Quotation</h1>
          <p className={cn('text-[12px] mt-1', getSecondaryTextColor())}>1 Jul 2026 – 31 Mar 2027 · Cottage & Villa rate builder</p>
        </div>
      </div>

      {/* Product tabs */}
      <div className={cn('inline-flex p-1 rounded-xl border mb-6', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
        {([['cottage', 'Premium / Royal Cottage'], ['villa', 'Royal / Presidential Villa']] as [Product, string][]).map(([p, label]) => (
          <button key={p} onClick={() => { setProduct(p); if (p === 'villa') { setOccupancy('double'); setPlan('Experiential'); } }}
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

            {product === 'cottage' ? (
              <>
                <div>
                  <label className={labelCls}>Meal plan</label>
                  <select value={plan} onChange={e => setPlan(e.target.value as Plan)} className={cn(inputCls, '[&>option]:text-black')}>
                    {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Cottage type</label>
                  <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
                    {COTTAGE_TYPES.map(t => (
                      <button key={t} onClick={() => setCottageType(t)}
                        className={cn('flex-1 py-2.5 text-[12px] font-bold transition', cottageType === t ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls}>Villa type</label>
                <select value={villa} onChange={e => setVilla(e.target.value as VillaType)} className={cn(inputCls, '[&>option]:text-black')}>
                  {VILLA_TYPES.map(v => <option key={v} value={v}>{v} ({VILLA_PAX[v]} pax, flat, Experiential)</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Check-in date</label>
                <input type="date" value={checkInStr} onChange={e => setCheckInStr(e.target.value)} className={cn(inputCls, 'font-mono')} />
              </div>
              <div>
                <label className={labelCls}>Nights</label>
                <Stepper value={nights} set={setNights} min={1} max={14} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{product === 'cottage' ? 'Cottages' : 'Villas'}</label>
                <Stepper value={rooms} set={setRooms} min={1} max={30} />
              </div>
              {product === 'cottage' && (
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
                <label className={labelCls}>Extra mattress <span className="opacity-50 normal-case">(not discounted)</span></label>
                <Stepper value={extraMattress} set={setExtraMattress} />
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
                <p className="text-xs leading-relaxed">Check-in is outside the published rate card window (1 Jul 2026 – 31 Mar 2027). Pick an in-season date.</p>
              </div>
            ) : quote && (
              <div className="space-y-1.5 text-sm">
                {quote.perNight && (
                  <div className="mb-2 space-y-1">
                    {quote.perNight.map((p, i) => (
                      <div key={i} className="flex justify-between text-[12px]">
                        <span className={getSecondaryTextColor()}>
                          {fmtDate(p.date)}
                          {p.peak && <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-500 font-bold"><Flame size={10} />{p.peak}</span>}
                        </span>
                        <span className={cn('font-mono', getTextColor())}>{fmtINR(p.perPerson)}{p.peak ? ` +${fmtINR(p.peakAmount)}/cottage` : ''}</span>
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
