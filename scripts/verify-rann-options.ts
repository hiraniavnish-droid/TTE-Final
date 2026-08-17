// Verification for the Rann Utsav comparison engine and brochure itineraries.
// Run: npx tsx scripts/verify-rann-options.ts
import { readFileSync } from 'fs';
import { buildRannOptions, isInTcSeason, type OptionDuration } from '../services/rannOptions';
import {
  quoteTentCity, tcTier, TC_TENT_TYPES, TC_TIER_LABEL, TC_SEASON, isSuite,
  type TCTentType, type TCTier,
} from '../services/rannUtsavRates';
import {
  RANN_ITINERARIES, RANN_PLACES, condensedItinerary, itineraryWarnings,
} from '../services/rannItinerary';
import { buildCompareMessage, compareItinerarySection } from '../services/rannCompareMessage';

let checks = 0;
const fail: string[] = [];
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) fail.push(msg); };

const DURATIONS: OptionDuration[] = [1, 2, 3];

// Local date construction only — never parse/format through UTC.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

// One check-in per surcharge tier, so every cell comparison runs against a
// tier the engine actually treats differently.
const TIER_DATES: { date: Date; tier: TCTier; label: string }[] = [
  { date: d(2026, 11, 4), tier: 'none', label: '4 Nov 2026 (Nov season rate)' },
  { date: d(2026, 11, 10), tier: 's1', label: '10 Nov 2026 (Diwali band)' },
  { date: d(2026, 12, 15), tier: 's1', label: '15 Dec 2026 (Dec normal)' },
  { date: d(2026, 12, 23), tier: 's2', label: '23 Dec 2026 (Christmas week)' },
  { date: d(2027, 1, 21), tier: 's2', label: '21 Jan 2027 (Jan full moon)' },
];

const SHARED = { rooms: 2, single: false, extraMattress: 1, commissionPct: 22, discountPct: 12 };

// ── sanity: the tier dates really do cover none / s1 / s2 ──
for (const t of TIER_DATES) {
  ok(tcTier(t.date) === t.tier, `${t.label}: expected tier ${t.tier}, engine says ${tcTier(t.date)}`);
}
ok(new Set(TIER_DATES.map(t => t.tier)).size === 3, 'tier dates must cover all three surcharge tiers');

// ── every cell equals a direct quoteTentCity call, exhaustively ──
for (const t of TIER_DATES) {
  const res = buildRannOptions({
    checkIn: t.date, categories: TC_TENT_TYPES, durations: DURATIONS, ...SHARED,
  });

  ok(res.cells.length === TC_TENT_TYPES.length * DURATIONS.length,
    `${t.label}: expected ${TC_TENT_TYPES.length * DURATIONS.length} cells, got ${res.cells.length}`);
  const keys = res.cells.map(c => `${c.category}::${c.nights}`);
  ok(new Set(keys).size === keys.length, `${t.label}: duplicate cells emitted`);
  ok(res.tierLabel === TC_TIER_LABEL[t.tier], `${t.label}: tierLabel '${res.tierLabel}' != '${TC_TIER_LABEL[t.tier]}'`);
  ok(res.outOfSeason === false, `${t.label}: an in-season date was flagged out of season`);

  for (const category of TC_TENT_TYPES) {
    for (const nights of DURATIONS) {
      const cell = res.cells.find(c => c.category === category && c.nights === nights);
      if (!cell) { ok(false, `${t.label}: no cell for ${category} × ${nights}N`); continue; }
      const direct = quoteTentCity({ tent: category, checkIn: t.date, nights, ...SHARED });
      ok(cell.sellingPrice === direct.sellingPrice,
        `${t.label} ${category} ${nights}N: sellingPrice ${cell.sellingPrice} != direct ${direct.sellingPrice}`);
      ok(cell.netCost === direct.netCost,
        `${t.label} ${category} ${nights}N: netCost ${cell.netCost} != direct ${direct.netCost}`);
      ok(cell.profit === direct.profit,
        `${t.label} ${category} ${nights}N: profit ${cell.profit} != direct ${direct.profit}`);
    }
  }

  // ── longer stays cost strictly more ──
  for (const category of TC_TENT_TYPES) {
    const byNights = (n: number) => res.cells.find(c => c.category === category && c.nights === n)!.sellingPrice;
    ok(byNights(2) > byNights(1), `${t.label} ${category}: 2N (${byNights(2)}) must exceed 1N (${byNights(1)})`);
    ok(byNights(3) > byNights(2), `${t.label} ${category}: 3N (${byNights(3)}) must exceed 2N (${byNights(2)})`);
  }
}

// ── a partial selection produces exactly the requested grid ──
{
  const cats: TCTentType[] = ['Premium Tent', 'Non-AC Swiss Cottage'];
  const durs: OptionDuration[] = [1, 3];
  const res = buildRannOptions({ checkIn: d(2026, 12, 23), categories: cats, durations: durs, ...SHARED });
  ok(res.cells.length === cats.length * durs.length, `partial grid: expected 4 cells, got ${res.cells.length}`);
  ok(res.cells.every(c => cats.includes(c.category) && durs.includes(c.nights)), 'partial grid: an unrequested cell appeared');
}

// ── repeated inputs must not duplicate a row in a client-facing table ──
{
  const res = buildRannOptions({
    checkIn: d(2026, 12, 23),
    categories: ['Premium Tent', 'Premium Tent'],
    durations: [2, 2, 1],
    ...SHARED,
  });
  ok(res.cells.length === 2, `de-dupe: expected 2 cells from repeated inputs, got ${res.cells.length}`);
}

// ── single occupancy: suites ignore it, non-suites are 75% of double ──
for (const t of TIER_DATES) {
  for (const category of TC_TENT_TYPES) {
    for (const nights of DURATIONS) {
      const base = { tent: category, checkIn: t.date, nights, rooms: 2, extraMattress: 1, commissionPct: 22, discountPct: 12 };
      const dbl = quoteTentCity({ ...base, single: false });
      const sgl = quoteTentCity({ ...base, single: true });
      if (isSuite(category)) {
        ok(sgl.roomRent === dbl.roomRent && sgl.sellingPrice === dbl.sellingPrice,
          `${t.label} ${category} ${nights}N: suite must ignore the single flag`);
      } else {
        // 75% of the WHOLE double-occupancy room rent, surcharge included.
        // Asserted against quoteTentCity's own output, not a recomputation.
        ok(Math.abs(sgl.roomRent - dbl.roomRent * 0.75) < 1e-6,
          `${t.label} ${category} ${nights}N: single roomRent ${sgl.roomRent} != 75% of ${dbl.roomRent}`);
        // Extras sit outside the single-occupancy reduction.
        ok(sgl.extrasTotal === dbl.extrasTotal,
          `${t.label} ${category} ${nights}N: extras must not be reduced for single occupancy`);
      }
    }
  }
}
// The 75% ratio holding identically on a 'none' date and an 's2' date proves
// the surcharge is inside the reduction, not added after it.
{
  const base = { tent: 'Super Premium Tent' as TCTentType, nights: 2, rooms: 1, extraMattress: 0, commissionPct: 22, discountPct: 0 };
  for (const date of [d(2026, 11, 4), d(2026, 12, 23)]) {
    const dbl = quoteTentCity({ ...base, checkIn: date, single: false });
    const sgl = quoteTentCity({ ...base, checkIn: date, single: true });
    ok(Math.abs(sgl.roomRent / dbl.roomRent - 0.75) < 1e-9,
      `surcharge must sit inside the single reduction (${date.toDateString()})`);
  }
  const none = quoteTentCity({ ...base, checkIn: d(2026, 11, 4), single: false });
  const s2 = quoteTentCity({ ...base, checkIn: d(2026, 12, 23), single: false });
  ok(s2.roomRent > none.roomRent, 'sanity: the s2 date must actually carry a surcharge');
}

// ── season bounds are inclusive; outside them the flag is raised ──
{
  const grid = { categories: ['Premium Tent'] as TCTentType[], durations: [1] as OptionDuration[], ...SHARED };
  ok(isInTcSeason(TC_SEASON.start), 'season start must be inclusive');
  ok(isInTcSeason(TC_SEASON.end), 'season end must be inclusive');
  ok(!buildRannOptions({ checkIn: d(2026, 11, 1), ...grid }).outOfSeason, '1 Nov 2026 is the first day of season');
  ok(!buildRannOptions({ checkIn: d(2027, 3, 7), ...grid }).outOfSeason, '7 Mar 2027 is the last day of season');
  ok(buildRannOptions({ checkIn: d(2026, 10, 31), ...grid }).outOfSeason, '31 Oct 2026 is before the season');
  ok(buildRannOptions({ checkIn: d(2027, 3, 8), ...grid }).outOfSeason, '8 Mar 2027 is after the season');
  const off = buildRannOptions({ checkIn: d(2027, 4, 10), ...grid });
  ok(off.outOfSeason && off.cells.length === 1, 'out-of-season must still return cells for the caller to warn beside');
}

// ── condensed itinerary: one line per day, nothing invented ──
for (const nights of DURATIONS) {
  const lines = condensedItinerary(nights);
  ok(lines.length === nights + 1, `${nights}N condensed: expected ${nights + 1} lines, got ${lines.length}`);
  ok(lines.every((l, i) => l.startsWith(`*Day ${i + 1}*`)), `${nights}N condensed: day numbering is wrong`);

  const full = RANN_ITINERARIES[nights].days.map(day => day.entries.map(e => e.text).join(' ')).join(' ');
  ok(RANN_ITINERARIES[nights].days.length === nights + 1, `${nights}N full: expected ${nights + 1} days`);
  for (const place of RANN_PLACES) {
    const inCondensed = lines.some(l => l.includes(place));
    if (inCondensed) {
      ok(full.includes(place), `${nights}N: condensed names '${place}' but it is absent from the brochure text for this duration`);
    }
  }
  // Duration-specific places must not leak into shorter packages.
  const condensedAll = lines.join(' ');
  if (nights < 3) ok(!condensedAll.includes('Dholavira'), `${nights}N condensed must not mention Dholavira`);
  if (nights < 2) ok(!condensedAll.includes('Kala Dungar'), `${nights}N condensed must not mention Kala Dungar`);
  ok(condensedAll.includes('Swaminarayan Temple') && condensedAll.includes('Kutch Museum'),
    `${nights}N condensed must carry the final-day museum visit`);
  // The Day 1 dinner misprint must never reach a client-facing line.
  ok(!condensedAll.includes('9:30 – 22:00'), `${nights}N condensed leaked the misprinted dinner time`);
}
// 3N adds exactly the Dholavira day on top of the 2N shape.
ok(condensedItinerary(3)[1] === condensedItinerary(2)[1], '2N and 3N Day 2 must be the same condensed line');
ok(condensedItinerary(1)[0] === condensedItinerary(3)[0], 'Day 1 must be the same condensed line for every duration');

// ── shared day blocks are shared by reference, not copied ──
ok(RANN_ITINERARIES[1].days[0].entries === RANN_ITINERARIES[2].days[0].entries
  && RANN_ITINERARIES[2].days[0].entries === RANN_ITINERARIES[3].days[0].entries,
  'Day 1 must be one shared block across all three packages');
ok(RANN_ITINERARIES[2].days[1].entries === RANN_ITINERARIES[3].days[1].entries,
  'the Kala Dungar day must be one shared block between 2N and 3N');
ok(RANN_ITINERARIES[1].days[1].entries === RANN_ITINERARIES[2].days[2].entries,
  'the departure day must be one shared block between 1N and 2N');

// ── the Day 1 dinner misprint is preserved and flagged, not fixed ──
{
  const dinner = RANN_ITINERARIES[1].days[0].entries.find(e => e.text.includes('scrumptious dinner'))!;
  ok(dinner.time === '9:30 – 22:00', `Day 1 dinner must keep the printed time, got '${dinner.time}'`);
  ok(dinner.correctedTime === '19:30 – 22:00', 'Day 1 dinner must carry an explicit correction');
  ok(!!dinner.note && dinner.note.length > 0, 'Day 1 dinner must explain the misprint');
}

// ── the museum visit is on the FINAL day of every package ──
for (const nights of DURATIONS) {
  const days = RANN_ITINERARIES[nights].days;
  const museumDays = days.filter(day => day.entries.some(e => e.text.includes('Kutch Museum')));
  ok(museumDays.length === 1 && museumDays[0].day === nights + 1,
    `${nights}N: Kutch Museum must appear once, on day ${nights + 1}`);
}
{
  const dholaviraDays = RANN_ITINERARIES[3].days.filter(day =>
    day.entries.some(e => e.text.includes('Archaeological Museum')));
  ok(dholaviraDays.length === 1 && dholaviraDays[0].day === 3, '3N: the Dholavira museum must be on day 3');
  ok(!RANN_ITINERARIES[1].days.some(day => day.entries.some(e => e.text.includes('Dholavira')))
    && !RANN_ITINERARIES[2].days.some(day => day.entries.some(e => e.text.includes('Dholavira'))),
    'Dholavira must appear only in the 3N package');
}

// ── closure warnings, on real 2026-27 dates ──
{
  // 24 Nov 2026 is a TUESDAY → 1N final day (Day 2) = Wed 25 Nov 2026.
  const w = itineraryWarnings(d(2026, 11, 24), 1);
  ok(w.length === 1 && w[0].day === 2 && w[0].text.includes('Wednesday'),
    `1N Wed check-out: expected one day-2 Wednesday warning, got ${JSON.stringify(w)}`);
}
{
  // 21 Dec 2026 is a MONDAY → 2N final day (Day 3) = Wed 23 Dec 2026.
  const w = itineraryWarnings(d(2026, 12, 21), 2);
  ok(w.length === 1 && w[0].day === 3, `2N Wed check-out: expected one day-3 warning, got ${JSON.stringify(w)}`);
}
{
  // 20 Dec 2026 is a SUNDAY → 3N final day (Day 4) = Wed 23 Dec 2026.
  // Day 3 = Tue 22 Dec, so the Dholavira Friday rule must stay silent.
  const w = itineraryWarnings(d(2026, 12, 20), 3);
  ok(w.length === 1 && w[0].day === 4 && w[0].text.includes('Kutch Museum'),
    `3N Wed check-out: expected one day-4 warning, got ${JSON.stringify(w)}`);
}
{
  // 23 Dec 2026 is a WEDNESDAY → 3N Day 3 = Fri 25 Dec 2026 (Dholavira closed);
  // Day 4 = Sat 26 Dec, so no Kutch Museum warning.
  const w = itineraryWarnings(d(2026, 12, 23), 3);
  ok(w.length === 1 && w[0].day === 3 && w[0].text.includes('Dholavira'),
    `3N Fri Dholavira: expected one day-3 warning, got ${JSON.stringify(w)}`);
}
{
  // Same Wednesday check-in at 2 nights: Day 3 (Fri 25 Dec) is the DEPARTURE
  // day, not a Dholavira day, so nothing may fire.
  const w = itineraryWarnings(d(2026, 12, 23), 2);
  ok(w.length === 0, `2N from a Wednesday must not raise a Dholavira warning, got ${JSON.stringify(w)}`);
}
{
  // 3 Nov 2026 is a TUESDAY → 3N Day 3 = Thu 5 Nov, Day 4 = Fri 6 Nov: clean.
  ok(itineraryWarnings(d(2026, 11, 3), 3).length === 0, 'a clean stay must raise no warnings');
}
{
  // 30 Nov 2026 is a MONDAY → 2N final day (Day 3) = Wed 2 Dec 2026.
  // Exercises the month rollover through local date arithmetic.
  const w = itineraryWarnings(d(2026, 11, 30), 2);
  ok(w.length === 1 && w[0].day === 3, `month rollover: expected a day-3 Wednesday warning, got ${JSON.stringify(w)}`);
}
{
  // 30 Dec 2026 is a WEDNESDAY → 1N Day 2 = Thu 31 Dec; nothing fires.
  ok(itineraryWarnings(d(2026, 12, 30), 1).length === 0,
    'a Wednesday CHECK-IN is not a Wednesday museum day for a 1N stay');
}

// ══════════════════════════════════════════════════════════════
// Comparison message: itinerary consolidation
// ══════════════════════════════════════════════════════════════

const msgFor = (durs: OptionDuration[], includeItinerary = true) => buildCompareMessage({
  checkIn: d(2026, 12, 23),
  rooms: 1, single: false, extraMattress: 0,
  rates: durs.map(n => ({ category: 'Non-AC Swiss Cottage' as TCTentType, nights: n, sellingPrice: 10000 * n })),
  includeItinerary,
});

const countOf = (hay: string, needle: string) => hay.split(needle).length - 1;

// ── THE LOAD-BEARING PROPERTY ──
// Sending one itinerary for several durations is only honest because the
// packages share a prefix: an n-night stay runs the longest itinerary's
// Days 1..n unchanged and then checks out on Day n+1. If a brochure edit ever
// makes, say, the 2-night Day 2 differ from the 3-night Day 2, the
// consolidated message would silently describe a day the guest never gets —
// so this must fail loudly rather than the message misdescribing a package.
for (const n of DURATIONS) {
  ok(condensedItinerary(n).length === n + 1,
    `${n}N itinerary must have ${n + 1} day lines, has ${condensedItinerary(n).length}`);
}
for (const longest of DURATIONS) {
  const longLines = condensedItinerary(longest);
  for (const shorter of DURATIONS.filter(x => x < longest)) {
    const shortLines = condensedItinerary(shorter);
    for (let day = 1; day <= shorter; day++) {
      ok(shortLines[day - 1] === longLines[day - 1],
        `shared-prefix broken: ${shorter}N Day ${day} differs from ${longest}N Day ${day} — ` +
        `the consolidated comparison message would misdescribe the ${shorter}-night package.\n` +
        `      ${shorter}N: ${shortLines[day - 1]}\n      ${longest}N: ${longLines[day - 1]}`);
    }
  }
}
// The days deliberately NOT covered by the property: a shorter stay's own
// check-out day (Day n+1) is its own, and must not be assumed to match.
ok(condensedItinerary(1)[1] !== condensedItinerary(3)[1],
  '1N Day 2 is a check-out day and is expected to differ from 3N Day 2 — ' +
  'if these ever match, the concludes-after line is describing the wrong thing');

// ── one duration ticked: unchanged behaviour, numbered heading ──
for (const n of DURATIONS) {
  const m = msgFor([n]);
  ok(m.includes(`*${n}-Night itinerary*`), `single duration ${n}N must keep the numbered heading`);
  ok(!m.includes('*Itinerary*'), `single duration ${n}N must not use the consolidated heading`);
  ok(!m.includes('concludes after Day'), `single duration ${n}N must not emit a concludes-after line`);
  ok(countOf(m, '*Day 1*') === 1, `single duration ${n}N must contain exactly one *Day 1* line`);
  ok(countOf(m, '*Day ') === n + 1, `single duration ${n}N must list ${n + 1} days`);
}

// ── two or more ticked: one consolidated itinerary, no repeated days ──
const COMBOS: OptionDuration[][] = [[1, 2], [1, 3], [2, 3], [1, 2, 3]];
for (const combo of COMBOS) {
  const m = msgFor(combo);
  const longest = combo[combo.length - 1];
  const shorter = combo.slice(0, -1);
  const label = combo.join('+');

  ok(m.includes('*Itinerary*'), `${label}: must use the unnumbered consolidated heading`);
  for (const n of DURATIONS) {
    ok(!m.includes(`*${n}-Night itinerary*`), `${label}: must not emit a numbered itinerary heading (${n}N)`);
  }

  // The whole point of the change: Day 1 appears once, not once per duration.
  ok(countOf(m, '*Day 1*') === 1, `${label}: expected exactly one *Day 1* line, found ${countOf(m, '*Day 1*')}`);
  ok(countOf(m, '*Day ') === longest + 1,
    `${label}: expected ${longest + 1} day lines (the ${longest}N itinerary), found ${countOf(m, '*Day ')}`);
  // Every day line printed must genuinely be the longest itinerary's.
  condensedItinerary(longest).forEach(line => {
    ok(m.includes(line), `${label}: consolidated block is missing a ${longest}N day line`);
  });

  // The concludes-after line names every ticked shorter duration, ascending,
  // and no others — including never the longest, which is fully written out.
  const expected = '_' + shorter.map(n => `${n}-Night stay concludes after Day ${n + 1}`).join('; ') + '._';
  ok(m.includes(expected), `${label}: expected concludes-after line\n      ${expected}\n      message had: ` +
    (m.split('\n').find(l => l.includes('concludes after Day')) ?? '(none)'));
  ok(countOf(m, 'concludes after Day') === shorter.length,
    `${label}: expected ${shorter.length} concludes-after clause(s), found ${countOf(m, 'concludes after Day')}`);
  for (const n of DURATIONS) {
    const named = m.includes(`${n}-Night stay concludes`);
    ok(named === shorter.includes(n),
      `${label}: ${n}N ${named ? 'must not be' : 'must be'} named in the concludes-after line`);
  }
}

// The exact line the brief specifies, pinned verbatim.
ok(msgFor([1, 2, 3]).includes('_1-Night stay concludes after Day 2; 2-Night stay concludes after Day 3._'),
  '1+2+3 must produce the specified concludes-after wording');
ok(msgFor([2, 3]).includes('_2-Night stay concludes after Day 3._'),
  '2+3 must produce the same wording shape with a single clause');

// ── itinerary off: no itinerary content at all, either shape ──
for (const combo of [[1] as OptionDuration[], [1, 2, 3] as OptionDuration[]]) {
  const m = msgFor(combo, false);
  ok(!m.includes('*Day '), `itinerary off (${combo.join('+')}): no day lines may appear`);
  ok(!m.includes('concludes after Day'), `itinerary off (${combo.join('+')}): no concludes-after line may appear`);
  ok(!m.includes('*Itinerary*'), `itinerary off (${combo.join('+')}): no itinerary heading may appear`);
}

// ══════════════════════════════════════════════════════════════
// One itinerary rule, two renderers
// ══════════════════════════════════════════════════════════════

// ── the helper's contract, over every combination ──
ok(compareItinerarySection([]) === null, 'no ticked durations must yield no itinerary section');

const ALL_COMBOS: OptionDuration[][] = [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]];
for (const combo of ALL_COMBOS) {
  const sec = compareItinerarySection(combo)!;
  const longest = combo[combo.length - 1];
  const label = combo.join('+');

  ok(sec !== null, `${label}: must yield a section`);
  ok(sec.writtenOut === longest, `${label}: must write out the longest duration (${longest}), got ${sec.writtenOut}`);
  ok(JSON.stringify(sec.durations) === JSON.stringify(combo), `${label}: durations must round-trip ascending`);
  // The days printed are exactly the longest brochure itinerary, untouched.
  ok(JSON.stringify(sec.dayLines) === JSON.stringify(condensedItinerary(longest)),
    `${label}: dayLines must be the ${longest}N brochure itinerary verbatim`);
  // Channel-neutral: markup is the renderer's job, not the helper's.
  ok(!sec.heading.includes('*') && !sec.heading.includes('_'),
    `${label}: heading must carry no channel markup, got "${sec.heading}"`);
  ok(!(sec.concludesLine ?? '').includes('_'),
    `${label}: concludesLine must carry no channel markup`);

  if (combo.length === 1) {
    ok(sec.heading === `${longest}-Night itinerary`, `${label}: single duration keeps the numbered heading`);
    ok(sec.concludesLine === undefined, `${label}: single duration has no concludes-after line`);
  } else {
    ok(sec.heading === 'Itinerary', `${label}: multi-duration heading must be unnumbered, got "${sec.heading}"`);
    ok(sec.concludesLine === combo.slice(0, -1).map(n => `${n}-Night stay concludes after Day ${n + 1}`).join('; ') + '.',
      `${label}: concludes-after sentence wrong, got "${sec.concludesLine}"`);
  }
}
// Unsorted / duplicated input must normalise, not corrupt the output.
ok(JSON.stringify(compareItinerarySection([3, 1, 2, 1] as OptionDuration[])) ===
   JSON.stringify(compareItinerarySection([1, 2, 3] as OptionDuration[])),
  'compareItinerarySection must normalise unordered, duplicated input');

// ── the MESSAGE renders the helper and adds nothing of its own ──
for (const combo of ALL_COMBOS) {
  const sec = compareItinerarySection(combo)!;
  const m = msgFor(combo);
  const label = combo.join('+');
  ok(m.includes(`*${sec.heading}*`), `${label}: message must render the helper's heading in bold`);
  sec.dayLines.forEach(line => ok(m.includes(line), `${label}: message must render every helper day line`));
  // No day line the helper did not supply may appear.
  ok(countOf(m, '*Day ') === sec.dayLines.length,
    `${label}: message prints ${countOf(m, '*Day ')} day lines but the helper supplied ${sec.dayLines.length}`);
  if (sec.concludesLine) {
    ok(m.includes(`_${sec.concludesLine}_`), `${label}: message must render the helper's concludes line in italic`);
  } else {
    ok(!m.includes('concludes after Day'), `${label}: message must not invent a concludes line`);
  }
}

// ── the PDF is checked at SOURCE level ──
// jsPDF output is not inspectable without rendering, so these assertions pin
// that downloadComparePdf DERIVES from the shared helper rather than pinning
// the drawn pixels. See the report: the PDF's rendering is not covered by test.
{
  const page = readFileSync(new URL('../pages/RannUtsavBuilder.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('const downloadComparePdf');
  ok(start !== -1, 'downloadComparePdf not found — these source assertions are now vacuous and must be repaired');
  const end = page.indexOf('\n  };', start);
  ok(end > start, 'could not delimit downloadComparePdf — source assertions are unreliable, repair them');
  const body = page.slice(start, end);
  const code = body.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  ok(code.includes('compareItinerarySection('),
    'the compare PDF must take its itinerary from the shared helper');
  ok(!code.includes('condensedItinerary('),
    'the compare PDF must not call condensedItinerary directly — that is how it drifted from the message before');
  ok(!/-Night itinerary/.test(code),
    'the compare PDF must not build its own heading — it must print the helper\'s');
  ok(!/concludes after Day/.test(code),
    'the compare PDF must not build its own concludes-after sentence');
  // The whole page legitimately handles internal figures (the margin strip), so
  // this is scoped to the client-facing PDF function only.
  for (const banned of ['netCost', 'profit', 'commissionPct', 'compareCommission', 'discountPct']) {
    ok(!code.includes(banned),
      `downloadComparePdf references ${banned} — the client-facing PDF must not print an internal figure`);
  }
  // Whole-file guard: the page must not import condensedItinerary at all now.
  ok(!/import\s*\{[^}]*condensedItinerary/.test(page),
    'RannUtsavBuilder must not import condensedItinerary — the compare PDF is the only place it was used');
}

// ── no internal figure may reach the client-facing message ──
{
  const src = readFileSync(new URL('../services/rannCompareMessage.ts', import.meta.url), 'utf8');
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const banned of ['netCost', 'profit', 'commissionPct', 'discountPct']) {
    ok(!code.includes(banned),
      `rannCompareMessage.ts references ${banned} outside a comment — internal figures must not be in scope`);
  }
}

// ── toISOString must not appear in either new service file ──
for (const file of ['rannItinerary.ts', 'rannOptions.ts', 'rannCompareMessage.ts']) {
  const src = readFileSync(new URL(`../services/${file}`, import.meta.url), 'utf8');
  ok(!src.includes('toISOString'),
    `${file}: toISOString is banned — it forces UTC and shifts IST dates back a day`);
}

console.log(`\nChecks: ${checks}`);
if (fail.length) { console.error(`FAILURES: ${fail.length}\n` + fail.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
