// ============================================================
// Inland Tourways adapter for the Rate Wall.
//
// Counterpart to rajarshiWall.ts, and harder for one reason: Rajarshi's rates
// are date-tiered with an explicit meal plan, so quoteStay() answers "what
// does this cost" outright. Inland prints TWO rate columns per room whose
// MEANING changes hotel to hotel — occupancy in one block, two meal plans in
// the next, weekday/weekend in a third, two half-year seasons in a fourth.
// inlandRates.ts deliberately refuses to guess which column applies and makes
// the caller pass one. This adapter is where that choice is made, from the
// sheet's own printed header text (axisLabels) and never from axisType alone.
//
// The governing rule everywhere below: when the printed labels do not say
// which column applies, we show BOTH labelled with the supplier's own words
// and mark the entry resolutionOk: false. We never pick one. Quoting a
// weekday rate on a Saturday is the failure this whole file exists to avoid.
//
// Money arithmetic is quoteInlandStay()'s wherever its shape fits (one rate
// for the whole stay). The only exception is the weekday/weekend "Your dates"
// row, where the nightly rate alternates and no single column applies — that
// one sums the room's own printed figures night by night and then applies the
// IDENTICAL markup rule as inlandRates.ts: percent applies to the net room
// total (never to the extra-person supplement), flat is ₹ per room-night.
// ============================================================

import { type InlandHotel, type InlandRoom } from './inlandData';
import { quoteInlandStay, hotelsByCity, suggestSeason, type MarkupMode, type RateColumn } from './inlandRates';
import { cheapestQuotable, type WallEntry, type WallRoomRow } from './rateWall';

export interface InlandWallInput {
  city: string | 'ALL';
  checkIn: string;             // ISO yyyy-mm-dd
  nights: number;
  rooms: number;
  pax: number;                 // total guests across all rooms
  markupMode: MarkupMode;
  markupValue: number;
}

const ON_REQUEST = 'On request';

// The sheet prints no room capacities anywhere, so a base of two guests per
// room is the working assumption for every axis except a column explicitly
// labelled "Triple". Two extra beds is the same ceiling rajarshiWall.ts uses;
// beyond that the party needs another room, and quoting one room for six
// guests off a double rate is a number no hotel would honour.
const BASE_OCCUPANCY = 2;
const MAX_EXTRA_PER_ROOM = 2;

// ── local date arithmetic ────────────────────────────────────────────────
//
// toISOString() is banned in this codebase: it forces UTC and in IST renders
// the day before the one the agent selected, which is precisely how a Friday
// night would silently price as a weekday.

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// 0 = Sunday … 6 = Saturday, for the nth night of the stay. A night belongs to
// a bucket by its OWN weekday: night i is checkIn + i, so a Thursday check-in
// for 3 nights covers Thu/Fri/Sat, not Fri/Sat/Sun.
function weekdayOfNight(checkIn: string, i: number): number {
  const [y, m, d] = checkIn.split('-').map(Number);
  return new Date(y, m - 1, d + i).getDay();
}

// ── money ────────────────────────────────────────────────────────────────

interface Money {
  netTotal: number;
  markupAmount: number;
  sellingTotal: number;
  sellingPerNight: number;
}

// The markup rule, copied verbatim from inlandRates.ts so the two can never
// drift: percent is a percentage of the NET ROOM TOTAL only (the extra-person
// supplement is passed through at cost), flat is ₹ per room per night and does
// not depend on the net at all.
function markupFor(netRoomTotal: number, i: InlandWallInput): number {
  return i.markupMode === 'percent'
    ? Math.round(netRoomTotal * i.markupValue / 100)
    : Math.round(i.markupValue * i.nights * i.rooms);
}

// A non-finite or non-positive total is a data fault, not a cheap room — the
// caller turns null into a blocked row rather than rendering '₹0' or '₹NaN'
// on a card an agent reads out to a customer.
function money(netRoomTotal: number, extraTotal: number, markupAmount: number, i: InlandWallInput): Money | null {
  const netTotal = netRoomTotal + extraTotal;
  const sellingTotal = netTotal + markupAmount;
  if (!Number.isFinite(sellingTotal) || sellingTotal <= 0) return null;
  return {
    netTotal,
    markupAmount,
    sellingTotal,
    sellingPerNight: Math.round(sellingTotal / Math.max(1, i.nights)),
  };
}

// ── occupancy label reading ──────────────────────────────────────────────
//
// Nineteen distinct label pairs appear across the 170 occupancy rooms. The
// roles below are read from the printed text; axisType is only a hint and is
// wrong at least once (see occupancyRows).
//
//   'either' is a single figure printed as covering both, e.g. 'SGL / DBL ROOM'
//   'extra'  is NOT a second occupancy — 'Ex Person MAPAI' is the per-head
//            supplement (Rann Resort Dholavira prints DOUBLE 5460 | Ex Person
//            2100). Treating it as a triple rate would quote a 3-pax party
//            ₹2,100 for the room.
type OccRole = 'single' | 'double' | 'triple' | 'either' | 'extra' | 'none';

function occRole(label: string | undefined): OccRole {
  const s = (label || '').trim().toLowerCase();
  if (!s) return 'none';
  if (/triple|\btpl\b/.test(s)) return 'triple';
  if (/\bex\.?\s*(person|adult|adults|pax)/.test(s)) return 'extra';
  // 'SIngel' and 'Singel' are both in the sheet; so is 'SGL'.
  const hasSingle = /\bs(in)?gl\b|sing?el|single/.test(s);
  const hasDouble = /\bdbl\b|double/.test(s);
  if (hasSingle && hasDouble) return 'either';   // 'SGL / DBL ROOM' — one figure, both occupancies
  if (hasSingle) return 'single';
  if (hasDouble) return 'double';
  return 'none';
}

// ── extra-person supplement ──────────────────────────────────────────────

// Three outcomes, not two:
//   total    — the party is covered, either because it fits the base occupancy
//              or because the sheet prints a usable supplement
//   uncovered— the sheet prints NO usable supplement, so the room is priced at
//              its base occupancy and the shortfall is declared to the customer
//   reason   — the party cannot be housed in one room at all
interface ExtraPlan { total: number; uncovered: number }
interface ExtraBlocked { reason: string }
const isExtraBlocked = (e: ExtraPlan | ExtraBlocked): e is ExtraBlocked =>
  (e as ExtraBlocked).reason !== undefined;

// `childAdult` is NOT reliably an extra-person supplement. On 22 rooms it holds
// a THIRD rate column the parser had nowhere else to put — Kings Kraft Tremezzo
// prints CPAI 2900 | MAPAI 3800 and childAdult 4700, which is plainly the APAI
// rate, not a ₹4,700 extra bed on a ₹2,900 room. So the figure is only accepted
// as a supplement when it is actually smaller than the room rate it supplements.
// Anything else is refused, not guessed: an extra bed dearer than the room is a
// transcription artefact every time.
function extraPersonTotal(
  room: InlandRoom,
  paxPerRoom: number,
  baseOccupancy: number,
  baseRate: number,
  explicitSupplement: number | null,
  i: InlandWallInput,
): ExtraPlan | ExtraBlocked {
  const perRoom = Math.max(0, paxPerRoom - baseOccupancy);
  if (perRoom === 0) return { total: 0, uncovered: 0 };
  // Beyond two extra beds the party needs another room whatever the sheet
  // says. Pricing a double rate for six guests is not a caveat, it is a
  // number no hotel would honour, so this stays a hard block.
  if (paxPerRoom - BASE_OCCUPANCY > MAX_EXTRA_PER_ROOM) {
    return { reason: `Too small for ${paxPerRoom} pax` };
  }

  const raw = explicitSupplement != null
    ? explicitSupplement
    : (typeof room.childAdult === 'number' ? room.childAdult : null);

  // No usable supplement: quote the base-occupancy rate and declare what it
  // does not cover, rather than showing the agent an empty wall. The
  // declaration is not optional — see clientNote in rateWall.ts.
  if (raw == null || !Number.isFinite(raw) || raw <= 0 || raw >= baseRate) {
    return { total: 0, uncovered: perRoom };
  }
  return { total: raw * perRoom * i.rooms * i.nights, uncovered: 0 };
}

// ── room naming ──────────────────────────────────────────────────────────
//
// Two hotels (Anantam Resort Sasangir, Ambar Sarovar Portico) were printed
// TWICE in the source sheet with conflicting rates, and the transcription kept
// both sets apart by appending '[Block A]' / '[Block B]' to the room name.
// That marker is a parser artefact, not part of any room's name, and
// formatClientExport prints room names — so left alone it reaches customers as
// 'Superior Room [Block B]'. Strip it from the name and keep the identity in
// derivedNote, which is agent-only by contract. The hotel's reviewNotes
// explain the conflict on the card.
const BLOCK_MARKER = /\s*\[(Block\s+[A-Z])\]\s*/i;

const displayRoomName = (room: InlandRoom) => room.name.replace(BLOCK_MARKER, ' ').trim();
const blockOf = (room: InlandRoom): string | undefined => {
  const m = BLOCK_MARKER.exec(room.name);
  return m ? `${m[1]} of 2 conflicting printed rate sets` : undefined;
};

// The caveat wording. Built from the room's own base occupancy, not a
// hard-coded 2 — a printed triple column covers three.
const coverageNote = (baseOccupancy: number) =>
  `Rate covers ${baseOccupancy} guests — extra bed to be confirmed`;

const coverageProvenance = (uncovered: number) =>
  `no extra-person rate printed; ${uncovered} guest${uncovered === 1 ? '' : 's'} not covered`;

const joinNotes = (...parts: (string | undefined)[]) => {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(' · ') : undefined;
};

// ── one priced row off a single printed column ───────────────────────────

interface ColumnRowSpec {
  hotel: InlandHotel;
  room: InlandRoom;
  key: string;
  column: RateColumn;
  planLabel?: string;
  baseOccupancy: number;         // 2 normally; 3 when the column is a printed triple rate
  explicitSupplement?: number | null;  // an 'Ex Person' column's own figure, when the sheet prints one
  derivedNote?: string;
}

function columnRow(s: ColumnRowSpec, i: InlandWallInput, paxPerRoom: number): WallRoomRow {
  const base = {
    key: s.key, roomName: displayRoomName(s.room), planLabel: s.planLabel,
    derivedNote: joinNotes(s.derivedNote, blockOf(s.room)),
  };

  // extraPersons: 0 — the supplement is added below, because it may come from
  // an 'Ex Person' rate column that quoteInlandStay cannot see. Its markup is
  // unaffected: percent applies to netRoomTotal only.
  const q = quoteInlandStay({
    hotel: s.hotel, room: s.room, column: s.column,
    nights: i.nights, rooms: i.rooms, extraPersons: 0,
    markupMode: i.markupMode, markupValue: i.markupValue,
  });
  if (q.isOnRequest) return { ...base, quotable: false, blockedReason: ON_REQUEST };

  const extra = extraPersonTotal(
    s.room, paxPerRoom, s.baseOccupancy, q.baseRate,
    s.explicitSupplement ?? null, i,
  );
  if (isExtraBlocked(extra)) return { ...base, quotable: false, blockedReason: extra.reason };

  const m = money(q.netRoomTotal, extra.total, q.markupAmount, i);
  if (!m) return { ...base, quotable: false, blockedReason: ON_REQUEST };
  if (extra.uncovered > 0) {
    return {
      ...base, quotable: true, ...m,
      clientNote: coverageNote(s.baseOccupancy),
      derivedNote: joinNotes(s.derivedNote, coverageProvenance(extra.uncovered)),
    };
  }
  return { ...base, quotable: true, ...m };
}

// A column is "printed" when the sheet gave it either a header or a value.
// A blank second column is not a second rate — most single-figure occupancy
// rooms leave rate2 null with onRequest2 false, which quoteInlandStay already
// treats as on-request, but we must not emit a row for it at all.
const hasColumn2 = (room: InlandRoom): boolean =>
  room.axisLabels[1] != null || room.rate2 != null || room.onRequest2;

// ── occupancy axis ───────────────────────────────────────────────────────

function occupancyRows(hotel: InlandHotel, room: InlandRoom, ri: number, i: InlandWallInput, paxPerRoom: number): WallRoomRow[] {
  const k = (suffix: string) => `${hotel.id}::${ri}::${suffix}`;
  const r1 = occRole(room.axisLabels[0]);
  const r2 = hasColumn2(room) ? occRole(room.axisLabels[1]) : 'none';

  // DAKSH THE NIRVANA RETREAT prints 'DBL CPAI | Double MAPAI' — both columns
  // are double occupancy and the axis is really the MEAL PLAN, classified as
  // occupancy in inlandData. Reading the labels rather than trusting axisType
  // catches it: emit both plans as priced rows instead of silently discarding
  // one of the two rates.
  if (r1 === r2 && (r1 === 'double' || r1 === 'single') && room.axisLabels[0] !== room.axisLabels[1]) {
    return mealPlanRows(hotel, room, ri, i, paxPerRoom);
  }

  const single = r1 === 'single' ? 1 : r2 === 'single' ? 2 : null;
  const double = r1 === 'double' || r1 === 'either' ? 1 : r2 === 'double' || r2 === 'either' ? 2 : null;
  const triple = r1 === 'triple' ? 1 : r2 === 'triple' ? 2 : null;
  const extraCol = r1 === 'extra' ? 1 : r2 === 'extra' ? 2 : null;

  // The 'Ex Person' column is a supplement, never a room rate.
  const explicitSupplement = extraCol
    ? (extraCol === 1 ? (room.onRequest1 ? null : room.rate1) : (room.onRequest2 ? null : room.rate2))
    : null;

  // Where only one figure is printed, it is the rate whatever the occupancy —
  // 38 rooms print a bare 'Double' with a blank second column.
  const only = hasColumn2(room) ? null : 1;

  let column: RateColumn;
  let baseOccupancy = BASE_OCCUPANCY;

  if (only) {
    column = 1;
  } else if (paxPerRoom <= 1) {
    column = (single ?? double ?? 1) as RateColumn;
  } else if (paxPerRoom === 2) {
    column = (double ?? single ?? 1) as RateColumn;
  } else {
    // Three or more per room: the triple column ONLY when a label names one.
    // Otherwise the double column plus the hotel's own extra-person charge —
    // and if that charge is missing or implausible the row is blocked, never
    // quoted at the double rate for three heads.
    if (triple) { column = triple as RateColumn; baseOccupancy = 3; }
    else column = (double ?? single ?? 1) as RateColumn;
  }

  return [columnRow({
    hotel, room, key: k(`C${column}`), column,
    planLabel: room.axisLabels[column - 1] || undefined,
    baseOccupancy, explicitSupplement,
  }, i, paxPerRoom)];
}

// ── meal-plan axis ───────────────────────────────────────────────────────
//
// Both columns are the same room on the same dates at two different plans, so
// both are emitted as priced rows carrying the sheet's own plan label. Same
// reasoning as rajarshiWall.ts: an agent should never have to toggle a control
// to discover the other plan exists.

function mealPlanRows(hotel: InlandHotel, room: InlandRoom, ri: number, i: InlandWallInput, paxPerRoom: number): WallRoomRow[] {
  const k = (suffix: string) => `${hotel.id}::${ri}::${suffix}`;
  const cols: RateColumn[] = hasColumn2(room) ? [1, 2] : [1];
  return cols.map(c => columnRow({
    hotel, room, key: k(`C${c}`), column: c,
    planLabel: room.axisLabels[c - 1] || undefined,
    baseOccupancy: BASE_OCCUPANCY,
  }, i, paxPerRoom));
}

// ── weekday / weekend axis ───────────────────────────────────────────────

// The weekend day set, read from the sheet's own words. Returns null when the
// labels never name a day — 56 rooms print a bare 'WEEKDAYS | WEEKENDS', and
// Fri–Sun is NOT a safe default: six other hotels in the same sheet print
// Fri–Sat, so assuming would misprice a Sunday night at 22 properties.
//
// Column 2's own range wins when it names days; otherwise the weekday range on
// column 1 defines the complement. Every room in the data where both are
// printed agrees, and the verifier asserts that.
function weekendDays(room: InlandRoom): Set<number> | null {
  const l1 = (room.axisLabels[0] || '').toLowerCase();
  const l2 = (room.axisLabels[1] || '').toLowerCase();

  if (/fri/.test(l2)) {
    if (/sun/.test(l2)) return new Set([5, 6, 0]);   // Fri, Sat, Sun
    if (/sat/.test(l2)) return new Set([5, 6]);      // Fri, Sat
  }
  // 'Weekday (Mon to Thu)' → weekend is Fri–Sun. 'WEEKDAY(Sun-Thu)' and its
  // 'SUN-THRU' spelling → weekend is Fri, Sat.
  if (/(thu|thru)/.test(l1)) {
    if (/\bmon\b|\(mon/.test(l1)) return new Set([5, 6, 0]);
    if (/sun/.test(l1)) return new Set([5, 6]);
  }
  return null;
}

const isSameRate = (room: InlandRoom): boolean =>
  /same\s*rate/i.test(`${room.axisLabels[0] || ''} ${room.axisLabels[1] || ''}`);

function weekdayWeekendRows(hotel: InlandHotel, room: InlandRoom, ri: number, i: InlandWallInput, paxPerRoom: number): WallRoomRow[] {
  const k = (suffix: string) => `${hotel.id}::${ri}::${suffix}`;

  // 'WEEKDAYS / WEEKENDS Same Rate' — one figure covering every night. Nothing
  // to split, so a second row and a 'Your dates' row would both be the same
  // number printed three times.
  if (isSameRate(room)) {
    return [columnRow({
      hotel, room, key: k('C1'), column: 1,
      planLabel: room.axisLabels[0] || undefined, baseOccupancy: BASE_OCCUPANCY,
    }, i, paxPerRoom)];
  }

  const cols: RateColumn[] = hasColumn2(room) ? [1, 2] : [1];
  const rows: WallRoomRow[] = cols.map(c => columnRow({
    hotel, room, key: k(`C${c}`), column: c,
    planLabel: room.axisLabels[c - 1] || undefined,
    baseOccupancy: BASE_OCCUPANCY,
  }, i, paxPerRoom));

  const weekend = weekendDays(room);
  if (!weekend || cols.length < 2) return rows;

  // The actual stay, night by night. This is the one place quoteInlandStay's
  // shape does not fit — it charges one rate for every night — so the net is
  // summed from the room's own two printed figures and the markup rule of
  // inlandRates.ts is applied unchanged.
  let weekendNights = 0;
  for (let n = 0; n < i.nights; n++) if (weekend.has(weekdayOfNight(i.checkIn, n))) weekendNights++;
  const weekdayNights = i.nights - weekendNights;

  const base = { key: k('DATES'), roomName: displayRoomName(room), planLabel: 'Your dates' };

  // Block only when a bucket the stay ACTUALLY occupies has no printed rate.
  //
  // This deliberately does NOT block when the unpriced column is one the stay
  // never touches: a single Tuesday night does not become unquotable because
  // the hotel never printed a weekend figure — that column is not part of this
  // stay, and there is nothing for the agent to ring up about. 60 of the 159
  // weekday/weekend rooms print exactly one of the two columns, MORE than the
  // 58 that print both, so refusing all of them cost more quotes than it ever
  // protected.
  const weekdayOk = !room.onRequest1 && room.rate1 != null;
  const weekendOk = !room.onRequest2 && room.rate2 != null;
  if ((weekdayNights > 0 && !weekdayOk) || (weekendNights > 0 && !weekendOk)) {
    return [...rows, { ...base, quotable: false, blockedReason: ON_REQUEST }];
  }

  // A bucket with no nights contributes nothing, so its (possibly absent) rate
  // is never read — guarding here keeps a null out of the arithmetic entirely
  // rather than relying on a multiply-by-zero.
  const weekdayRate = weekdayNights > 0 ? (room.rate1 as number) : 0;
  const weekendRate = weekendNights > 0 ? (room.rate2 as number) : 0;
  const netRoomTotal = (weekdayRate * weekdayNights + weekendRate * weekendNights) * i.rooms;
  const derivedNote = `${weekdayNights} weekday + ${weekendNights} weekend night(s)`;

  // The supplement is compared against the cheapest rate the stay actually
  // uses, not against an absent column.
  const usedRates = [weekdayNights > 0 ? weekdayRate : null, weekendNights > 0 ? weekendRate : null]
    .filter((r): r is number => r != null);
  const extra = extraPersonTotal(
    room, paxPerRoom, BASE_OCCUPANCY,
    usedRates.length ? Math.min(...usedRates) : 0, null, i,
  );
  if (isExtraBlocked(extra)) {
    return [...rows, { ...base, derivedNote, quotable: false, blockedReason: extra.reason }];
  }

  const m = money(netRoomTotal, extra.total, markupFor(netRoomTotal, i), i);
  if (!m) return [...rows, { ...base, derivedNote, quotable: false, blockedReason: ON_REQUEST }];
  if (extra.uncovered > 0) {
    return [...rows, {
      ...base, quotable: true, ...m,
      clientNote: coverageNote(BASE_OCCUPANCY),
      derivedNote: joinNotes(derivedNote, coverageProvenance(extra.uncovered)),
    }];
  }
  return [...rows, { ...base, derivedNote, quotable: true, ...m }];
}

// ── season axis ──────────────────────────────────────────────────────────
//
// The two columns are printed half-years. Ten of the twelve label pairs split
// Apr–Sep / Oct–Mar, but four hotels do NOT: Lords Inn Somnath breaks at
// Aug/Sep, and three Rann/Gir properties print festival month lists
// ('Nov & Feb' vs 'Dec & Jan'). So the month split is read from each label
// rather than assumed — assuming would put a September Lords Inn stay on the
// summer rate the sheet does not offer.

const MONTHS: [RegExp, number][] = [
  [/jan/, 1], [/feb/, 2], [/mar/, 3], [/apr/, 4], [/may/, 5], [/jun/, 6],
  [/jul/, 7], [/aug/, 8], [/sep/, 9], [/oct/, 10], [/nov/, 11], [/dec/, 12],
];

// The sheet's contract year runs April → March, so an open-ended 'Rate till
// Sep 2026' in column 1 starts in April.
const SEASON_START_MONTH = 4;

function monthTokens(label: string): { month: number; at: number }[] {
  const s = label.toLowerCase();
  const out: { month: number; at: number }[] = [];
  for (const [re, m] of MONTHS) {
    let from = 0;
    for (;;) {
      const at = s.slice(from).search(re);
      if (at < 0) break;
      out.push({ month: m, at: from + at });
      from = from + at + 3;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// Inclusive, wrapping: (10, 3) → Oct, Nov, Dec, Jan, Feb, Mar.
function monthRange(from: number, to: number): Set<number> {
  const out = new Set<number>();
  for (let m = from, guard = 0; guard < 12; guard++) {
    out.add(m);
    if (m === to) break;
    m = m === 12 ? 1 : m + 1;
  }
  return out;
}

// Returns the months a printed period covers, or null when the text names no
// month at all. `openStart` supplies the start for an open-ended 'till X'.
function seasonMonths(label: string | undefined, openStart: number | null): Set<number> | null {
  if (!label) return null;
  const s = label.toLowerCase();
  const toks = monthTokens(s);
  if (toks.length === 0) return null;

  if (toks.length >= 2) {
    const between = s.slice(toks[0].at + 3, toks[1].at);
    // 'Oct to Mar', 'Oct - Mar', 'Oct till Mar', '1 April to 30 Sep' are ranges;
    // 'Nov 24 & Feb 25' and 'Oct / Nov / Feb / Mar' are literal lists.
    if (/\b(to|till|until|thru|through)\b|[-–—]/.test(between)) {
      return monthRange(toks[0].month, toks[toks.length - 1].month);
    }
    return new Set(toks.map(t => t.month));
  }

  // A single month with a leading 'till' is open-ended on the left.
  if (/\b(till|until|upto|up to)\b/.test(s.slice(0, toks[0].at))) {
    if (openStart == null) return null;
    return monthRange(openStart, toks[0].month);
  }
  return new Set([toks[0].month]);
}

interface SeasonPick {
  column: RateColumn | null;   // null when the labels do not decide it
  labels: [string | undefined, string | undefined];
}

function pickSeasonColumn(room: InlandRoom, checkIn: string): SeasonPick {
  const month = Number(checkIn.slice(5, 7));
  const labels = room.axisLabels;

  const s1 = seasonMonths(labels[0], SEASON_START_MONTH);
  // Column 2's open-ended 'Rate till Mar 2027' means "from where column 1
  // stopped" — the sheet never restates the start. Walk the contract year from
  // April to find column 1's last covered month; column 2 begins after it.
  let openStart2: number | null = null;
  if (s1 && s1.size < 12) {
    let last: number | null = null;
    for (let x = SEASON_START_MONTH, g = 0; g < 12; g++, x = x === 12 ? 1 : x + 1) if (s1.has(x)) last = x;
    if (last != null) openStart2 = last === 12 ? 1 : last + 1;
  }
  const s2 = hasColumn2(room) ? seasonMonths(labels[1], openStart2) : null;

  const in1 = s1 ? s1.has(month) : false;
  const in2 = s2 ? s2.has(month) : false;
  if (in1 && !in2) return { column: 1, labels };
  if (in2 && !in1) return { column: 2, labels };
  return { column: null, labels };
}

function seasonRows(hotel: InlandHotel, room: InlandRoom, ri: number, i: InlandWallInput, paxPerRoom: number): { rows: WallRoomRow[]; resolved: boolean } {
  const k = (suffix: string) => `${hotel.id}::${ri}::${suffix}`;
  const pick = pickSeasonColumn(room, i.checkIn);

  if (pick.column) {
    return {
      rows: [columnRow({
        hotel, room, key: k(`C${pick.column}`), column: pick.column,
        planLabel: room.axisLabels[pick.column - 1] || undefined,
        baseOccupancy: BASE_OCCUPANCY,
      }, i, paxPerRoom)],
      resolved: true,
    };
  }

  // The printed periods do not decide it (they overlap, they cover no month
  // matching these dates, or they name none at all). Show both with the
  // sheet's own wording and let the entry go amber.
  const cols: RateColumn[] = hasColumn2(room) ? [1, 2] : [1];
  return {
    rows: cols.map(c => columnRow({
      hotel, room, key: k(`C${c}`), column: c,
      planLabel: room.axisLabels[c - 1] || undefined,
      baseOccupancy: BASE_OCCUPANCY,
    }, i, paxPerRoom)),
    resolved: false,
  };
}

// ── festive / blackout wording ───────────────────────────────────────────
//
// Shown verbatim, rupee figures and all — this is the agent's view, and the
// supplier's exact supplement wording is the useful part. formatClientExport
// sanitises it separately and never prints this field to a customer.
const FESTIVE_RE = /festiv|black\s*-?\s*out|blackout|peak|diwali|christmas|new\s*year|janmash|janmast|holi\b|uttrayan|navratri|long\s*weekend|supplement/i;

function festiveOf(hotel: InlandHotel): string | undefined {
  const parts = [hotel.headerNote, hotel.remark]
    .filter((t): t is string => !!t && FESTIVE_RE.test(t));
  return parts.length ? parts.join(' · ') : undefined;
}

// ── the wall ─────────────────────────────────────────────────────────────

export function inlandCities(): string[] {
  return Object.keys(hotelsByCity()).sort((a, b) => a.localeCompare(b));
}

export function buildInlandWall(input: InlandWallInput): WallEntry[] {
  const byCity = hotelsByCity();
  const hotels = input.city === 'ALL'
    ? Object.values(byCity).flat()
    : (byCity[input.city] || []);

  const paxPerRoom = Math.ceil(Math.max(1, input.pax) / Math.max(1, input.rooms));
  const half = suggestSeason(input.checkIn);   // 'H1' = Apr-Sep, 'H2' = Oct-Mar

  return hotels.map(hotel => {
    const festiveFlag = festiveOf(hotel);

    // Whole-hotel ON CALL: the sheet prints no room list at all. One blocked
    // row so the card says why rather than rendering an empty hotel.
    if (hotel.isOnCallOnly) {
      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        starLabel: hotel.starRating,
        resolutionChip: 'rates on call',
        resolutionOk: false,
        inclusions: 'GST included',
        festiveFlag,
        reviewNotes: hotel.needsReview,
        rows: [{ key: `${hotel.id}::oncall`, roomName: 'All rooms', quotable: false, blockedReason: ON_REQUEST }],
        cheapestSelling: null,
      } as WallEntry;
    }

    const axes = new Set<string>();
    let anyUnresolved = false;
    const rows: WallRoomRow[] = [];

    hotel.rooms.forEach((room, ri) => {
      // A hotel printed as two half-year blocks tags each room H1/H2. Only the
      // half containing the check-in belongs on the wall; showing both would
      // put two prices for the same room side by side with no way to tell
      // which one these dates buy.
      if (room.season != null && room.season !== half) return;

      axes.add(room.axisType);

      switch (room.axisType) {
        case 'occupancy':
          rows.push(...occupancyRows(hotel, room, ri, input, paxPerRoom));
          break;
        case 'meal_plan':
          rows.push(...mealPlanRows(hotel, room, ri, input, paxPerRoom));
          break;
        case 'weekday_weekend': {
          rows.push(...weekdayWeekendRows(hotel, room, ri, input, paxPerRoom));
          if (!isSameRate(room) && !weekendDays(room)) anyUnresolved = true;
          break;
        }
        case 'season': {
          const out = seasonRows(hotel, room, ri, input, paxPerRoom);
          rows.push(...out.rows);
          if (!out.resolved) anyUnresolved = true;
          break;
        }
        default:
          // 'unknown' (5 rooms) and anything a future transcription adds: the
          // sheet gives no axis, so there is no defensible column to charge.
          // Three of these rooms DO carry a printed figure — we still refuse
          // it, because we cannot say what it is the rate for.
          rows.push({
            key: `${hotel.id}::${ri}::C1`, roomName: displayRoomName(room),
            quotable: false, blockedReason: ON_REQUEST,
          });
          anyUnresolved = true;
          break;
      }
    });

    // The chip answers "why this rate". It names the axis the sheet actually
    // printed, because that is the thing the agent has to sanity-check.
    const chips: string[] = [];
    if (axes.has('occupancy')) chips.push(`${paxPerRoom} pax/room rate`);
    if (axes.has('meal_plan')) chips.push('both meal plans priced');
    if (axes.has('weekday_weekend')) {
      chips.push(anyUnresolved ? 'weekend days not printed — pick a rate' : 'weekday/weekend split by your dates');
    }
    if (axes.has('season')) chips.push(anyUnresolved ? 'season period unclear — pick a rate' : 'season from check-in month');
    if (axes.has('unknown')) chips.push('no rate basis printed');

    // A price that does not cover the whole party is a resolution failure of
    // its own kind: the figure is right, the party it is quoted for is not.
    // Read off the rows rather than tracked separately, so the flag and the
    // caveat can never disagree.
    const uncovered = rows.some(r => !!r.clientNote);
    if (uncovered) chips.push(`extra bed not printed for ${paxPerRoom} pax`);

    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      starLabel: hotel.starRating,
      resolutionChip: chips.length ? chips.join(' · ') : 'no rates printed',
      resolutionOk: !anyUnresolved && !uncovered && rows.length > 0,
      inclusions: 'GST included',
      festiveFlag,
      reviewNotes: hotel.needsReview,
      rows,
      // Derived by the shared layer, never re-implemented here, so banding
      // cannot drift from the cheapest figure the card renders.
      cheapestSelling: cheapestQuotable(rows),
    } as WallEntry;
  });
}
