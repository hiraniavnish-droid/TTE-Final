import { RannPdfOptions } from './RannPdfOptions';
import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, generateId } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  Sparkles, ChevronDown, ChevronUp, Percent, Download, Copy, Loader2, Minus, Plus, AlertTriangle,
} from 'lucide-react';
import { Lead, VendorDetail } from '../../types';
import {
  quoteResort, quoteTentCity, TC_TENT_TYPES, isSuite, TC_SUITE, RESORT_SEASON, TC_SEASON,
  type TCTentType,
} from '../../services/rannUtsavRates';
import {
  quoteCottage, quoteVilla, PLANS, PLAN_LABEL, COTTAGE_TYPES, VILLA_TYPES, VILLA_PAX, FULL_SEASON,
  type Plan, type CottageType, type VillaType,
} from '../../services/souTentCityRates';
import {
  computeCosting, matchDestination, COMMISSION_OPTIONS, SOURCE_LABEL, fmtINR, type CostingSource, type CostingBreakdown,
} from '../../services/leadCostingEngine';

type RannProduct = 'resort' | 'tentcity';
const DISCOUNTS = [0, 5, 6, 7];

const GST_RATE = 0.18;

interface Props {
  lead: Lead;
  onSaveVendor: (vendor: VendorDetail) => void;
  onLogNote: (content: string) => void;
}

export const QuoteEngineCostingPanel: React.FC<Props> = ({ lead, onSaveVendor, onLogNote }) => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass, getBorderClass } = useTheme();
  const autoMatch = useMemo(() => matchDestination(lead.tripDetails?.destination), [lead.tripDetails?.destination]);

  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<CostingSource>(autoMatch || 'rann-utsav');

  // Rann Utsav sub-state
  const [rannProduct, setRannProduct] = useState<RannProduct>('tentcity');
  const [tent, setTent] = useState<TCTentType>('Super Premium Tent');

  // SOU sub-state
  const [souKind, setSouKind] = useState<'cottage' | 'villa'>('cottage');
  const [plan, setPlan] = useState<Plan>('Experiential');
  const [cottageType, setCottageType] = useState<CottageType>('Premium Cottage');
  const [villa, setVilla] = useState<VillaType>('Royal Villa');

  // Shared fields
  const [checkInStr, setCheckInStr] = useState(lead.tripDetails?.startDate ? lead.tripDetails.startDate.slice(0, 10) : '2026-11-15');
  const [nights, setNights] = useState(lead.tripDetails?.nights || 2);
  const [rooms, setRooms] = useState(1);
  const [occupancy, setOccupancy] = useState<'double' | 'single'>('double');
  const [extraCount, setExtraCount] = useState(0);
  const [commissionPct, setCommissionPct] = useState<number>(COMMISSION_OPTIONS[0]);
  const [discount, setDiscount] = useState(0);
  const [customDiscountOpen, setCustomDiscountOpen] = useState(false);
  const [customDiscountStr, setCustomDiscountStr] = useState('');
  const isCustomDiscount = customDiscountOpen || !DISCOUNTS.includes(discount);
  const [multiplePdf, setMultiplePdf] = useState(false);
  const [extraPdfCategories, setExtraPdfCategories] = useState<TCTentType[]>([]);
  const shareCategories = [tent, ...extraPdfCategories.filter(category => category !== tent)];
  const [pdfBusy, setPdfBusy] = useState(false);

  const checkIn = useMemo(() => new Date(checkInStr + 'T00:00:00'), [checkInStr]);

  const suite = source === 'rann-utsav' && rannProduct === 'tentcity' && isSuite(tent);
  const isVilla = source === 'sou-tent-city' && souKind === 'villa';
  const singleEligible = !suite && !isVilla;

  const season = source === 'rann-utsav' ? (rannProduct === 'resort' ? RESORT_SEASON : TC_SEASON) : FULL_SEASON;
  const outOfSeason = isNaN(checkIn.getTime()) || checkIn < season.start || checkIn > season.end;

  // Base (undiscounted) quote from the underlying engine — we only need its
  // roomRent + extras breakdown; margin/discount/GST are computed separately.
  const base = useMemo(() => {
    if (outOfSeason) return null;
    if (source === 'rann-utsav') {
      if (rannProduct === 'resort') {
        return quoteResort({ checkIn, nights: Math.min(nights, 2), rooms, single: occupancy === 'single', extraPax: extraCount, commissionPct: 0, discountPct: 0 });
      }
      return quoteTentCity({ tent, checkIn, nights: Math.min(nights, 3), rooms, single: occupancy === 'single' && !suite, extraMattress: extraCount, commissionPct: 0, discountPct: 0 });
    }
    if (souKind === 'cottage') {
      return quoteCottage({ plan, roomType: cottageType, checkIn, nights, rooms, single: occupancy === 'single', extraMattress: extraCount, commissionPct: 0, discountPct: 0 });
    }
    return quoteVilla({ villa, checkIn, nights, rooms, extraMattress: extraCount, commissionPct: 0, discountPct: 0 });
  }, [source, rannProduct, tent, souKind, plan, cottageType, villa, checkIn, nights, rooms, occupancy, extraCount, suite, outOfSeason]);

  const costing: CostingBreakdown | null = useMemo(() => {
    if (!base) return null;
    return computeCosting(base.roomRent, base.extras, commissionPct, discount);
  }, [base, commissionPct, discount]);

  const productLabel = source === 'rann-utsav'
    ? (rannProduct === 'resort' ? 'Rann Tent Resort — Premium AC Tent' : `Rann Utsav Tent City — ${tent}`)
    : souKind === 'cottage' ? `SOU Tent City-1 — ${cottageType} (${PLAN_LABEL[plan]})` : `SOU Tent City-1 — ${villa}`;

  const nightsUsed = source === 'rann-utsav' ? (rannProduct === 'resort' ? Math.min(nights, 2) : Math.min(nights, 3)) : nights;

  // Final payable = margin-adjusted room rent + extras (at cost, never discounted), then 18% GST on the
  // whole thing — this is what the guest actually pays, distinct from the pre-GST "Selling Price" used
  // internally for the Costing Sheet's net-cost/profit tracking.
  const gstAmount = costing ? costing.clientGst : 0;
  const finalPayable = costing ? costing.sellingPrice : 0;

  const checkInLabel = checkIn.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Full readable snapshot — logged to Interaction History so there's a permanent, timestamped
  // record of exactly what room/category/plan/dates this quote was for, for future reference.
  const buildQuoteSnapshot = (): string => {
    if (!costing) return '';
    const L: string[] = [];
    L.push(`📋 Quote generated — ${SOURCE_LABEL[source]}${lead.leadCode ? ` (${lead.leadCode})` : ''}`);
    L.push(`Package: ${productLabel}`);
    L.push(`Check-in: ${checkInLabel}  |  ${nightsUsed}N/${nightsUsed + 1}D  |  ${isVilla ? 'Villas' : 'Rooms'}: ${rooms}${singleEligible ? `  |  ${occupancy === 'single' ? 'Single occ.' : 'Double occ.'}` : ''}`);
    if (extraCount) L.push(`Extra mattress: ${extraCount}`);
    L.push(`Rack room rent: ${fmtINR(costing.roomRent)}  |  Commission: ${costing.commissionPct}%  |  Client discount: ${costing.discountPct}%`);
    L.push(`You pay supplier: ${fmtINR(costing.netCost)} (incl. GST ${fmtINR(costing.payableGst)})`);
    L.push(`Client pays: ${fmtINR(costing.sellingPrice)} (incl. GST ${fmtINR(costing.clientGst)})`);
    L.push(`Profit: ${fmtINR(costing.profit)}  ($Net GST payable to govt: {fmtINR(costing.netGstPayable)})`);
    return L.join('\n');
  };

  const handleSave = () => {
    if (!costing) { toast.error('Complete the quote first.'); return; }
    const vendor: VendorDetail = {
      id: generateId(),
      name: `${productLabel} · ${nightsUsed}N/${nightsUsed + 1}D × ${rooms}`,
      cost: Math.round(costing.netCost),
      price: Math.round(costing.sellingPrice),
      category: SOURCE_LABEL[source],
    };
    onSaveVendor(vendor);
    onLogNote(buildQuoteSnapshot());
    toast.success('Added to Costing Sheet — logged in Interaction History.');
  };

  const buildClientText = (): string => {
    if (!costing) return '';
    const L: string[] = [];
    L.push('*THE TOURISM EXPERTS*');
    L.push(`*${SOURCE_LABEL[source]} Quotation*`);
    L.push('');
    L.push(`Guest: ${lead.name}`);
    if (lead.leadCode) L.push(`Ref: ${lead.leadCode}`);
    L.push(`Package: ${productLabel}`);
    L.push(`Check-in: ${checkInLabel}  |  ${nightsUsed}N/${nightsUsed + 1}D`);
    L.push(`${isVilla ? 'Villas' : 'Rooms'}: ${rooms}${singleEligible ? `  |  ${occupancy === 'single' ? 'Single occupancy' : 'Double occupancy'}` : ''}`);
    L.push('');
    L.push(`Package price: ${fmtINR(costing.clientBeforeTax)}`);
    L.push(`GST @18%: ${fmtINR(gstAmount)}`);
    L.push('');
    L.push(`*GRAND TOTAL: ${fmtINR(finalPayable)}*`);
    L.push('');
    L.push('_Extra mattress/person charges (if any) already included above and are not discountable._');
    L.push('The Tourism Experts');
    return L.join('\n');
  };

  const copyText = () => {
    const t = buildClientText();
    if (!t) { toast.error('Complete the quote first.'); return; }
    navigator.clipboard.writeText(t).then(
      () => toast.success('Quotation copied — paste into WhatsApp!'),
      () => toast.error('Copy failed'),
    );
  };

  const openWhatsApp = () => {
    const t = buildClientText();
    if (!t) { toast.error('Complete the quote first.'); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  };

  const downloadPdf = async () => {
    const multiple = multiplePdf && !isSuite(tent) && shareCategories.length > 1;
    if (!costing || pdfBusy) return;
    setPdfBusy(true);
    try {
      if (source === 'rann-utsav' && rannProduct === 'tentcity') {
        const { downloadRannQuotationPdf, downloadRannOptionsPdf } = await import('../../services/rannQuotationPdf');
        await (multiple ? (input: Parameters<typeof downloadRannQuotationPdf>[0]) => downloadRannOptionsPdf(input, shareCategories) : downloadRannQuotationPdf)({
          guestName: lead.name, reference: lead.leadCode, checkIn, nights: nightsUsed as 1 | 2 | 3,
          category: tent, rooms, single: occupancy === 'single', extraMattresses: extraCount,
          discountPct: discount,
        });
        toast.success('Quotation brochure downloaded');
        return;
      }
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210; let y = 0;
      const slate = [15, 23, 42] as const; const muted = [100, 116, 139] as const;

      doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      doc.text('THE TOURISM EXPERTS', 14, 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(203, 213, 225);
      doc.text(`${SOURCE_LABEL[source]}  ·  Quotation`, 14, 22);
      y = 40;

      doc.setTextColor(...slate); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(lead.name || 'Guest Quotation', 14, y);
      if (lead.leadCode) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
        doc.text(`Ref: ${lead.leadCode}`, W - 14, y, { align: 'right' });
      }
      y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...muted);
      const meta = [
        `Package: ${productLabel}`,
        `Check-in: ${checkIn.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}   |   ${nightsUsed}N/${nightsUsed + 1}D`,
        `${isVilla ? 'Villas' : 'Rooms'}: ${rooms}${singleEligible ? `   |   ${occupancy === 'single' ? 'Single occupancy' : 'Double occupancy'}` : ''}`,
      ];
      meta.forEach(m => { doc.text(m, 14, y); y += 6; });
      y += 5;

      doc.setDrawColor(226, 232, 240); doc.line(14, y, W - 14, y); y += 9;
      const row = (label: string, value: string, bold = false, color: readonly [number, number, number] = slate) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color); doc.setFontSize(10);
        doc.text(label, 14, y); doc.text(value, W - 14, y, { align: 'right' }); y += 7;
      };
      row('Package price', fmtINR(costing.clientBeforeTax), true);
      row('GST @ 18%', fmtINR(gstAmount), false, muted);
      y += 2;

      doc.setFillColor(240, 244, 248); doc.rect(14, y - 4, W - 28, 12, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...slate);
      doc.text('GRAND TOTAL', 18, y + 3.5);
      doc.text(fmtINR(finalPayable), W - 18, y + 3.5, { align: 'right' }); y += 18;

      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...muted);
      doc.text('Subject to availability at time of booking.', 14, y);

      doc.save(`${SOURCE_LABEL[source]} Quote — ${lead.name || 'Guest'}.pdf`);
      toast.success('Quotation PDF downloaded');
    } catch (e: any) {
      toast.error('PDF failed: ' + (e?.message || 'error'));
    } finally {
      setPdfBusy(false);
    }
  };

  const inputCls = cn('w-full px-3 py-2 rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 text-sm', getInputClass());
  const labelCls = cn('text-[10.5px] font-bold uppercase tracking-wider mb-1 block', theme === 'light' ? 'text-slate-500' : 'text-white/50');

  const Stepper: React.FC<{ value: number; set: (n: number) => void; min?: number; max?: number }> = ({ value, set, min = 0, max = 20 }) => (
    <div className={cn('flex items-center rounded-lg border', theme === 'light' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5')}>
      <button onClick={() => set(Math.max(min, value - 1))} className="px-2.5 py-2 opacity-60 hover:opacity-100 active:scale-90 transition"><Minus size={13} /></button>
      <span className={cn('flex-1 text-center text-sm font-bold tabular-nums', getTextColor())}>{value}</span>
      <button onClick={() => set(Math.min(max, value + 1))} className="px-2.5 py-2 opacity-60 hover:opacity-100 active:scale-90 transition"><Plus size={13} /></button>
    </div>
  );

  return (
    <div className={cn('rounded-xl border overflow-hidden', theme === 'light' ? 'border-indigo-200 bg-indigo-50/40' : 'border-indigo-500/20 bg-indigo-500/5')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300')}>
            <Sparkles size={15} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <div className={cn('text-[13px] font-bold', getTextColor())}>Generate from Rate Card</div>
            <div className={cn('text-[10.5px]', getSecondaryTextColor())}>
              {autoMatch ? `Detected: ${SOURCE_LABEL[autoMatch]}` : 'Rann Utsav / SOU Tent City-1'}
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="opacity-50" /> : <ChevronDown size={16} className="opacity-50" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Source selector */}
          <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
            {(['rann-utsav', 'sou-tent-city'] as CostingSource[]).map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={cn('flex-1 py-2 text-[11.5px] font-bold transition', source === s ? 'bg-slate-900 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Product sub-selectors */}
          {source === 'rann-utsav' ? (
            <>
              <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
                {([['tentcity', 'Tent City'], ['resort', 'Tent Resort']] as [RannProduct, string][]).map(([p, label]) => (
                  <button key={p} onClick={() => { setRannProduct(p); setNights(p === 'resort' ? Math.min(nights, 2) : nights); }}
                    className={cn('flex-1 py-2 text-[11.5px] font-bold transition', rannProduct === p ? 'bg-slate-800 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                    {label}
                  </button>
                ))}
              </div>
              {rannProduct === 'tentcity' && (
                <div>
                  <label className={labelCls}>Accommodation</label>
                  <select value={tent} onChange={e => setTent(e.target.value as TCTentType)} className={cn(inputCls, '[&>option]:text-black')}>
                    {TC_TENT_TYPES.map(t => <option key={t} value={t}>{t}{isSuite(t) ? ` (${TC_SUITE[t].pax} pax, flat)` : ''}</option>)}
                  </select>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
                {([['cottage', 'Cottage'], ['villa', 'Villa']] as ['cottage' | 'villa', string][]).map(([k, label]) => (
                  <button key={k} onClick={() => { setSouKind(k); if (k === 'villa') { setOccupancy('double'); setPlan('Experiential'); } }}
                    className={cn('flex-1 py-2 text-[11.5px] font-bold transition', souKind === k ? 'bg-slate-800 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                    {label}
                  </button>
                ))}
              </div>
              {souKind === 'cottage' ? (
                <>
                  <div>
                    <label className={labelCls}>Meal plan</label>
                    <select value={plan} onChange={e => setPlan(e.target.value as Plan)} className={cn(inputCls, '[&>option]:text-black')}>
                      {PLANS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                    </select>
                  </div>
                  <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
                    {COTTAGE_TYPES.map(t => (
                      <button key={t} onClick={() => setCottageType(t)}
                        className={cn('flex-1 py-2 text-[11.5px] font-bold transition', cottageType === t ? 'bg-slate-800 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>Villa type</label>
                  <select value={villa} onChange={e => setVilla(e.target.value as VillaType)} className={cn(inputCls, '[&>option]:text-black')}>
                    {VILLA_TYPES.map(v => <option key={v} value={v}>{v} ({VILLA_PAX[v]} pax, flat)</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Shared fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Check-in date</label>
              <input type="date" value={checkInStr} onChange={e => setCheckInStr(e.target.value)} className={cn(inputCls, 'font-mono')} />
            </div>
            <div>
              <label className={labelCls}>Nights</label>
              <Stepper value={nights} set={setNights} min={1} max={source === 'rann-utsav' && rannProduct === 'resort' ? 2 : source === 'rann-utsav' ? 3 : 14} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isVilla ? 'Villas' : 'Rooms/Tents'}</label>
              <Stepper value={rooms} set={setRooms} min={1} max={30} />
            </div>
            {singleEligible && (
              <div>
                <label className={labelCls}>Occupancy</label>
                <div className={cn('flex rounded-lg border overflow-hidden', getBorderClass())}>
                  {(['double', 'single'] as const).map(o => (
                    <button key={o} onClick={() => setOccupancy(o)}
                      className={cn('flex-1 py-2 text-[11.5px] font-bold capitalize transition', occupancy === o ? 'bg-slate-800 text-white' : cn(theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Extra mattress <span className="opacity-50 normal-case">(not discounted)</span></label>
            <Stepper value={extraCount} set={setExtraCount} />
          </div>

          {/* Margin + discount */}
          <div>
            <label className={labelCls}>Your commission on room rent</label>
            <div className="flex gap-2">
              {COMMISSION_OPTIONS.map(m => (
                <button key={m} onClick={() => setCommissionPct(m)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-bold border transition active:scale-[0.97]',
                    commissionPct === m ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}>
                  {m}%
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Discount given to client (eats into margin)</label>
            <div className="flex gap-2">
              {DISCOUNTS.map(d => (
                <button key={d} onClick={() => { setDiscount(d); setCustomDiscountOpen(false); setCustomDiscountStr(''); }}
                  className={cn('flex-1 py-2 rounded-lg text-[13px] font-bold border transition active:scale-[0.97]',
                    !isCustomDiscount && discount === d ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}>
                  {d === 0 ? 'None' : d + '%'}
                </button>
              ))}
              <button
                onClick={() => { setCustomDiscountOpen(true); setCustomDiscountStr(isCustomDiscount && discount ? String(discount) : ''); }}
                className={cn('flex-1 py-2 rounded-lg text-[13px] font-bold border transition active:scale-[0.97] flex items-center justify-center gap-1',
                  isCustomDiscount ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}>
                <Percent size={12} />
              </button>
            </div>
            {isCustomDiscount && (
              <input
                type="number" inputMode="decimal" min={0} max={100} step={0.5} autoFocus
                value={customDiscountStr}
                onChange={e => {
                  const raw = e.target.value; setCustomDiscountStr(raw);
                  const n = parseFloat(raw); setDiscount(!isNaN(n) && n >= 0 ? Math.min(n, 100) : 0);
                }}
                placeholder="Custom % (e.g. 8.5)"
                className={cn(inputCls, 'mt-2 font-mono')}
              />
            )}
          </div>

          {/* Live costing */}
          {outOfSeason ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p className="text-[11.5px] leading-relaxed">Check-in is outside the published rate card window. Pick an in-season date.</p>
            </div>
          ) : costing && (
            <div className={cn('rounded-xl border p-3.5 space-y-1.5', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
              <CLine label="Rack room rent" value={fmtINR(costing.roomRent)} muted />
              {costing.extras.map((e, i) => <CLine key={i} label={e.label} value={fmtINR(e.amount)} muted />)}
              <div className={cn('h-px my-1.5', theme === 'light' ? 'bg-slate-200' : 'bg-white/10')} />
              <div className={cn('text-[9.5px] font-bold uppercase tracking-wider', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>You pay supplier</div>
              <CLine label={`Room rent − ${costing.commissionPct}% commission`} value={fmtINR(costing.payableRoomRent)} muted />
              <CLine label="Before tax" value={fmtINR(costing.payableBeforeTax)} muted />
              <CLine label="GST @ 18%" value={fmtINR(costing.payableGst)} muted />
              <CLine label="Net cost" value={fmtINR(costing.netCost)} bold />
              <div className={cn('h-px my-1.5', theme === 'light' ? 'bg-slate-200' : 'bg-white/10')} />
              <div className={cn('text-[9.5px] font-bold uppercase tracking-wider', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Client pays</div>
              <CLine label={costing.discountPct ? `Room rent − ${costing.discountPct}% discount` : 'Room rent (no discount)'} value={fmtINR(costing.clientRoomRent)} muted />
              <CLine label="Before tax" value={fmtINR(costing.clientBeforeTax)} muted />
              <CLine label="GST @ 18%" value={fmtINR(costing.clientGst)} muted />
              <div className={cn('flex justify-between items-center mt-2 p-3 rounded-xl', theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/10')}>
                <span className="text-[12px] font-bold uppercase tracking-wide">Final Payable Amount</span>
                <span className="text-lg font-bold font-mono">{fmtINR(costing.sellingPrice)}</span>
              </div>
              <div className="flex justify-between items-baseline mt-2 px-1">
                <span className={cn('text-[12px] font-bold', costing.isLoss ? 'text-rose-600' : 'text-emerald-600')}>{costing.isLoss ? 'LOSS' : 'Your profit'}</span>
                <span className={cn('font-mono text-[14px] font-bold', costing.isLoss ? 'text-rose-600' : 'text-emerald-600')}>{fmtINR(costing.profit)}</span>
              </div>
              <div className={cn('text-[10px] text-right px-1', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Net GST payable to govt: {fmtINR(costing.netGstPayable)}</div>
              {costing.isLoss && (
                <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] leading-relaxed">
                  Discount ({costing.discountPct}%) exceeds your {costing.commissionPct}% commission — selling below cost.
                </div>
              )}

              <button onClick={handleSave}
                className="w-full py-2.5 mt-2 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-500 active:scale-[0.97] transition">
                Save to Costing Sheet
              </button>

              {source === 'rann-utsav' && rannProduct === 'tentcity' && (
                  <RannPdfOptions tent={tent} multiple={multiplePdf} extraCategories={extraPdfCategories}
                    onMultipleChange={value => { setMultiplePdf(value); if (!value) setExtraPdfCategories([]); }}
                    onExtraCategoriesChange={setExtraPdfCategories} />
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => downloadPdf()} disabled={pdfBusy}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-60">
                  {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download PDF
                </button>
                <button onClick={copyText}
                  className={cn('flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold border active:scale-[0.97] transition',
                    theme === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white/80')}>
                  <Copy size={13} /> Copy
                </button>
              </div>
              <button onClick={openWhatsApp}
                className="w-full py-2 rounded-lg bg-[#25D366] text-white text-[12px] font-bold hover:opacity-90 active:scale-[0.97] transition">
                Share Client Quote on WhatsApp
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CLine: React.FC<{ label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }> = ({ label, value, bold, muted, accent }) => {
  const { getTextColor, getSecondaryTextColor } = useTheme();
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={cn('text-[11.5px]', accent ? 'text-emerald-600 font-semibold' : muted ? getSecondaryTextColor() : bold ? cn('font-bold', getTextColor()) : getTextColor())}>{label}</span>
      <span className={cn('font-mono text-[12px]', accent ? 'text-emerald-600 font-semibold' : bold ? cn('font-bold', getTextColor()) : muted ? getSecondaryTextColor() : getTextColor())}>{value}</span>
    </div>
  );
};
