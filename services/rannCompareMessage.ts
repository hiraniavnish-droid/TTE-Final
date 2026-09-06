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

import { TC_TENT_TYPES, TC_SUITE, isSuite, fmtINR, TC_BASE, tcTier, type TCTentType } from './rannUtsavRates';
import type { OptionDuration } from './rannOptions';
import { condensedItinerary, addLocalDays } from './rannItinerary';
import { GST_RATE } from './leadCostingEngine';

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

/** One line per day, split into a heading (with its real calendar date) plus
 *  one bullet per activity — `condensedItinerary` hands back a single dense
 *  line per day, which reads as a cramped wall of text on WhatsApp. Nothing
 *  is added or reworded here, only re-laid-out: the day number and activity
 *  list are parsed back out of that same line. */
function formatItineraryDays(dayLines: string[], checkIn: Date): string[] {
  const out: string[] = [];
  dayLines.forEach((line, idx) => {
    const m = line.match(/^\*Day (\d+)\* — (.*)$/);
    if (!m) { out.push(line); return; }
    const dayNum = Number(m[1]);
    const date = addLocalDays(checkIn, dayNum - 1);
    const qualifier = idx === 0 ? ' (Check-in)' : idx === dayLines.length - 1 ? ' (Check-out)' : '';
    out.push(`*Day ${dayNum} — ${fmtCompareDate(date)}${qualifier}*`);
    m[2].split(' · ').forEach(activity => out.push(`• ${activity}`));
    if (idx < dayLines.length - 1) out.push('');
  });
  return out;
}

/** The WhatsApp / clipboard text. Returns '' when nothing is ticked. */
export function buildCompareMessage(i: CompareMessageInput): string {
  const groups = groupCompareRates(i.rates);
  if (groups.length === 0) return '';

  // Surcharge tier depends only on the check-in date, so it's the same for
  // every ticked duration — but suites never carry a surcharge (they're
  // priced flat off TC_SUITE, TC_SURCHARGE never enters that calculation).
  const surchargeActive = tcTier(i.checkIn) !== 'none';
  const durations = compareDurations(i.rates);
  const baseAdults = i.rooms * (i.single ? 1 : 2);
  const totalPax = baseAdults + i.extraMattress;

  const L: string[] = [];
  L.push('*Rann Utsav Tent City 2026-27 — Options*');
  L.push('');
  L.push(`📅 Check-in: ${fmtCompareDate(i.checkIn)}`);
  L.push(`Quotation for: ${durations.map(n => `${n}N/${n + 1}D`).join(' & ')}`);
  L.push(occupancyLine(i.rooms, i.single));
  L.push(i.extraMattress > 0
    ? `Pax: ${totalPax} Adults (incl. ${i.extraMattress} extra mattress)`
    : `Pax: ${totalPax} Adult${totalPax === 1 ? '' : 's'}`);
  L.push('──────────────');

  let anySurchargedNonSuite = false;
  for (const g of groups) {
    L.push('');
    const suite = isSuite(g.category);
    const showTick = surchargeActive && !suite;
    if (showTick) anySurchargedNonSuite = true;
    // The "+X% GST" note only holds as a complete formula when nothing else
    // is added on top of the base rate. Once a festive surcharge applies,
    // stating just "+ GST" would let a client compute base×pax×nights×1.18
    // and land short of the real total — so the note names the surcharge
    // too rather than implying a formula that no longer holds.
    const rateNote = suite ? ''
      : showTick
        ? ` — ${fmtINR(TC_BASE[g.category][1])}/person/night + festive surcharge + ${GST_RATE * 100}% GST`
        : ` — ${fmtINR(TC_BASE[g.category][1])}/person/night + ${GST_RATE * 100}% GST`;
    L.push(`*${g.category}*${suiteQualifier(g.category)}${rateNote}`);
    L.push(g.rates.map(r => `${r.nights}N: ${fmtINR(r.sellingPrice)}${showTick ? ' ✓' : ''}`).join('   '));
  }

  if (anySurchargedNonSuite) {
    L.push('');
    L.push('✓ Festive-date rate applies for these dates');
  }
  L.push('──────────────');

  if (i.includeItinerary) {
    const sec = compareItinerarySection(durations);
    if (sec) {
      L.push('');
      L.push(`*${sec.heading}*`);          // WhatsApp bold
      L.push('');
      formatItineraryDays(sec.dayLines, i.checkIn).forEach(line => L.push(line));
      if (sec.concludesLine) {
        L.push('');
        L.push(`_${sec.concludesLine}_`);  // WhatsApp italic
      }
      L.push('──────────────');
    }
  }

  L.push('');
  L.push('✓ All rates include GST. Children under 6 years complimentary.');
  L.push('');
  L.push('We look forward to hosting you at Rann Utsav this season.');
  return L.join('\n');
}
