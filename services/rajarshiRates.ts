// ============================================================
// Rate resolver for Rajarshi Travels (Bhuj/Kutch B2B hotel rates).
//
// Unlike Rann Utsav / SOU, these are NET rates TTE pays the supplier — not a
// rack rate with a commission. So the model here is markup, not commission:
// TTE adds a margin (percent or flat ₹ per room-night, agent's choice) on
// top of the net rate to reach the client price. Rates are GST-inclusive per
// the sheet's global T&C unless a hotel explicitly states otherwise
// (encoded per-hotel via `gstExtra` — see rajarshiData.ts notes).
//
// A stay is priced night-by-night: for each night, pick whichever tier's
// window contains that date (peak/festive tiers override 'base'), apply that
// tier's rate (mode 'replace') or base rate + surcharge (mode 'surcharge').
// ============================================================

import { RAJARSHI_HOTELS, type RajHotel, type RajRoom, type RajPlan } from './rajarshiData';

export type MarkupMode = 'percent' | 'flat';

export interface NightRate {
  date: string;           // ISO
  tierId: string;         // 'base' or the matched tier id
  tierLabel?: string;
  rate: number;            // net rate charged by supplier for this night
  isOnRequest: boolean;    // true when no rate exists for this plan/tier — must not be silently priced at 0
}

export interface StayQuoteInput {
  hotel: RajHotel;
  room: RajRoom;
  plan: RajPlan;
  checkIn: string;         // ISO date
  nights: number;
  rooms: number;
  extraPersons: number;
  markupMode: MarkupMode;
  markupValue: number;     // percent (e.g. 15) or flat ₹ per room-night (e.g. 500)
}

export interface StayQuoteResult {
  perNight: NightRate[];
  anyOnRequest: boolean;
  netRoomTotal: number;    // sum of resolved night rates × rooms (excludes on-request nights)
  markupAmount: number;
  extraPersonTotal: number;
  netCost: number;         // what TTE pays: netRoomTotal + extraPersonTotal (GST-inclusive per sheet)
  sellingPrice: number;    // netCost + markupAmount — what the client pays (extras carry no markup)
  profit: number;          // markupAmount, restated for clarity
}

// NEVER route this through toISOString() — that forces UTC, and in any
// timezone ahead of UTC (IST included, the actual market this runs in) it
// silently shifts the date back by one day, miscategorizing peak-window
// boundary nights as base rate. Caught by an exhaustive permutation test:
// every 'replace'-tier hotel resolved its FIRST peak night as base because
// the shifted date landed one day before the window started. Pure local
// numeric arithmetic below has no timezone to round-trip through.
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

function tierForDate(hotel: RajHotel, date: string) {
  for (const tier of hotel.tiers) {
    for (const w of tier.windows) {
      if (date >= w.from && date <= w.to) return tier;
    }
  }
  return null;
}

export function resolveNightRate(hotel: RajHotel, room: RajRoom, plan: RajPlan, date: string): NightRate {
  const tier = tierForDate(hotel, date);

  if (!tier) {
    const base = room.rates.base?.[plan];
    return { date, tierId: 'base', rate: base ?? 0, isOnRequest: base == null };
  }

  if (tier.mode === 'surcharge') {
    const base = room.rates.base?.[plan];
    if (base == null) return { date, tierId: tier.id, tierLabel: tier.label, rate: 0, isOnRequest: true };
    return { date, tierId: tier.id, tierLabel: tier.label, rate: base + (tier.surcharge || 0), isOnRequest: false };
  }

  // mode 'replace' — the tier prints its own full rate table per room.
  const tierRate = room.rates[tier.id]?.[plan];
  if (tierRate != null) return { date, tierId: tier.id, tierLabel: tier.label, rate: tierRate, isOnRequest: false };

  // The sheet prints NO rate for this room+plan on this tier's dates. This used
  // to fall back to the base rate, which quotes an ordinary-night price on a
  // blackout night — Time Square (the only 5-star in Kutch) would quote its
  // ₹7,350 base for Diwali and Christmas on CPAI, and White Desert its base
  // EPAI across every blackout window. 7 of 63 replace-tier combinations did
  // this. We do not know what the supplier charges, so we say so rather than
  // guess low on the highest-demand nights of the year.
  return { date, tierId: tier.id, tierLabel: tier.label, rate: 0, isOnRequest: true };
}

export function quoteStay(i: StayQuoteInput): StayQuoteResult {
  const perNight: NightRate[] = [];
  let netRoomTotal = 0;
  let anyOnRequest = false;

  for (let n = 0; n < i.nights; n++) {
    const date = addDays(i.checkIn, n);
    const nr = resolveNightRate(i.hotel, i.room, i.plan, date);
    perNight.push(nr);
    if (nr.isOnRequest) anyOnRequest = true;
    else netRoomTotal += nr.rate * i.rooms;
  }

  const extraRate = i.hotel.extraPerson?.base?.[i.plan] ?? 0;
  const extraPersonTotal = i.extraPersons * extraRate * i.nights;

  const netCost = netRoomTotal + extraPersonTotal;
  const markupAmount = i.markupMode === 'percent'
    ? Math.round(netRoomTotal * i.markupValue / 100)
    : Math.round(i.markupValue * i.nights * i.rooms);
  const sellingPrice = netCost + markupAmount;

  return { perNight, anyOnRequest, netRoomTotal, markupAmount, extraPersonTotal, netCost, sellingPrice, profit: markupAmount };
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function hotelsByCity(): Record<string, RajHotel[]> {
  const out: Record<string, RajHotel[]> = {};
  for (const h of RAJARSHI_HOTELS) (out[h.city] ||= []).push(h);
  return out;
}
