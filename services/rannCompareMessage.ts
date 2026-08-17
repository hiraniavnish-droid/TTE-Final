// ============================================================
// Rann Utsav – Tent City comparison message (CLIENT-FACING).
//
// This is the single place the shareable text is assembled, and it is kept
// separate from the page on purpose: its input type carries the client-facing
// selling price and nothing else. `netCost`, `profit`, `commissionPct` and
// `discountPct` are STRUCTURALLY ABSENT from `CompareMessageInput`, so no edit
// in here can leak an internal figure into a customer's chat — there is no
// variable in scope that holds one.
//
// The discount is already baked into `sellingPrice` by the rate engine; the
// percentage itself is an internal negotiating position and is never printed.
// ============================================================

import { TC_TENT_TYPES, TC_SUITE, isSuite, fmtINR, type TCTentType } from './rannUtsavRates';
import type { OptionDuration } from './rannOptions';
import { condensedItinerary } from './rannItinerary';

/** One ticked cell, reduced to the only figure a client may see. */
export interface CompareRate {
  category: TCTentType;
  nights: OptionDuration;
  /** GST-inclusive total payable for the whole booking. */
  sellingPrice: number;
}

export interface CompareMessageInput {
  checkIn: Date;
  rooms: number;
  single: boolean;
  extraMattress: number;
  rates: CompareRate[];
  includeItinerary: boolean;
}

export interface CompareGroup {
  category: TCTentType;
  /** Category name plus, for suites, the per-suite qualifier. */
  heading: string;
  /** Ticked durations for this category, ascending. */
  rates: CompareRate[];
  lowest: number;
}

// Local date formatting only. The UTC-based ISO serialiser is banned in this
// repo (and asserted against in verify-rann-options.ts) because it rolls an IST
// date back to the previous day.
export const fmtCompareDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** On-screen label making it impossible to read a suite total as per-person. */
export function categoryLabel(category: string): string {
  return isSuite(category) ? `${category} (${TC_SUITE[category].pax} pax)` : category;
}

/** Client-facing qualifier: a suite is priced per unit, not per person, so its
 *  figure cannot be compared like-for-like with the header's occupancy line. */
export function suiteQualifier(category: string): string {
  return isSuite(category)
    ? ` (whole suite · up to ${TC_SUITE[category].pax} guests)`
    : '';
}

/** Groups ticked cells by category, durations ascending inside each group,
 *  groups ordered cheapest-first by the LOWEST ticked figure in the group.
 *  Ties fall back to rate-card order so the output is deterministic. */
export function groupCompareRates(rates: CompareRate[]): CompareGroup[] {
  const byCat = new Map<TCTentType, CompareRate[]>();
  for (const r of rates) {
    const list = byCat.get(r.category);
    if (list) list.push(r); else byCat.set(r.category, [r]);
  }

  const groups: CompareGroup[] = [];
  byCat.forEach((rs, category) => {
    const sorted = rs.slice().sort((a, b) => a.nights - b.nights);
    groups.push({
      category,
      heading: category + suiteQualifier(category),
      rates: sorted,
      lowest: sorted.reduce((m, r) => Math.min(m, r.sellingPrice), Infinity),
    });
  });

  groups.sort((a, b) =>
    a.lowest !== b.lowest
      ? a.lowest - b.lowest
      : TC_TENT_TYPES.indexOf(a.category) - TC_TENT_TYPES.indexOf(b.category));
  return groups;
}

/** Distinct ticked durations, ascending — the itineraries to append. */
export function compareDurations(rates: CompareRate[]): OptionDuration[] {
  const seen = new Set<OptionDuration>();
  for (const r of rates) seen.add(r.nights);
  return ([1, 2, 3] as OptionDuration[]).filter(n => seen.has(n));
}

export function occupancyLine(rooms: number, single: boolean): string {
  return `${single ? 'Single' : 'Double'} occupancy · ${rooms} room${rooms === 1 ? '' : 's'}`;
}

/** The WhatsApp / clipboard text. Returns '' when nothing is ticked. */
export function buildCompareMessage(i: CompareMessageInput): string {
  const groups = groupCompareRates(i.rates);
  if (groups.length === 0) return '';

  const L: string[] = [];
  L.push('*THE TOURISM EXPERTS*');
  L.push('*Rann Utsav — Tent City*');
  L.push('');
  L.push(`Check-in: ${fmtCompareDate(i.checkIn)}`);
  L.push(occupancyLine(i.rooms, i.single));
  // Mattresses change every figure below, so the client must see the count.
  if (i.extraMattress > 0) {
    L.push(`Extra mattress: ${i.extraMattress}`);
  }

  for (const g of groups) {
    L.push('');
    L.push(`*${g.category}*${suiteQualifier(g.category)}`);
    L.push(g.rates.map(r => `${r.nights}N ${fmtINR(r.sellingPrice)}`).join('  ·  '));
  }

  if (i.includeItinerary) {
    const durs = compareDurations(i.rates);
    if (durs.length === 1) {
      L.push('');
      L.push(`*${durs[0]}-Night itinerary*`);
      condensedItinerary(durs[0]).forEach(line => L.push(line));
    } else if (durs.length > 1) {
      // Printing one itinerary per duration repeats Day 1 verbatim in every
      // block and Day 2 in all but the shortest, which is neither condensed nor
      // professional. The packages share a prefix — an n-night stay runs the
      // longest itinerary's Days 1..n and then checks out on Day n+1 — so the
      // longest itinerary plus a line of end-points says the same thing once.
      // `verify-rann-options.ts` pins that shared-prefix property; if a future
      // brochure edit breaks it, the test fails rather than this message
      // quietly misdescribing a shorter package.
      const longest = durs[durs.length - 1];
      L.push('');
      L.push('*Itinerary*');
      condensedItinerary(longest).forEach(line => L.push(line));
      L.push('');
      L.push('_' + durs.slice(0, -1)
        .map(n => `${n}-Night stay concludes after Day ${n + 1}`)
        .join('; ') + '._');
    }
  }

  L.push('');
  L.push('All rates include GST. Children under 6 years complimentary.');
  L.push('The Tourism Experts');
  return L.join('\n');
}
