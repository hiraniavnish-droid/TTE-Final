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

// ── toISOString must not appear in either new service file ──
for (const file of ['rannItinerary.ts', 'rannOptions.ts']) {
  const src = readFileSync(new URL(`../services/${file}`, import.meta.url), 'utf8');
  ok(!src.includes('toISOString'),
    `${file}: toISOString is banned — it forces UTC and shifts IST dates back a day`);
}

console.log(`\nChecks: ${checks}`);
if (fail.length) { console.error(`FAILURES: ${fail.length}\n` + fail.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
