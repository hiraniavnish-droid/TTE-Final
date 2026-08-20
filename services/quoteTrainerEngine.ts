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

export interface TrainerOption {
  label: string;   // shown in the dropdown, e.g. 'Villa Euphoria Resort — Euphoria Premium ( DBL) · CPAI'
  hotelName: string;
  roomName: string;
  planLabel?: string;
  sellingTotal: number;
}

export interface TrainerAnswer {
  hotelName: string;
  roomName: string;
  planLabel?: string;
  netTotal: number;
  markupAmount: number;
  discountAmount: number;
  sellingTotal: number;
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
  options: TrainerOption[];   // every genuinely quotable choice for this scenario — the dropdown's contents
  answer: TrainerAnswer;      // the cheapest of `options`, fully priced — the answer key
}

// A tie at the top makes "the" correct hotel ambiguous, which would grade a
// perfectly reasonable second-cheapest pick as wrong. Re-roll rather than
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

  const options: TrainerOption[] = [];
  for (const e of entries) {
    if (minStarRating > 0 && starOf(e.starLabel) < minStarRating) continue;
    for (const row of e.rows) {
      if (!isQuotable(row)) continue;
      options.push({
        label: `${e.hotelName} — ${row.roomName}${row.planLabel ? ` · ${row.planLabel}` : ''}`,
        hotelName: e.hotelName, roomName: row.roomName, planLabel: row.planLabel,
        sellingTotal: row.sellingTotal,
      });
    }
  }
  if (options.length < 2) return null;

  options.sort((a, b) => a.sellingTotal - b.sellingTotal);
  const cheapest = options[0];
  const runnerUp = options[1];
  if (runnerUp.sellingTotal - cheapest.sellingTotal < TIE_GUARD_RUPEES) return null;

  // Sit the stated budget just above the true cheapest option, so there is
  // exactly one defensible recommendation — not "any hotel under budget".
  const perPersonRaw = cheapest.sellingTotal / pax;
  const budgetPerPerson = Math.ceil((perPersonRaw * 1.05) / 100) * 100;

  const netTotal = Math.round(cheapest.sellingTotal / (1 + markupPercent / 100));
  const markupAmount = cheapest.sellingTotal - netTotal;
  const discountAmount = Math.round(cheapest.sellingTotal * discountPercent / 100);
  const sellingTotal = cheapest.sellingTotal - discountAmount;

  return {
    id, checkIn, nights, pax, rooms, budgetPerPerson, markupPercent, discountPercent, minStarRating,
    sightseeing: sampleSpots(3 + Math.floor(Math.random() * 3)),
    options,
    answer: {
      hotelName: cheapest.hotelName, roomName: cheapest.roomName, planLabel: cheapest.planLabel,
      netTotal, markupAmount, discountAmount, sellingTotal,
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
  hotelChoiceLabel: string;   // the option.label the trainee picked
  netTotal: number;
  markupAmount: number;
  discountAmount: number;
  sellingTotal: number;
}

export interface FieldResult { correct: boolean; expected: number | string; got: number | string }

export interface GradeResult {
  allCorrect: boolean;
  hotel: FieldResult;
  net: FieldResult;
  markup: FieldResult;
  discount: FieldResult;
  total: FieldResult;
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
  const cheapestLabel = q.options.slice().sort((a, b) => a.sellingTotal - b.sellingTotal)[0].label;
  const hotel: FieldResult = {
    correct: submitted.hotelChoiceLabel === cheapestLabel,
    expected: cheapestLabel, got: submitted.hotelChoiceLabel || '(none selected)',
  };
  const net = numField(q.answer.netTotal, submitted.netTotal);
  const markup = numField(q.answer.markupAmount, submitted.markupAmount);
  const discount = numField(q.answer.discountAmount, submitted.discountAmount);
  const total = numField(q.answer.sellingTotal, submitted.sellingTotal);
  return {
    allCorrect: hotel.correct && net.correct && markup.correct && discount.correct && total.correct,
    hotel, net, markup, discount, total,
  };
}
