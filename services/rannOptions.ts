// ============================================================
// Rann Utsav – Tent City comparison engine.
//
// An agent fielding a WhatsApp enquiry ("what are your rates for 23 Dec?")
// needs several accommodation categories across 1/2/3 nights in one reply.
// This module ONLY iterates: every cell is a real `quoteTentCity` call with the
// same shared inputs. No pricing arithmetic is reimplemented here — surcharge
// tiers, suite-per-unit pricing, single occupancy, mattresses, commission,
// discount and GST all stay in the one engine that owns them.
// ============================================================

import {
  quoteTentCity,
  tcTier,
  TC_TIER_LABEL,
  TC_SEASON,
  type TCTentType,
} from './rannUtsavRates';
import { GST_RATE } from './leadCostingEngine';

export type OptionDuration = 1 | 2 | 3;

export interface RannOptionsInput {
  checkIn: Date;
  categories: TCTentType[];
  durations: OptionDuration[];
  rooms: number;
  single: boolean;
  extraMattress: number;
  commissionPct: number;
  discountPct: number;
}

export interface OptionCell {
  category: TCTentType;
  nights: OptionDuration;
  sellingPrice: number; // what the client pays, GST included
  // What sellingPrice would be at 0% discount, same surcharge/extras/GST —
  // a client-facing figure (just the undiscounted price), not a margin one,
  // so unlike netCost/profit it's safe to carry through to the message.
  originalSellingPrice: number;
  netCost: number;
  profit: number;
}

export interface RannOptionsResult {
  tierLabel: string;
  cells: OptionCell[];
  outOfSeason: boolean;
}

// Local date arithmetic only — UTC-based date formatting is banned in this
// repo because it shifts an IST date back a day.
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** TC_SEASON bounds are treated as INCLUSIVE at both ends, matching the
 *  `checkIn < start || checkIn > end` test the builder pages already use. */
export function isInTcSeason(checkIn: Date): boolean {
  if (isNaN(checkIn.getTime())) return false;
  const d = dayStart(checkIn);
  return d >= dayStart(TC_SEASON.start) && d <= dayStart(TC_SEASON.end);
}

const uniq = <T,>(xs: T[]): T[] => {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
};

export function buildRannOptions(input: RannOptionsInput): RannOptionsResult {
  // Defensive de-dupe: a repeated category or duration would otherwise emit the
  // same row twice into a client-facing comparison.
  const categories = uniq(input.categories);
  const durations = uniq(input.durations);

  const cells: OptionCell[] = [];
  for (const category of categories) {
    for (const nights of durations) {
      const q = quoteTentCity({
        tent: category,
        checkIn: input.checkIn,
        nights,
        rooms: input.rooms,
        single: input.single,
        extraMattress: input.extraMattress,
        commissionPct: input.commissionPct,
        discountPct: input.discountPct,
      });
      cells.push({
        category,
        nights,
        sellingPrice: q.sellingPrice,
        // Discount only ever reduces roomRent (extras/mattress are never
        // discounted), and GST is charged on top of that reduction too —
        // so adding the discount back pre-GST reproduces the 0%-discount price.
        originalSellingPrice: q.sellingPrice + q.clientDiscountAmount * (1 + GST_RATE),
        netCost: q.netCost,
        profit: q.profit,
      });
    }
  }

  return {
    tierLabel: TC_TIER_LABEL[tcTier(input.checkIn)],
    // Cells are still returned out of season so the caller can show a number
    // beside the warning rather than an empty table.
    cells,
    outOfSeason: !isInTcSeason(input.checkIn),
  };
}
