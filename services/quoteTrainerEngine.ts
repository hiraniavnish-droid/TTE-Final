// ============================================================
// Quotation Trainer — question generation and grading.
//
// The whole point is that the trainee never sees a hotel name or a rate: a
// question is a customer enquiry (dates, party size, budget, wishlist of
// sightseeing spots), exactly what a real lead looks like. The trainee has
// to go find the right hotel themselves (in the real Rate Wall, the rate
// sheet, wherever they'd normally look), price it, and type the numbers in
// here to be graded. So the ANSWER KEY has to come from the same resolver
// the real app uses — buildInlandWall() — never a hand-typed number, or a
// bug in this file could silently teach the wrong price.
//
// The stated budget is a STARTING POINT, not a cutoff — a real agent quotes
// a spread of 3-4 hotels around it, some pricier, some cheaper, and lets the
// client choose. So there is no single "correct" hotel or meal plan here:
// the trainee picks whichever they'd actually suggest, and grading checks
// only whether the price they typed is right FOR THE COMBINATION THEY
// PICKED — priced off whichever of that hotel's rooms is cheapest for that
// plan (the room itself is resolved internally and never shown; asking the
// trainee to also identify the exact room name would be testing
// sheet-reading trivia, not quotation judgement).
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
const DISCOUNT_OPTIONS = [0, 0, 0, 5, 10]; // ~40% of questions carry a discount round
// A star-rating floor, when stated, is a real constraint a customer states —
// not a trick — that narrows which hotels are even worth shortlisting.
const MIN_STAR_OPTIONS = [0, 0, 3, 4, 4, 4];

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

// 'starLabel' is free text off the sheet ('4 Star', '4 Star – New Property').
// Only the leading number is a star rating; anything unparsed is treated as
// unrated, which fails any stated minimum rather than guessing it qualifies.
function starOf(label: string | undefined): number {
  const m = /^(\d+)\s*star/i.exec((label || '').trim());
  return m ? Number(m[1]) : 0;
}

export type MealPlan = 'breakfast' | 'breakfast_dinner';

// Every planLabel this city's rooms carry either names the plan directly
// (CPAI/CAPI, MAPAI) or is an axis label (WEEKDAYS, 'Your dates', a season
// range) that inlandWall.ts only ever attaches a '(MAP)' suffix to when the
// derived dinner supplement applies — so 'contains MAP' cleanly separates
// the two without needing to see the printed label's exact vocabulary.
// Kevadiya prints no all-inclusive (APAI) rooms, so these are the only two.
function mealPlanOf(planLabel: string | undefined): MealPlan {
  return /map/i.test(planLabel || '') ? 'breakfast_dinner' : 'breakfast';
}

export const MEAL_PLAN_LABEL: Record<MealPlan, string> = {
  breakfast: 'Breakfast only',
  breakfast_dinner: 'Breakfast + Dinner',
};

// One (hotel, meal plan) combination — priced off whichever ROOM of that
// hotel is cheapest for that plan, BEFORE any discount. The room itself is
// resolved internally and never surfaced; the trainee only ever sees the
// hotel and the plan.
export interface HotelPlanOption {
  hotelName: string;
  mealPlan: MealPlan;
  sellingTotal: number;    // net + markup, pre-discount
  netTotal: number;
  markupAmount: number;
}

export interface TrainerQuestion {
  id: string;
  checkIn: string;
  nights: number;
  pax: number;
  rooms: number;
  budgetPerPerson: number;   // a STARTING POINT the client quoted, not a cutoff — real options run both above and below it
  markupPercent: number;
  discountPercent: number;
  minStarRating: number;   // 0 = no preference stated
  sightseeing: string[];
  hotelOptions: string[];              // distinct hotel names on offer — the hotel dropdown's contents
  plansByHotel: Record<string, HotelPlanOption[]>;  // filled in once a hotel is picked, for the plan dropdown
}

const MIN_COMBOS = 3; // need a genuine shortlist to pick from, not just one hotel
const MAX_ATTEMPTS = 20;

function tryGenerate(id: string): TrainerQuestion | null {
  const checkIn = addDays(new Date().toISOString().slice(0, 10), 3 + Math.floor(Math.random() * 90));
  const nights = pick(NIGHTS_OPTIONS);
  const pax = pick(PAX_OPTIONS);
  const rooms = Math.max(1, Math.ceil(pax / 2));
  const markupPercent = pick(MARKUP_OPTIONS);
  const discountPercent = pick(DISCOUNT_OPTIONS);
  const minStarRating = pick(MIN_STAR_OPTIONS);

  const entries: WallEntry[] = buildInlandWall({
    city: CITY, checkIn, nights, rooms, pax,
    markupMode: 'percent', markupValue: markupPercent,
  });

  // (hotelName, mealPlan) -> cheapest room's priced row for that combination.
  const combos = new Map<string, HotelPlanOption>();
  for (const e of entries) {
    if (minStarRating > 0 && starOf(e.starLabel) < minStarRating) continue;
    for (const row of e.rows) {
      if (!isQuotable(row)) continue;
      const mealPlan = mealPlanOf(row.planLabel);
      const key = `${e.hotelName}::${mealPlan}`;
      const existing = combos.get(key);
      if (!existing || row.sellingTotal < existing.sellingTotal) {
        const netTotal = Math.round(row.sellingTotal / (1 + markupPercent / 100));
        combos.set(key, {
          hotelName: e.hotelName, mealPlan, sellingTotal: row.sellingTotal,
          netTotal, markupAmount: row.sellingTotal - netTotal,
        });
      }
    }
  }
  const allCombos = Array.from(combos.values());
  if (allCombos.length < MIN_COMBOS) return null;

  // A tentative anchor for the brief — roughly the middle of what's on
  // offer, so a sensible shortlist genuinely runs both above and below it.
  // No property is required to sit at or under this figure.
  const sorted = allCombos.slice().sort((a, b) => a.sellingTotal - b.sellingTotal);
  const median = sorted[Math.floor(sorted.length / 2)];
  const budgetPerPerson = Math.round(median.sellingTotal / pax / 100) * 100;

  const hotelOptions = Array.from(new Set(allCombos.map(c => c.hotelName)));
  const plansByHotel: Record<string, HotelPlanOption[]> = {};
  for (const c of allCombos) {
    (plansByHotel[c.hotelName] ||= []).push(c);
  }

  return {
    id, checkIn, nights, pax, rooms, budgetPerPerson, markupPercent, discountPercent, minStarRating,
    sightseeing: sampleSpots(3 + Math.floor(Math.random() * 3)),
    hotelOptions, plansByHotel,
  };
}

export function generateQuestion(id: string): TrainerQuestion {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const q = tryGenerate(id);
    if (q) return q;
  }
  // Every attempt landed on a scenario with fewer than 3 quotable
  // combinations (astronomically unlikely with 10 hotels and this pax/date
  // spread) — surface it rather than loop forever or hand back a broken
  // question.
  throw new Error('Could not generate a well-posed question after ' + MAX_ATTEMPTS + ' attempts');
}

// ── grading ──────────────────────────────────────────────────────────────
//
// Hotel and meal plan are the trainee's own call — any real, on-offer
// combination is a valid recommendation, so those two fields only check
// that a genuine (hotel, plan) pair was picked at all, not that it matches
// some single "right" answer. The two money fields are graded against
// whatever THAT combination actually prices to, discount included.

export interface SubmittedAnswer {
  hotelName: string;
  mealPlan: MealPlan | '';
  sellingPerPerson: number;
  totalMargin: number;
}

export interface FieldResult { correct: boolean; expected: number | string; got: number | string }

export interface GradeResult {
  allCorrect: boolean;
  hotel: FieldResult;
  mealPlan: FieldResult;
  perPerson: FieldResult;
  margin: FieldResult;
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

export function gradeAnswer(q: TrainerQuestion, submitted: SubmittedAnswer): GradeResult {
  const hotelValid = !!submitted.hotelName && q.hotelOptions.includes(submitted.hotelName);
  const hotel: FieldResult = {
    correct: hotelValid,
    expected: '(any hotel you can justify)',
    got: submitted.hotelName || '(none selected)',
  };

  const combo = hotelValid
    ? (q.plansByHotel[submitted.hotelName] || []).find(p => p.mealPlan === submitted.mealPlan)
    : undefined;
  const mealPlan: FieldResult = {
    correct: !!combo,
    expected: hotelValid ? '(any plan that hotel offers)' : '(pick a hotel first)',
    got: submitted.mealPlan ? MEAL_PLAN_LABEL[submitted.mealPlan] : '(none selected)',
  };

  if (!combo) {
    const blocked: FieldResult = { correct: false, expected: '(pick a valid hotel + plan first)', got: submitted.sellingPerPerson };
    return { allCorrect: false, hotel, mealPlan, perPerson: blocked, margin: { ...blocked, got: submitted.totalMargin } };
  }

  const discountAmount = Math.round(combo.sellingTotal * q.discountPercent / 100);
  const expectedPerPerson = Math.round((combo.sellingTotal - discountAmount) / q.pax);
  const expectedMargin = combo.markupAmount - discountAmount;

  const perPerson = numField(expectedPerPerson, submitted.sellingPerPerson);
  const margin = numField(expectedMargin, submitted.totalMargin);
  return {
    allCorrect: hotel.correct && mealPlan.correct && perPerson.correct && margin.correct,
    hotel, mealPlan, perPerson, margin,
  };
}
