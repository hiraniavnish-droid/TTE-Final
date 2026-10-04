// ============================================================
// Statue of Unity — Tent City-1 rate engine
// Source: "SOU Rates till 30th Sep.pdf" (1 Jul – 30 Sep 2026) and
//         "SOU Rate Card Oct to Mar 2026-27.pdf" (1 Oct 2026 – 31 Mar 2027)
//
// Cottages (Premium/Royal): pro-rata per-night pricing, per person, double
// occupancy basis — Sun-Thu (weekday) vs Fri-Sat (weekend) rate per night,
// summed across the stay (verified: brochure's 1N/2N/3N MAP & Experiential
// figures are exact multiples of the 1-night rate). Three meal plans: CP
// (breakfast only), MAP (breakfast + 1 major meal), Experiential (all meals,
// sightseeing, pickup/drop).
// Villas (Royal/Presidential): flat per-night rate, Experiential plan only,
// no weekday/weekend split, both seasons identical.
// Peak-season surcharge (Season B only): flat ₹ per cottage per night for
// Diwali / Christmas & New Year / Uttarayan / Holi windows.
// The brochure rate is the RACK RATE, not a cost. TTE earns a travel-agent
// commission (18%/22%, see leadCostingEngine) off room rent and therefore pays
// the supplier rack − commission; the client pays rack − whatever smaller
// discount is passed on. Profit is the gap between those two discounts, never a
// markup. Extras are identical on both sides. 18% GST applied to each side
// separately. Single occupancy = 75% of double; children under 6 free.
// ============================================================

import { computeCosting, GST_RATE, type CostingBreakdown } from './leadCostingEngine';

export type Plan = 'CP' | 'MAP' | 'Experiential';
export type CottageType = 'Premium Cottage' | 'Royal Cottage';
export type VillaType = 'Royal Villa' | 'Presidential Villa';

export { GST_RATE };
export const PLANS: Plan[] = ['CP', 'MAP', 'Experiential'];
export const PLAN_LABEL: Record<Plan, string> = {
  CP: 'Continental Plan (Breakfast)',
  MAP: 'MAP (Breakfast + 1 Meal)',
  Experiential: 'Experiential (All Meals + Sightseeing)',
};
export const COTTAGE_TYPES: CottageType[] = ['Premium Cottage', 'Royal Cottage'];
export const VILLA_TYPES: VillaType[] = ['Royal Villa', 'Presidential Villa'];
export const VILLA_PAX: Record<VillaType, number> = { 'Royal Villa': 2, 'Presidential Villa': 4 };
export const VILLA_RATE_PER_NIGHT: Record<VillaType, number> = { 'Royal Villa': 36000, 'Presidential Villa': 60000 };
export const VILLA_EXTRA_MATTRESS = 12000; // per night, flat, both seasons, Experiential only

interface DayRate { weekday: number; weekend: number; } // per person, per night

interface SeasonRates {
  cottage: Record<Plan, Record<CottageType, DayRate>>;
  extraMattress: Record<Plan, number>; // per night, flat regardless of weekday/weekend
}

// 1 Jul – 30 Sep 2026
const SEASON_A: SeasonRates = {
  cottage: {
    CP: {
      'Premium Cottage': { weekday: 3500, weekend: 4000 },
      'Royal Cottage': { weekday: 4000, weekend: 4500 },
    },
    MAP: {
      'Premium Cottage': { weekday: 4500, weekend: 5000 },
      'Royal Cottage': { weekday: 5000, weekend: 5500 },
    },
    Experiential: {
      'Premium Cottage': { weekday: 6500, weekend: 7000 },
      'Royal Cottage': { weekday: 7000, weekend: 7500 },
    },
  },
  extraMattress: { CP: 2000, MAP: 3000, Experiential: 5000 },
};

// 1 Oct 2026 – 31 Mar 2027
const SEASON_B: SeasonRates = {
  cottage: {
    CP: {
      'Premium Cottage': { weekday: 4000, weekend: 4500 },
      'Royal Cottage': { weekday: 4500, weekend: 5000 },
    },
    MAP: {
      'Premium Cottage': { weekday: 5250, weekend: 5750 },
      'Royal Cottage': { weekday: 5750, weekend: 6250 },
    },
    Experiential: {
      'Premium Cottage': { weekday: 7250, weekend: 7750 },
      'Royal Cottage': { weekday: 7750, weekend: 8250 },
    },
  },
  extraMattress: { CP: 2500, MAP: 3500, Experiential: 5500 },
};

const SEASON_A_RANGE = { start: new Date(2026, 6, 1), end: new Date(2026, 8, 30) };
const SEASON_B_RANGE = { start: new Date(2026, 9, 1), end: new Date(2027, 2, 31) };
export const FULL_SEASON = { start: SEASON_A_RANGE.start, end: SEASON_B_RANGE.end };

function seasonFor(date: Date): SeasonRates | null {
  const t = date.getTime();
  if (t >= SEASON_A_RANGE.start.getTime() && t <= SEASON_A_RANGE.end.getTime()) return SEASON_A;
  if (t >= SEASON_B_RANGE.start.getTime() && t <= SEASON_B_RANGE.end.getTime()) return SEASON_B;
  return null;
}

// Peak-season surcharge windows — Season B only, flat per cottage per night
interface PeakWindow { label: string; start: Date; end: Date; surcharge: Record<Plan, number>; }
const PEAK_WINDOWS: PeakWindow[] = [
  { label: 'Diwali', start: new Date(2026, 10, 8), end: new Date(2026, 10, 14), surcharge: { CP: 2000, MAP: 2500, Experiential: 3000 } },
  { label: 'Christmas & New Year', start: new Date(2026, 11, 18), end: new Date(2027, 0, 2), surcharge: { CP: 2000, MAP: 2500, Experiential: 3000 } },
  { label: 'Uttarayan', start: new Date(2027, 0, 14), end: new Date(2027, 0, 16), surcharge: { CP: 2000, MAP: 2500, Experiential: 3000 } },
  { label: 'Holi', start: new Date(2027, 2, 20), end: new Date(2027, 2, 22), surcharge: { CP: 2000, MAP: 2500, Experiential: 3000 } },
];

function peakWindowFor(date: Date): PeakWindow | null {
  const t = date.getTime();
  return PEAK_WINDOWS.find(w => t >= w.start.getTime() && t <= w.end.getTime()) || null;
}

const isWeekendDay = (date: Date) => { const d = date.getDay(); return d === 5 || d === 6; }; // Fri/Sat
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ─── Shared quote result ──────────────────────────────────────
export interface QuoteLine { label: string; amount: number; note?: string; }
export interface NightBreakdown { date: Date; perPerson: number; peak: string | null; peakAmount: number; }
export interface QuoteResult extends CostingBreakdown {
  perNight?: NightBreakdown[];
}

// ─── Cottage quote (Premium / Royal, any plan) ───────────────
export interface CottageInput {
  plan: Plan; roomType: CottageType; checkIn: Date; nights: number; rooms: number;
  single: boolean; extraMattress: number; commissionPct: number; discountPct: number;
}
export function quoteCottage(i: CottageInput): QuoteResult | null {
  const perNight: NightBreakdown[] = [];
  let oneCottage = 0;
  for (let n = 0; n < i.nights; n++) {
    const date = addDays(i.checkIn, n);
    const season = seasonFor(date);
    if (!season) return null;
    const rate = season.cottage[i.plan][i.roomType];
    const perPerson = isWeekendDay(date) ? rate.weekend : rate.weekday;
    const peakWindow = peakWindowFor(date);
    const peakAmount = peakWindow ? peakWindow.surcharge[i.plan] : 0;
    perNight.push({ date, perPerson, peak: peakWindow?.label || null, peakAmount });
    oneCottage += perPerson * 2 + peakAmount;
  }
  let roomRent = oneCottage * i.rooms;
  if (i.single) roomRent *= 0.75;

  const extras: QuoteLine[] = [];
  // extra mattress rate uses the season of check-in (mattress rate doesn't vary night-to-night in the brochure)
  const season0 = seasonFor(i.checkIn);
  const mRate = season0 ? season0.extraMattress[i.plan] : 0;
  const mAmt = i.extraMattress * mRate * i.nights;
  if (mAmt) extras.push({ label: `Extra mattress × ${i.extraMattress} × ${i.nights} night(s)`, amount: mAmt, note: `₹${mRate.toLocaleString('en-IN')}/night` });

  const costing = computeCosting(roomRent, extras, i.commissionPct, i.discountPct);
  return { ...costing, perNight };
}

// ─── Villa quote (Royal / Presidential — Experiential only, flat) ───
export interface VillaInput {
  villa: VillaType; checkIn: Date; nights: number; rooms: number;
  extraMattress: number; commissionPct: number; discountPct: number;
}
export function quoteVilla(i: VillaInput): QuoteResult | null {
  // Villas are flat-rate both seasons, but still gate on being within the published window.
  if (!seasonFor(i.checkIn)) return null;
  const nightly = VILLA_RATE_PER_NIGHT[i.villa];
  const roomRent = nightly * i.nights * i.rooms;

  const extras: QuoteLine[] = [];
  const mAmt = i.extraMattress * VILLA_EXTRA_MATTRESS * i.nights;
  if (mAmt) extras.push({ label: `Extra mattress × ${i.extraMattress} × ${i.nights} night(s)`, amount: mAmt, note: `₹${VILLA_EXTRA_MATTRESS.toLocaleString('en-IN')}/night` });

  const costing = computeCosting(roomRent, extras, i.commissionPct, i.discountPct);
  return { ...costing, perNight: undefined };
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/** Additive API catalog, sourced from the same constants as the quotation engine. */
export function souTentCityRateCard() {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { currency:'INR', gst_rate:GST_RATE, plans:PLAN_LABEL,
    seasons:[{from:iso(SEASON_A_RANGE.start),to:iso(SEASON_A_RANGE.end),...SEASON_A},{from:iso(SEASON_B_RANGE.start),to:iso(SEASON_B_RANGE.end),...SEASON_B}],
    cottage_rate_basis:'per person per night, double sharing; Friday/Saturday weekend',
    single_occupancy_factor:0.75, children_under_6:'free',
    peak_windows:PEAK_WINDOWS.map(w=>({label:w.label,from:iso(w.start),to:iso(w.end),surcharge:w.surcharge,basis:'per cottage per night'})),
    villas:{nightly_rates:VILLA_RATE_PER_NIGHT,included_pax:VILLA_PAX,extra_mattress_per_night:VILLA_EXTRA_MATTRESS,plan:'Experiential'},
    extra_mattress_basis:'per mattress per night; check-in season; not discountable',
    availability:'not_checked' };
}
