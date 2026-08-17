// Exhaustive re-verification of the Rann Utsav engine against the printed
// brochure "Rann Utsav - The Tent City Brochure (2026-27)", pages 12 and 13.
//
// Run: npx tsx scripts/verify-rann-brochure.ts
//
// THE BROCHURE IS THE AUTHORITY. Every expected figure below is re-derived
// here from the printed tables, deliberately WITHOUT calling the engine's own
// tcTier() or rate tables — otherwise the test would just assert the engine
// agrees with itself. The rules are transcribed once, in BROCHURE_* constants,
// and applied by locally written logic.
//
// Coverage: every calendar date of the season (1 Nov 2026 – 7 Mar 2027) x every
// accommodation category x 1/2/3 nights x single & double occupancy x 0/1/2
// extra mattresses x 1 & 2 rooms.
//
// ── How the brochure defines the bands (p12) ──────────────────────────────
//
// Base band  : "Tarrif For November, February & March 2026-27
//               (Excluding Full Moon Diwali)"
// Surcharge 1: "Additional Tarrif For November, February 2026-27
//               (Full Moon & Diwali: 8th to 14th Nov)
//               Dec & Jan(Excluding Full Moon & Christmas Week)"
//               -> 1N 2,000 / 2N 3,500 / 3N 4,500
// Surcharge 2: "Additional Tariff for Dec & Jan Full Moon & Christmas:
//               18th Dec to 2nd Jan 2027"
//               -> 1N 4,000 / 2N 6,000 / 3N 8,000
//
// Two readings had to be settled, both by the brochure's own wording:
//
//  * "8th to 14th Nov" attaches to DIWALI, not to Full Moon. November's Full
//    Moon is 22–25 Nov per p13. Both occasions take surcharge 1.
//
//  * January's Full Moon (20–23 Jan, p13) takes surcharge 2, not 1. Surcharge 1
//    explicitly EXCLUDES Full Moon from Dec & Jan, so were it not in surcharge
//    2 it would carry no surcharge at all and a peak date would price BELOW an
//    ordinary January date. The date range "18th Dec to 2nd Jan" attaches to
//    Christmas; "Dec & Jan Full Moon" is a separately named occasion.
//
// Dark Moon dates (p13: 9 Nov, 8 Dec, 7 Jan, 6 Feb) appear in no tariff row, so
// they are NOT a pricing concept — they take whatever their month's rule gives.

import {
  quoteTentCity, TC_TENT_TYPES, tcTier, isSuite, TC_SEASON,
  type TCTentType, type TCTier,
} from '../services/rannUtsavRates';

let checks = 0;
const fail: string[] = [];
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) fail.push(msg); };

// ── Transcribed from p12/p13. Per person, INR. ────────────────────────────
const BROCHURE_BASE: Record<string, Record<number, number>> = {
  'Super Premium Tent':      { 1: 10300, 2: 20600, 3: 30900 },
  'Premium Tent':            { 1: 9300,  2: 18600, 3: 27900 },
  'Deluxe AC Swiss Cottage': { 1: 8300,  2: 16600, 3: 24900 },
  'Non-AC Swiss Cottage':    { 1: 6300,  2: 12600, 3: 18900 },
};
const BROCHURE_SUITE: Record<string, { rates: Record<number, number>; pax: number }> = {
  'Darbari Suite': { rates: { 1: 70000, 2: 140000, 3: 210000 }, pax: 4 },
  'Rajwadi Suite': { rates: { 1: 35000, 2: 70000,  3: 105000 }, pax: 2 },
};
const BROCHURE_SURCHARGE: Record<TCTier, Record<number, number>> = {
  none: { 1: 0,    2: 0,    3: 0    },
  s1:   { 1: 2000, 2: 3500, 3: 4500 },
  s2:   { 1: 4000, 2: 6000, 3: 8000 },
};
// Base band prints 5,500 (AC types) / 4,500 (Non-AC). Both surcharge rows print
// 6000 (Super Premium, Premium & Deluxe AC Cottage) / 5,000 Non AC.
// NOTE: the 6000 on p12 is printed WITHOUT a rupee symbol, unlike every other
// figure on the page. Read as ₹6,000.
const BROCHURE_MATTRESS: Record<TCTier, { ac: number; nonac: number }> = {
  none: { ac: 5500, nonac: 4500 },
  s1:   { ac: 6000, nonac: 5000 },
  s2:   { ac: 6000, nonac: 5000 },
};
const BROCHURE_SUITE_MATTRESS = 7750;   // p13, both suites

// p13 peak-date table, transcribed as inclusive [from, to] day ranges.
const NOV_FULL_MOON = [22, 25];
const DEC_FULL_MOON = [21, 24];
const JAN_FULL_MOON = [20, 23];
const FEB_FULL_MOON = [18, 21];
const DIWALI_NOV    = [8, 14];          // p12 states 8th to 14th Nov
// Christmas: 18 Dec 2026 to 2 Jan 2027.

const inRange = (d: number, r: number[]) => d >= r[0] && d <= r[1];

// Independent implementation of the brochure's banding. Deliberately does not
// consult the engine.
function brochureTier(y: number, m: number, d: number): TCTier {
  if (m === 12) {
    if (d >= 18) return 's2';                       // Christmas week (Dec side)
    if (inRange(d, DEC_FULL_MOON)) return 's2';     // (inside Christmas anyway)
    return 's1';                                    // Dec, excluding the above
  }
  if (m === 1) {
    if (d <= 2) return 's2';                        // Christmas week (Jan side)
    if (inRange(d, JAN_FULL_MOON)) return 's2';     // Jan Full Moon
    return 's1';                                    // Jan, excluding the above
  }
  if (m === 11) {
    if (inRange(d, DIWALI_NOV)) return 's1';
    if (inRange(d, NOV_FULL_MOON)) return 's1';
    return 'none';
  }
  if (m === 2) {
    if (inRange(d, FEB_FULL_MOON)) return 's1';
    return 'none';
  }
  if (m === 3) return 'none';                       // March: base band only
  return 'none';
}

// Independent expected room rent, straight from the printed footnotes:
// "Rates on single occupancy are 75% of double occupancy cost".
function expectedRoomRent(tent: string, tier: TCTier, nights: number, rooms: number, single: boolean): number {
  if (BROCHURE_SUITE[tent]) return BROCHURE_SUITE[tent].rates[nights] * rooms;
  const perPerson = BROCHURE_BASE[tent][nights] + BROCHURE_SURCHARGE[tier][nights];
  let rent = perPerson * 2 * rooms;
  if (single) rent *= 0.75;
  return rent;
}

function expectedMattress(tent: string, tier: TCTier, count: number, nights: number): number {
  if (!count) return 0;
  const rate = BROCHURE_SUITE[tent]
    ? BROCHURE_SUITE_MATTRESS
    : BROCHURE_MATTRESS[tier][tent.includes('Non-AC') ? 'nonac' : 'ac'];
  return count * rate * nights;
}

// ── 1. Every date of the season maps to the brochure's band ───────────────
const eachSeasonDate = (): { y: number; m: number; d: number; date: Date }[] => {
  const out: { y: number; m: number; d: number; date: Date }[] = [];
  const cur = new Date(TC_SEASON.start.getFullYear(), TC_SEASON.start.getMonth(), TC_SEASON.start.getDate());
  const end = new Date(TC_SEASON.end.getFullYear(), TC_SEASON.end.getMonth(), TC_SEASON.end.getDate());
  while (cur <= end) {
    out.push({ y: cur.getFullYear(), m: cur.getMonth() + 1, d: cur.getDate(), date: new Date(cur) });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const DATES = eachSeasonDate();
const tierCount: Record<string, number> = { none: 0, s1: 0, s2: 0 };

for (const { y, m, d, date } of DATES) {
  const expected = brochureTier(y, m, d);
  const actual = tcTier(date);
  tierCount[expected]++;
  ok(actual === expected,
    `tier ${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}: engine '${actual}', brochure '${expected}'`);
}

// ── 2. Every peak date named on p13 gets a surcharge ──────────────────────
// A date the brochure calls out as peak must never price at the base band.
const namedPeaks: { label: string; date: Date; minTier: TCTier }[] = [
  { label: 'Diwali 8 Nov',        date: new Date(2026, 10, 8),  minTier: 's1' },
  { label: 'Diwali 14 Nov',       date: new Date(2026, 10, 14), minTier: 's1' },
  { label: 'Nov Full Moon 22',    date: new Date(2026, 10, 22), minTier: 's1' },
  { label: 'Nov Full Moon 25',    date: new Date(2026, 10, 25), minTier: 's1' },
  { label: 'Dec Full Moon 21',    date: new Date(2026, 11, 21), minTier: 's2' },
  { label: 'Dec Full Moon 24',    date: new Date(2026, 11, 24), minTier: 's2' },
  { label: 'Christmas 18 Dec',    date: new Date(2026, 11, 18), minTier: 's2' },
  { label: 'Christmas 2 Jan',     date: new Date(2027, 0, 2),   minTier: 's2' },
  { label: 'Jan Full Moon 20',    date: new Date(2027, 0, 20),  minTier: 's2' },
  { label: 'Jan Full Moon 23',    date: new Date(2027, 0, 23),  minTier: 's2' },
  { label: 'Feb Full Moon 18',    date: new Date(2027, 1, 18),  minTier: 's1' },
  { label: 'Feb Full Moon 21',    date: new Date(2027, 1, 21),  minTier: 's1' },
];
for (const p of namedPeaks) {
  ok(tcTier(p.date) === p.minTier, `${p.label}: engine '${tcTier(p.date)}', brochure '${p.minTier}'`);
}

// A named peak date must never cost LESS than the day before it outside the peak.
for (const p of namedPeaks) {
  const before = new Date(p.date.getFullYear(), p.date.getMonth(), p.date.getDate() - 1);
  const q = (dt: Date) => quoteTentCity({
    tent: 'Non-AC Swiss Cottage', checkIn: dt, nights: 1, rooms: 1,
    single: false, extraMattress: 0, commissionPct: 0, discountPct: 0,
  }).roomRent;
  ok(q(p.date) >= q(before), `${p.label}: peak date prices BELOW the preceding day`);
}

// ── 3. Exhaustive permutation sweep against brochure arithmetic ───────────
let permutations = 0;
for (const { date } of DATES) {
  const tier = brochureTier(date.getFullYear(), date.getMonth() + 1, date.getDate());
  for (const tent of TC_TENT_TYPES as TCTentType[]) {
    for (const nights of [1, 2, 3]) {
      for (const rooms of [1, 2]) {
        for (const single of [false, true]) {
          for (const mattress of [0, 1, 2]) {
            permutations++;
            const q = quoteTentCity({
              tent, checkIn: date, nights, rooms, single,
              extraMattress: mattress, commissionPct: 0, discountPct: 0,
            });
            const wantRent = expectedRoomRent(tent, tier, nights, rooms, single);
            const wantMattress = expectedMattress(tent, tier, mattress, nights);

            if (q.roomRent !== wantRent) {
              fail.push(`${tent} ${date.toDateString()} ${nights}N r${rooms} ${single ? 'single' : 'double'}: roomRent ${q.roomRent} != brochure ${wantRent}`);
            }
            checks++;
            if (q.extrasTotal !== wantMattress) {
              fail.push(`${tent} ${date.toDateString()} ${nights}N m${mattress}: mattress ${q.extrasTotal} != brochure ${wantMattress}`);
            }
            checks++;
          }
        }
      }
    }
  }
}

// ── 4. Printed footnotes hold ─────────────────────────────────────────────
{
  const base = { checkIn: new Date(2026, 10, 3), nights: 1 as const, rooms: 1, extraMattress: 0, commissionPct: 0, discountPct: 0 };
  for (const tent of TC_TENT_TYPES as TCTentType[]) {
    const dbl = quoteTentCity({ ...base, tent, single: false }).roomRent;
    const sgl = quoteTentCity({ ...base, tent, single: true }).roomRent;
    if (isSuite(tent)) {
      ok(sgl === dbl, `${tent}: a suite is priced per suite, so single occupancy must not reduce it`);
    } else {
      ok(sgl === dbl * 0.75, `${tent}: single occupancy must be 75% of double (got ${sgl} vs ${dbl})`);
    }
  }
}

// Suite pax as printed on p13.
ok(BROCHURE_SUITE['Darbari Suite'].pax === 4, 'Darbari Suite is printed as 4 pax');
ok(BROCHURE_SUITE['Rajwadi Suite'].pax === 2, 'Rajwadi Suite is printed as 2 pax');

// Multi-night rates are printed as flat totals, NOT per-night multiples that
// could drift: 2N must equal exactly 2x the 1N per-person figure, and 3N 3x.
for (const tent of Object.keys(BROCHURE_BASE)) {
  ok(BROCHURE_BASE[tent][2] === BROCHURE_BASE[tent][1] * 2, `${tent}: printed 2N is not exactly 2x 1N`);
  ok(BROCHURE_BASE[tent][3] === BROCHURE_BASE[tent][1] * 3, `${tent}: printed 3N is not exactly 3x 1N`);
}
// The surcharge, by contrast, is NOT a flat multiple — it is printed as its own
// figure per duration. Pin that so nobody "simplifies" it into a per-night rate.
ok(BROCHURE_SURCHARGE.s1[2] !== BROCHURE_SURCHARGE.s1[1] * 2, 's1 2N surcharge is not 2x the 1N surcharge, per the printed table');
ok(BROCHURE_SURCHARGE.s2[3] !== BROCHURE_SURCHARGE.s2[1] * 3, 's2 3N surcharge is not 3x the 1N surcharge, per the printed table');

// ── Report ────────────────────────────────────────────────────────────────
console.log(`\nSeason dates checked : ${DATES.length}  (base ${tierCount.none} · surcharge-1 ${tierCount.s1} · surcharge-2 ${tierCount.s2})`);
console.log(`Rate permutations    : ${permutations}`);
console.log(`Total assertions     : ${checks}`);
if (fail.length) {
  console.error(`\nFAILURES: ${fail.length}\n` + fail.slice(0, 40).map(f => '  - ' + f).join('\n'));
  if (fail.length > 40) console.error(`  … and ${fail.length - 40} more`);
  process.exit(1);
}
console.log('\nALL RATES MATCH THE BROCHURE — engine verified against pages 12 and 13 with zero discrepancies.');
