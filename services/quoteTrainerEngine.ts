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
// The trainee only ever picks a HOTEL and a MEAL PLAN (breakfast, or
// breakfast + dinner) — never a room. A hotel can print half a dozen room
// types; asking the trainee to also identify the exact room name would be
// testing sheet-reading trivia, not quotation judgement. Internally, each
// (hotel, plan) is priced off whichever of that hotel's rooms is cheapest
// for that plan — the trainee is never shown or asked about the room.
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
// not a trick. Without it the cheapest Kevadiya option (a 3-star property)
// wins almost every scenario regardless of dates/pax, since relative pricing
// across these 10 hotels barely moves — so every question would train the
// same one hotel. Filtering by an explicit, printed fact keeps grading
// honest while forcing the trainee to actually know the other properties.
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
// hotel is cheapest for that plan. The room itself is resolved internally
// and never surfaced; the trainee only ever sees the hotel and the plan.
export interface HotelPlanOption {
  hotelName: string;
  mealPlan: MealPlan;
  sellingTotal: number;
  sellingPerPerson: number;
  netTotal: number;
  markupAmount: number;
}

export interface TrainerAnswer {
  hotelName: string;
  mealPlan: MealPlan;
  sellingPerPerson: number;
  totalMargin: number;   // markupAmount minus any requested discount — the actual profit earned
}

export interface TrainerQuestion {
  id: string;
  checkIn: string;
  nights: number;
  pax: number;
  rooms: number;
  budgetPerPerson: number;
  markupPercent: number;
  discountPercent: number;
  minStarRating: number;   // 0 = no preference stated
  sightseeing: string[];
  hotelOptions: string[];              // distinct hotel names on offer — the hotel dropdown's contents
  plansByHotel: Record<string, HotelPlanOption[]>;  // filled in once a hotel is picked, for the plan dropdown
  answer: TrainerAnswer;
}

// A tie at the top makes "the" correct combination ambiguous, which would
// grade a perfectly reasonable runner-up as wrong. Re-roll rather than
// accept a question with no single right answer.
const TIE_GUARD_RUPEES = 50;
const MAX_ATTEMPTS = 30;

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
        combos.set(key, {
          hotelName: e.hotelName, mealPlan, sellingTotal: row.sellingTotal,
          sellingPerPerson: row.sellingTotal / pax,
          netTotal: 0, markupAmount: 0, // filled in below once markup% recompute is known — see note
        });
      }
    }
  }
  const allCombos = Array.from(combos.values());
  if (allCombos.length < 2) return null;

  allCombos.sort((a, b) => a.sellingTotal - b.sellingTotal);
  const cheapest = allCombos[0];
  const runnerUp = allCombos[1];
  if (runnerUp.sellingTotal - cheapest.sellingTotal < TIE_GUARD_RUPEES) return null;

  // Sit the stated budget just above the true cheapest combination, so
  // there is exactly one defensible recommendation — not "anything under
  // budget qualifies".
  const budgetPerPerson = Math.ceil((cheapest.sellingPerPerson * 1.05) / 100) * 100;

  const netTotal = Math.round(cheapest.sellingTotal / (1 + markupPercent / 100));
  const markupAmount = cheapest.sellingTotal - netTotal;
  const discountAmount = Math.round(cheapest.sellingTotal * discountPercent / 100);
  const sellingTotalAfterDiscount = cheapest.sellingTotal - discountAmount;

  // Fill in every combo's own net/markup split (needed for the plan dropdown
  // once the trainee has picked a hotel, so switching plans shows honest
  // numbers rather than staying pinned to the answer key's).
  for (const c of allCombos) {
    const net = Math.round(c.sellingTotal / (1 + markupPercent / 100));
    c.netTotal = net;
    c.markupAmount = c.sellingTotal - net;
  }

  const hotelOptions = Array.from(new Set(allCombos.map(c => c.hotelName)));
  const plansByHotel: Record<string, HotelPlanOption[]> = {};
  for (const c of allCombos) {
    (plansByHotel[c.hotelName] ||= []).push(c);
  }

  return {
    id, checkIn, nights, pax, rooms, budgetPerPerson, markupPercent, discountPercent, minStarRating,
    sightseeing: sampleSpots(3 + Math.floor(Math.random() * 3)),
    hotelOptions, plansByHotel,
    answer: {
      hotelName: cheapest.hotelName, mealPlan: cheapest.mealPlan,
      sellingPerPerson: Math.round(sellingTotalAfterDiscount / pax),
      totalMargin: markupAmount - discountAmount,
    },
  };
}

export function generateQuestion(id: string): TrainerQuestion {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const q = tryGenerate(id);
    if (q) return q;
  }
  // Every attempt hit a tie or a dry scenario (astronomically unlikely with
  // 10 hotels and this pax/date spread) — surface it rather than loop
  // forever or hand back a broken question.
  throw new Error('Could not generate a well-posed question after ' + MAX_ATTEMPTS + ' attempts');
}

// ── grading ──────────────────────────────────────────────────────────────

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
  const hotel: FieldResult = {
    correct: submitted.hotelName === q.answer.hotelName,
    expected: q.answer.hotelName, got: submitted.hotelName || '(none selected)',
  };
  const mealPlan: FieldResult = {
    correct: submitted.mealPlan === q.answer.mealPlan,
    expected: MEAL_PLAN_LABEL[q.answer.mealPlan],
    got: submitted.mealPlan ? MEAL_PLAN_LABEL[submitted.mealPlan] : '(none selected)',
  };
  const perPerson = numField(q.answer.sellingPerPerson, submitted.sellingPerPerson);
  const margin = numField(q.answer.totalMargin, submitted.totalMargin);
  return {
    allCorrect: hotel.correct && mealPlan.correct && perPerson.correct && margin.correct,
    hotel, mealPlan, perPerson, margin,
  };
}
