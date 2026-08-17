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

/** The itinerary block, resolved once for BOTH the WhatsApp message and the
 *  compare PDF. Channel-neutral: no `*bold*` / `_italic_` markup is applied to
 *  the heading or the concludes line, so each renderer adds its own. `dayLines`
 *  come from the brochure module as-is (they carry `*Day n*`); the PDF strips
 *  asterisks when drawing.
 *
 *  Both outputs consume this so they cannot drift apart — that drift is exactly
 *  the defect this replaced, where the PDF still repeated Day 1 three times
 *  after the message had stopped. */
export interface CompareItinerarySection {
  /** Ticked durations covered, ascending. */
  durations: OptionDuration[];
  /** The one duration actually written out in full — the longest. */
  writtenOut: OptionDuration;
  /** Plain heading, WITHOUT channel markup. */
  heading: string;
  /** One line per day of `writtenOut`. */
  dayLines: string[];
  /** Plain sentence naming where each shorter stay ends. Absent when only one
   *  duration is ticked, because nothing is being stood in for. */
  concludesLine?: string;
}

/**
 * Printing one itinerary per ticked duration repeats Day 1 verbatim in every
 * block and Day 2 in all but the shortest — neither condensed nor professional.
 * The packages share a prefix: an n-night stay runs the longest itinerary's
 * Days 1..n unchanged and then checks out on Day n+1. So the longest itinerary
 * plus one line of end-points says the same thing once.
 *
 * That shared-prefix property is the load-bearing assumption and is pinned in
 * `verify-rann-options.ts`. If a brochure edit ever breaks it, the test fails
 * rather than these outputs quietly misdescribing a shorter package.
 *
 * Returns null when nothing is ticked.
 */
export function compareItinerarySection(
  durations: OptionDuration[],
): CompareItinerarySection | null {
  // Normalised here rather than trusting the caller: ascending, de-duplicated.
  const durs = ([1, 2, 3] as OptionDuration[]).filter(n => durations.includes(n));
  if (durs.length === 0) return null;

  const writtenOut = durs[durs.length - 1];
  const dayLines = condensedItinerary(writtenOut);

  // One duration: nothing is being represented by proxy, so keep the numbered
  // heading and say nothing about where other stays end.
  if (durs.length === 1) {
    return { durations: durs, writtenOut, heading: `${writtenOut}-Night itinerary`, dayLines };
  }

  return {
    durations: durs,
    writtenOut,
    // Unnumbered: this block now serves every ticked duration, so labelling it
    // "3-Night itinerary" would misfile the shorter stays under it.
    heading: 'Itinerary',
    dayLines,
    concludesLine: durs.slice(0, -1)
      .map(n => `${n}-Night stay concludes after Day ${n + 1}`)
      .join('; ') + '.',
  };
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
    const sec = compareItinerarySection(compareDurations(i.rates));
    if (sec) {
      L.push('');
      L.push(`*${sec.heading}*`);          // WhatsApp bold
      sec.dayLines.forEach(line => L.push(line));
      if (sec.concludesLine) {
        L.push('');
        L.push(`_${sec.concludesLine}_`);  // WhatsApp italic
      }
    }
  }

  L.push('');
  L.push('All rates include GST. Children under 6 years complimentary.');
  L.push('The Tourism Experts');
  return L.join('\n');
}
