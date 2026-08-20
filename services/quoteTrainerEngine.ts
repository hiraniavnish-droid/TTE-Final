// ============================================================
// Quotation Trainer — question generation and grading.
//
// The whole point is that the trainee never sees a hotel name or a rate: a
// question is a customer enquiry (dates, party size, budget, sightseeing
// wishlist), exactly what a real lead looks like. The trainee has to go
// find the right hotels themselves (the real Rate Wall, the rate sheet,
// wherever they'd normally look), price them by hand, and type the numbers
// in here to be graded. So the ANSWER KEY has to come from the same
// resolver the real app uses — buildInlandWall() — never a hand-typed
// number, or a bug in this file could silently teach the wrong price.
//
// A real agent shortlists 3-4 hotels for a client rather than picking one —
// "here's a cheaper one, here's a nicer one" — so each question PRE-NAMES
// 3-4 hotels (the system's choice, not the trainee's) and states the plan
// to quote for each. Every line is priced at MAP (breakfast + dinner) —
// the standard package this agency actually sells — off whichever room at
// that hotel is cheapest for MAP (the room itself is resolved internally
// and never shown; asking the trainee to also identify the exact room name
// would be testing sheet-reading trivia, not quotation judgement).
//
// No discount round: stacking 'apply X% markup, THEN take off a further Y%'
// turned out to be the single biggest source of near-miss errors in
// practice — trainees would price correctly against a DIFFERENT markup %
// than the one actually stated, or forget the second step entirely. One
// clean number per hotel (net -> standard markup -> done) tests the same
// skill without the extra arithmetic step that was producing errors that
// had nothing to do with hotel-pricing knowledge.
// ============================================================

import { buildInlandWall } from './inlandWall';
import { isQuotable, type WallEntry } from './rateWall';

const CITY = 'KEVADIYA (Ekta Nagar)';

// Real spots around the Statue of Unity / Kevadiya circuit — flavour text
// for the brief only, never scored. A genuine enquiry names some of these,
// so leaving them out would make the practice brief read like a lab
// exercise instead of a real lead.
const SIGHTSEEING_SPOTS = [
  'Statue of Unity viewing gallery', 'Valley of Flowers', 'Sardar Sarovar Dam viewpoint',
  'Zarwani Waterfall', 'Cactus Garden', 'Butterfly Garden', 'Ekta Nursery',
  'Jungle Safari Park', 'Aarogya Van', 'Vishwa Van', 'Ekta Mall', 'Laser Show at SOU',
  'Shoolpaneshwar Wildlife Sanctuary', 'Garudeshwar boating', 'Sardar Sarovar boat ride',
];

// Kept narrow on purpose: near-future dates only, small nights/pax range —
// wide enough to vary the drill, narrow enough that every generated
// question is a scenario an agent would plausibly actually receive.
const NIGHTS_OPTIONS = [1, 2, 3];
const PAX_OPTIONS = [2, 3, 4, 5, 6];
const MARKUP_OPTIONS = [12, 15, 18, 20];
// A star-rating floor, when stated, is a real constraint a customer states —
// not a trick — that narrows which hotels are even worth shortlisting.
const MIN_STAR_OPTIONS = [0, 0, 3, 4, 4, 4];
const LINE_ITEM_COUNTS = [3, 3, 4]; // "3 to 4 hotels" per question

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleSpots(n: number): string[] {
  const pool = [...SIGHTSEEING_SPOTS];
  const out: string[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 'starLabel' is free text off the sheet ('4 Star', '4 Star – New Property').
// Only the leading number is a star rating; anything unparsed is treated as
// unrated, which fails any stated minimum rather than guessing it qualifies.
function starOf(label: string | undefined): number {
  const m = /^(\d+)\s*star/i.exec((label || '').trim());
  return m ? Number(m[1]) : 0;
}

// Every planLabel this city's rooms carry either names the plan directly
// (CPAI/CAPI, MAPAI) or is an axis label (WEEKDAYS, 'Your dates', a season
// range) that inlandWall.ts only ever attaches a '(MAP)' suffix to when the
// derived dinner supplement applies — so 'contains MAP' cleanly identifies
// a MAP-plan row without needing to see the printed label's exact
// vocabulary. Kevadiya prints no all-inclusive (APAI) rooms.
const isMapPlanLabel = (planLabel: string | undefined): boolean => /map/i.test(planLabel || '');

// One hotel's MAP-plan quote — priced off whichever room of that hotel is
// cheapest for MAP. The room itself is resolved internally and never
// surfaced to the trainee.
export interface LineItem {
  hotelName: string;
  sellingTotal: number;
  netTotal: number;
  markupAmount: number;
}

export interface TrainerQuestion {
  id: string;
  checkIn: string;
  nights: number;
  pax: number;
  rooms: number;
  budgetPerPerson: number;   // a STARTING POINT the client quoted, not a cutoff — the shortlist runs both above and below it
  markupPercent: number;
  minStarRating: number;   // 0 = no preference stated
  sightseeing: string[];
  lineItems: LineItem[];   // 3-4 pre-named hotels, each already assigned MAP — the trainee prices every one
}

const MAX_ATTEMPTS = 20;

function tryGenerate(id: string): TrainerQuestion | null {
  const checkIn = addDays(new Date().toISOString().slice(0, 10), 3 + Math.floor(Math.random() * 90));
  const nights = pick(NIGHTS_OPTIONS);
  const pax = pick(PAX_OPTIONS);
  const rooms = Math.max(1, Math.ceil(pax / 2));
  const markupPercent = pick(MARKUP_OPTIONS);
  const minStarRating = pick(MIN_STAR_OPTIONS);

  const entries: WallEntry[] = buildInlandWall({
    city: CITY, checkIn, nights, rooms, pax,
    markupMode: 'percent', markupValue: markupPercent,
  });

  // hotelName -> its cheapest quotable MAP-plan row.
  const mapByHotel = new Map<string, LineItem>();
  for (const e of entries) {
    if (minStarRating > 0 && starOf(e.starLabel) < minStarRating) continue;
    for (const row of e.rows) {
      if (!isQuotable(row) || !isMapPlanLabel(row.planLabel)) continue;
      const existing = mapByHotel.get(e.hotelName);
      if (!existing || row.sellingTotal < existing.sellingTotal) {
        const netTotal = Math.round(row.sellingTotal / (1 + markupPercent / 100));
        mapByHotel.set(e.hotelName, {
          hotelName: e.hotelName, sellingTotal: row.sellingTotal,
          netTotal, markupAmount: row.sellingTotal - netTotal,
        });
      }
    }
  }
  const allMap = Array.from(mapByHotel.values());
  const wantCount = pick(LINE_ITEM_COUNTS);
  if (allMap.length < wantCount) return null;

  const lineItems = shuffled(allMap).slice(0, wantCount).sort((a, b) => a.sellingTotal - b.sellingTotal);

  // A tentative anchor for the brief — roughly the middle of this specific
  // shortlist, so it genuinely runs both above and below the stated figure.
  const median = lineItems[Math.floor(lineItems.length / 2)];
  const budgetPerPerson = Math.round(median.sellingTotal / pax / 100) * 100;

  return {
    id, checkIn, nights, pax, rooms, budgetPerPerson, markupPercent, minStarRating,
    sightseeing: sampleSpots(3 + Math.floor(Math.random() * 3)),
    lineItems,
  };
}

export function generateQuestion(id: string): TrainerQuestion {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const q = tryGenerate(id);
    if (q) return q;
  }
  // Every attempt landed on a scenario with fewer than 3 hotels quotable at
  // MAP (astronomically unlikely with 10 hotels and this pax/date spread) —
  // surface it rather than loop forever or hand back a broken question.
  throw new Error('Could not generate a well-posed question after ' + MAX_ATTEMPTS + ' attempts');
}

// ── grading ──────────────────────────────────────────────────────────────
//
// The hotel and its plan are given by the question, not the trainee's
// choice — every line is graded purely on whether the two money fields
// match what that specific hotel actually prices to.

export interface SubmittedLine {
  hotelName: string;
  sellingPerPerson: number;
  totalMargin: number;
}

export interface FieldResult { correct: boolean; expected: number | string; got: number | string }

export interface LineGrade {
  hotelName: string;
  perPerson: FieldResult;
  margin: FieldResult;
  allCorrect: boolean;
}

export interface GradeResult {
  allCorrect: boolean;
  lines: LineGrade[];
}

// ±₹10 or ±0.1%, whichever is more forgiving — a flat ₹10 band would be
// unreasonably tight on a ₹50,000 quote, and a pure 0.1% would be unusably
// tight on a ₹1,000 one.
function withinTolerance(expected: number, got: number): boolean {
  if (!Number.isFinite(got)) return false;
  const tolerance = Math.max(10, Math.abs(expected) * 0.001);
  return Math.abs(expected - got) <= tolerance;
}

function numField(expected: number, got: number): FieldResult {
  return { correct: withinTolerance(expected, got), expected, got };
}

export function gradeAnswer(q: TrainerQuestion, submitted: SubmittedLine[]): GradeResult {
  const lines: LineGrade[] = q.lineItems.map(li => {
    const sub = submitted.find(s => s.hotelName === li.hotelName);
    const expectedPerPerson = Math.round(li.sellingTotal / q.pax);
    const perPerson = numField(expectedPerPerson, sub ? sub.sellingPerPerson : NaN);
    const margin = numField(li.markupAmount, sub ? sub.totalMargin : NaN);
    return { hotelName: li.hotelName, perPerson, margin, allCorrect: perPerson.correct && margin.correct };
  });
  return { allCorrect: lines.every(l => l.allCorrect), lines };
}
