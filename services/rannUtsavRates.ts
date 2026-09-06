// ============================================================
// Rann Utsav 2026-27 rate engine (verified against brochure tariffs)
//   - Rann Tent Resort: pro-rata per-night tier pricing (per couple)
//   - Rann Utsav Tent City: per-person base + check-in-date surcharge; flat suites
// The brochure rate is the RACK RATE, not a cost. TTE earns a travel-agent
// commission (18%/22%, see leadCostingEngine) off room rent and therefore pays
// the supplier rack − commission; the client pays rack − whatever smaller
// discount is passed on. Profit is the gap between those two discounts, never a
// markup. Extras are identical on both sides. 18% GST applied to each side
// separately. Single occupancy = 75% of double; children under 6 free.
// ============================================================

import { computeCosting, GST_RATE, type CostingBreakdown } from './leadCostingEngine';

export type ResortTier = 'Premium' | 'Regular' | 'Economy';
export type TCTier = 'none' | 's1' | 's2';
export { GST_RATE };

const rng = (a: number, b: number) => { const r: number[] = []; for (let i = a; i <= b; i++) r.push(i); return r; };

// ─── Rann Tent Resort ───────────────────────────────────────
export const RESORT_NIGHTLY: Record<ResortTier, number> = { Premium: 18000, Regular: 14000, Economy: 11000 };
export const RESORT_EXTRA_PAX = 4500; // per extra person per night (not discountable)

// month(1-12) -> days in that tier. Season 10 Nov 2026 – 28 Feb 2027.
const RESORT_ECONOMY: Record<number, number[]> = { 11: [12, 16, 17, 18, 19, 26, 30], 2: [1, 2, 3, 4, 8, 9, 10, 11, 15, 16, 17, 18, 22, 23, 24, 25] };
const RESORT_PREMIUM: Record<number, number[]> = { 12: rng(19, 31), 1: [1, 2, 14, 15, 21, 22, 23], 2: [19, 20, 21] };

export function resortTier(date: Date): ResortTier {
  const m = date.getMonth() + 1, d = date.getDate();
  if ((RESORT_PREMIUM[m] || []).includes(d)) return 'Premium';
  if ((RESORT_ECONOMY[m] || []).includes(d)) return 'Economy';
  return 'Regular';
}

// ─── Rann Utsav Tent City ───────────────────────────────────
export type TCTentType =
  | 'Super Premium Tent' | 'Premium Tent' | 'Deluxe AC Swiss Cottage' | 'Non-AC Swiss Cottage'
  | 'Darbari Suite' | 'Rajwadi Suite';

export const TC_BASE: Record<string, Record<number, number>> = {
  'Super Premium Tent': { 1: 10300, 2: 20600, 3: 30900 },
  'Premium Tent': { 1: 9300, 2: 18600, 3: 27900 },
  'Deluxe AC Swiss Cottage': { 1: 8300, 2: 16600, 3: 24900 },
  'Non-AC Swiss Cottage': { 1: 6300, 2: 12600, 3: 18900 },
};
export const TC_SUITE: Record<string, { rates: Record<number, number>; pax: number }> = {
  'Darbari Suite': { rates: { 1: 70000, 2: 140000, 3: 210000 }, pax: 4 },
  'Rajwadi Suite': { rates: { 1: 35000, 2: 70000, 3: 105000 }, pax: 2 },
};
export const TC_SURCHARGE: Record<TCTier, Record<number, number>> = {
  none: { 1: 0, 2: 0, 3: 0 }, s1: { 1: 2000, 2: 3500, 3: 4500 }, s2: { 1: 4000, 2: 6000, 3: 8000 },
};
// extra mattress per night by (tier, isNonAC)
export const TC_MATTRESS: Record<TCTier, { ac: number; nonac: number }> = {
  none: { ac: 5500, nonac: 4500 }, s1: { ac: 6000, nonac: 5000 }, s2: { ac: 6000, nonac: 5000 },
};
export const SUITE_MATTRESS = 7750;

export const TC_TENT_TYPES: TCTentType[] = [
  'Super Premium Tent', 'Premium Tent', 'Deluxe AC Swiss Cottage', 'Non-AC Swiss Cottage', 'Rajwadi Suite', 'Darbari Suite',
];
export const isSuite = (tent: string) => !!TC_SUITE[tent];

// check-in date -> surcharge tier
export function tcTier(date: Date): TCTier {
  const m = date.getMonth() + 1, d = date.getDate();
  if (m === 12 && d >= 18) return 's2';                 // Christmas week (Dec side)
  if (m === 1 && d <= 2) return 's2';                   // Christmas week (Jan side)
  if (m === 1 && d >= 20 && d <= 23) return 's2';       // Jan full moon
  if (m === 11 && ((d >= 8 && d <= 14) || (d >= 22 && d <= 25))) return 's1'; // Diwali + Nov full moon
  if (m === 2 && d >= 18 && d <= 21) return 's1';        // Feb full moon
  if (m === 12 && d <= 17) return 's1';                  // Dec normal
  if (m === 1) return 's1';                              // Jan normal (3–19, 24–31)
  return 'none';                                         // Nov normal, Feb normal, March
}

export const TC_TIER_LABEL: Record<TCTier, string> = { none: 'Season Rate', s1: 'Peak (Diwali/Full-Moon)', s2: 'Christmas/New-Year Peak' };

// ─── Shared types ───────────────────────────────────────────
export interface QuoteLine { label: string; amount: number; note?: string; }
export interface QuoteResult extends CostingBreakdown {
  perNight?: { date: Date; tier: ResortTier; rate: number }[];
  tcTierUsed?: TCTier;
}

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ─── Resort quote ───────────────────────────────────────────
export interface ResortInput {
  checkIn: Date; nights: number; rooms: number;
  single: boolean; extraPax: number; commissionPct: number; discountPct: number;
}
export function quoteResort(i: ResortInput): QuoteResult {
  const perNight: { date: Date; tier: ResortTier; rate: number }[] = [];
  let oneRoom = 0;
  for (let n = 0; n < i.nights; n++) {
    const date = addDays(i.checkIn, n);
    const tier = resortTier(date);
    const rate = RESORT_NIGHTLY[tier];
    perNight.push({ date, tier, rate });
    oneRoom += rate;
  }
  let roomRent = oneRoom * i.rooms;
  if (i.single) roomRent *= 0.75;
  const extras: QuoteLine[] = [];
  const extraPaxAmt = i.extraPax * RESORT_EXTRA_PAX * i.nights;
  if (extraPaxAmt) extras.push({ label: `Extra person × ${i.extraPax} × ${i.nights} night(s)`, amount: extraPaxAmt, note: '₹4,500/person/night' });
  const costing = computeCosting(roomRent, extras, i.commissionPct, i.discountPct);
  return { ...costing, perNight };
}

// ─── Tent City quote ────────────────────────────────────────
export interface TCInput {
  tent: TCTentType; checkIn: Date; nights: number; rooms: number;
  single: boolean; extraMattress: number; commissionPct: number; discountPct: number;
}
export function quoteTentCity(i: TCInput): QuoteResult {
  const tier = tcTier(i.checkIn);
  const suite = isSuite(i.tent);
  let roomRent: number;
  if (suite) {
    roomRent = TC_SUITE[i.tent].rates[i.nights] * i.rooms;
  } else {
    const perPerson = TC_BASE[i.tent][i.nights] + TC_SURCHARGE[tier][i.nights];
    roomRent = perPerson * 2 * i.rooms;
    if (i.single) roomRent *= 0.75;
  }
  const extras: QuoteLine[] = [];
  const nonac = i.tent.includes('Non-AC');
  const mRate = suite ? SUITE_MATTRESS : TC_MATTRESS[tier][nonac ? 'nonac' : 'ac'];
  const mAmt = i.extraMattress * mRate * i.nights;
  if (mAmt) extras.push({ label: `Extra mattress × ${i.extraMattress} × ${i.nights} night(s)`, amount: mAmt, note: `₹${mRate.toLocaleString('en-IN')}/night` });
  const costing = computeCosting(roomRent, extras, i.commissionPct, i.discountPct);
  return { ...costing, perNight: undefined, tcTierUsed: tier };
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const RESORT_SEASON = { start: new Date(2026, 10, 10), end: new Date(2027, 1, 28) };
export const TC_SEASON = { start: new Date(2026, 10, 1), end: new Date(2027, 2, 7) };
