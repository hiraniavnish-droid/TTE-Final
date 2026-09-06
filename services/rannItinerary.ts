// ============================================================
// Rann Utsav – The Tent City: day-wise itineraries, 2026-27 brochure.
//
// Transcribed verbatim from the printed brochure (pages 5–10). Printed times
// and wording are reproduced EXACTLY, typos included; where the brochure is
// clearly wrong the printed value stays in `time`/`text` and the correction is
// recorded separately in `correctedTime`/`note`. Nothing here may be silently
// "fixed" — an agent quoting from this data must be able to see what the
// client's own brochure says.
//
// Shared days are defined ONCE and referenced:
//   * Day 1 is identical across the 1N, 2N and 3N packages.
//   * The Kala Dungar excursion day is identical between 2N Day 2 and 3N Day 2.
//   * The departure day is shared between 1N Day 2 and 2N Day 3, but the 3N
//     Day 4 page prints a different museum window (11:30–13:30, not 11:30–14:00)
//     and different wording, so that one is a separate block by necessity.
// A rate-sheet update therefore cannot change one copy and miss another.
// ============================================================

export interface ItineraryEntry {
  /** Time exactly as printed in the brochure. */
  time: string;
  /** Activity text exactly as printed in the brochure, typos included. */
  text: string;
  /** Set ONLY where the printed time is a demonstrable misprint. The printed
   *  value stays in `time`; this is the reading the brochure clearly intends. */
  correctedTime?: string;
  /** Brochure footnote, or a flag on something inconsistent in the source. */
  note?: string;
}

export interface ItineraryDay {
  day: number;
  title?: string;
  entries: ItineraryEntry[];
}

export interface Itinerary {
  nights: 1 | 2 | 3;
  days: ItineraryDay[];
}

// ─── Shared day blocks ──────────────────────────────────────

/** p5 / p6 / p8 — printed identically on all three package pages. */
const DAY_1_ENTRIES: ItineraryEntry[] = [
  { time: '12:30 Onwards', text: 'Warm welcome and check-in' },
  {
    time: '12:30 – 14:30',
    text: 'Enjoy a delicious lunch at therespective dining area',
    note: 'Printed "therespective" (missing space) in the brochure.',
  },
  {
    time: '14:30 – 16:30',
    text: 'Leisure time/Indulge in an exciting range of activities at Skyzilla, Club House, Craft Market/Haat, Various Selfie Points, Rejuvenation Center, Art Gallery, Live Demonstration area of Kutch Craft and many others.',
  },
  {
    time: '16:00 – 17:00',
    text: 'High tea at the respective dining area',
    note: 'As printed, this overlaps the 14:30 – 16:30 leisure block.',
  },
  {
    time: '17:00 – 17:30',
    text: 'Visit the Sunset Point and the breathtaking White Rann to witness the grandeur of the setting sun. Transfers will be arranged by bus, camel cart, or a combination of both for a truly memorable experience',
  },
  { time: '19:00 – 19:30', text: 'Return to Rann Utsav - The Tent City, Dhordo' },
  {
    time: '9:30 – 22:00',
    text: 'Enjoy a scrumptious dinner at the respectivedining area',
    correctedTime: '19:30 – 22:00',
    note: 'Brochure prints "9:30 – 22:00". 19:30 is clearly meant — the Day 2/Day 3 dinner rows read "19:30 – 22:00" and the guests only return from the White Rann at 19:30. Printed value kept; do not quote the printed time to a client. Also printed "respectivedining" (missing space).',
  },
  {
    time: '21:00 – 22:30',
    text: 'Enjoy the culture of Kutch along with entertaining activities at the cultural activity area',
  },
];

/** p7 (2 Nights, Day 2) and p9 (3 Nights, Day 2) — printed identically. */
const KALA_DUNGAR_DAY_ENTRIES: ItineraryEntry[] = [
  { time: '06:00 – 06:30', text: 'Morning tea' },
  { time: '06:30 – 07:30', text: 'Experience a rejuvenating yoga session at the dedicated area' },
  {
    time: '06:30 – 07:00',
    text: 'Visit the Sunrise Point to witness the beauty of the rising sun over the serene White Rann. As the first light touches the vast salt desert, it creates a magical and unforgettable experience, highly recommended for morning-light photography',
    note: 'As printed, this runs simultaneously with the 06:30 – 07:30 yoga session.',
  },
  { time: '07:30 – 10:00', text: 'Breakfast at the respective dining area' },
  {
    time: '10:00 – 12:30',
    text: 'Leisure time. Enjoy indoor activities at Skyzilla, Club House, Craft Market/Haat, Curated Content Creation Zones, Rejuvenation Center, Art Gallery, Live Demonstration Area of Kutch Craft and many others',
  },
  { time: '12:30 – 14:30', text: 'Enjoy a delicious lunch at the respective dining area' },
  {
    time: '14:30 – 15:00',
    text: 'Departure for Kala Dungar',
    note: 'The brochure prints "Return to Rann Utsav – The Tent City, Dhordo." alongside this departure row.',
  },
  {
    time: '15:00 – 19:30',
    text: "Enjoy a complimentary tour to Kala Dungar (Black Hill), the highest point of Kutch. En route, immerse yourself in local culture at the handicraft village 'Gandhi Nu Gaam', providing an excellent opportunity for cultural exploration and capturing vibrant artisan stories. Tea/coffee and light refreshments will be served during the journey.",
  },
  { time: '19:30 – 22:00', text: 'Enjoy a scrumptious dinner at the respective dining area' },
  {
    time: '21:00 – 22:30',
    text: 'Enjoy the culture of Kutch along with entertaining activities at the cultural activity area',
  },
];

/** p9 (3 Nights, Day 3) — the Dholavira excursion. 3N package only. */
const DHOLAVIRA_DAY_ENTRIES: ItineraryEntry[] = [
  { time: '06:00 – 06:30', text: 'Morning tea' },
  { time: '06:30 – 07:30', text: 'Experience a rejuvenating yoga session at the dedicated area' },
  { time: '07:30 – 10:00', text: 'Breakfast at the respective dining area' },
  {
    time: '10:00 – 12:30',
    text: 'Leisure time. Enjoy indoor activities at Skyzilla, Club House, Craft Market/Haat, Curated Content Creation Zones, Rejuvenation Center, Art Gallery, Live Demonstration Area of Kutch Craft and many others',
  },
  { time: '12:30 – 13:30', text: 'Enjoy a delicious lunch at the respective dining area' },
  {
    time: '13:30',
    text: 'Depart for Dholavira (Approx. 105 km, around 2 hours travel). Experience the breathtaking Road Through Heaven, a scenic route surrounded by the vast white landscape of Kutch. A prime location for cinematic video content. Tea/coffee and light refreshments will be served during the journey.',
  },
  {
    time: '15:30 – 17:30',
    text: 'Visit the Archaeological Museum and Dholavira Excavation Site. Dholavira is one of the best-preserved cities of the Indus Valley Civilization, dating from the 3rd to the mid-2nd millennium BCE. Discover its remarkable urban planning, sophisticated water management systems, and rich archaeological heritage.',
    note: 'Brochure: "Please note: The museum remains closed every Friday."',
  },
  { time: '17:30 – 18:00', text: 'Tea/coffee and light refreshments will be served during the journey' },
  {
    time: '18:00 – 18:45',
    text: 'Enjoy a breathtaking sunset along the Road Through Heaven. Stretching through the mesmerizing white salt desert, this scenic route offers unforgettable views as the sun paints the horizon with vibrant colours.',
  },
  { time: '19:00 – 20:30', text: 'Return to Rann Utsav – The Tent City, Dhordo' },
  { time: '20:30 – 22:00', text: 'Enjoy a scrumptious dinner at the respective dining area' },
];

/** p5 (1 Night, Day 2) and p7 (2 Nights, Day 3) — printed identically. */
const DEPARTURE_DAY_ENTRIES: ItineraryEntry[] = [
  { time: '06:00 – 06:30', text: 'Morning tea' },
  { time: '06:30 – 07:30', text: 'Experience a rejuvenating yoga session at the dedicated area' },
  { time: '07:30 – 09:30', text: 'Breakfast at the respective dining area' },
  { time: '09:30', text: 'Check out from Rann Utsav Tent City with happy memories' },
  { time: '10:00', text: 'Bus will depart for Bhuj' },
  {
    time: '11:30 – 14:00',
    text: 'Complimentary visit to Swaminarayan Temple and Kutch Museum',
    note: 'Brochure: "Kutch Museum remains closed every Wednesday."',
  },
];

/** p10 (3 Nights, Day 4) — a shorter museum window and different wording from
 *  the 1N/2N departure page, so it cannot share the block above. */
const DEPARTURE_DAY_3N_ENTRIES: ItineraryEntry[] = [
  { time: '06:00 – 06:30', text: 'Morning tea' },
  { time: '06:30 – 07:30', text: 'Experience a rejuvenating yoga session at the dedicated area' },
  { time: '07:30 – 09:30', text: 'Breakfast at the respective dining area' },
  { time: '09:30', text: 'Check-out from Rann Utsav Tent City with happy memories' },
  { time: '10:00', text: 'The bus will depart for Bhuj' },
  {
    time: '11:30 – 13:30',
    text: 'Complimentary sightseeing of Swaminarayan Temple, Kutch Museum',
    note: 'Brochure: "Kutch Museum remains closed every Wednesday."',
  },
];

const DAY_1_TITLE = 'Arrival at Rann Utsav - The Tent City, Dhordo from Bhuj';

const day = (n: number, entries: ItineraryEntry[], title?: string): ItineraryDay =>
  title ? { day: n, title, entries } : { day: n, entries };

export const RANN_ITINERARIES: Record<1 | 2 | 3, Itinerary> = {
  1: {
    nights: 1,
    days: [day(1, DAY_1_ENTRIES, DAY_1_TITLE), day(2, DEPARTURE_DAY_ENTRIES)],
  },
  2: {
    nights: 2,
    days: [
      day(1, DAY_1_ENTRIES, DAY_1_TITLE),
      day(2, KALA_DUNGAR_DAY_ENTRIES),
      day(3, DEPARTURE_DAY_ENTRIES),
    ],
  },
  3: {
    nights: 3,
    days: [
      day(1, DAY_1_ENTRIES, DAY_1_TITLE),
      day(2, KALA_DUNGAR_DAY_ENTRIES),
      day(3, DHOLAVIRA_DAY_ENTRIES),
      day(4, DEPARTURE_DAY_3N_ENTRIES),
    ],
  },
};

/** Place names printed in the brochure. Used by the verification script to
 *  prove the condensed text invents nothing. */
export const RANN_PLACES = [
  'Kala Dungar',
  'Gandhi Nu Gaam',
  'Swaminarayan Temple',
  'Kutch Museum',
  'Dholavira',
  'Road Through Heaven',
  'Skyzilla',
  'White Rann',
  'Sunset Point',
  'Sunrise Point',
  'Club House',
  'Craft Market/Haat',
] as const;

// ─── Condensed form for WhatsApp ────────────────────────────
// One line per day, each a selection and shortening of the printed text above.
// Nothing is added: every activity and every place name below appears verbatim
// in the entries it condenses. Printed times are deliberately omitted except
// check-in and check-out, so the Day 1 dinner misprint can never reach a client.

const CONDENSED_DAY_1 =
  '*Day 1* — Check-in from 12:30 PM · Lunch · Leisure at Skyzilla, Club House & Craft Market/Haat · High tea · Sunset Point and the White Rann by bus/camel cart · Dinner · Kutch cultural evening';

const condensedKalaDungar = (n: number) =>
  `*Day ${n}* — Morning tea · Sunrise Point over the White Rann · Yoga · Breakfast · Leisure at Skyzilla, Club House & Craft Market/Haat · Lunch · Complimentary tour to Kala Dungar via the handicraft village Gandhi Nu Gaam · Dinner · Kutch cultural evening`;

const CONDENSED_DHOLAVIRA =
  '*Day 3* — Morning tea · Yoga · Breakfast · Leisure · Lunch · Drive to Dholavira along the Road Through Heaven · Archaeological Museum and Dholavira Excavation Site · Sunset along the Road Through Heaven · Dinner';

const condensedDeparture = (n: number) =>
  `*Day ${n}* — Morning tea · Yoga · Breakfast · Check-out 09:30 · Bus departs for Bhuj · Complimentary visit to Swaminarayan Temple and Kutch Museum`;

/**
 * Condensed, WhatsApp-ready itinerary: exactly one line per day
 * (i.e. `nights + 1` lines).
 */
export function condensedItinerary(nights: 1 | 2 | 3): string[] {
  if (nights === 1) return [CONDENSED_DAY_1, condensedDeparture(2)];
  if (nights === 2) return [CONDENSED_DAY_1, condensedKalaDungar(2), condensedDeparture(3)];
  return [CONDENSED_DAY_1, condensedKalaDungar(2), CONDENSED_DHOLAVIRA, condensedDeparture(4)];
}

// ─── Museum closure warnings ────────────────────────────────

export interface ItineraryWarning {
  day: number;
  text: string;
}

// Local date arithmetic only. UTC-based date formatting is banned in this
// repo: it rolls an IST date back to the previous day.
export const addLocalDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const WEEKDAY = { WED: 3, FRI: 5 } as const;

/**
 * Warns when a stay's advertised complimentary museum visits land on a day the
 * museum is shut. Check-in is Day 1.
 *
 *  - The Swaminarayan Temple + Kutch Museum visit is on the FINAL day of every
 *    package (1N Day 2, 2N Day 3, 3N Day 4) — verified against all three
 *    brochure pages. Kutch Museum is closed every Wednesday.
 *  - Dholavira's Archaeological Museum appears only in the 3N package, on
 *    Day 3, and is closed every Friday.
 */
export function itineraryWarnings(checkIn: Date, nights: 1 | 2 | 3): ItineraryWarning[] {
  const warnings: ItineraryWarning[] = [];
  if (isNaN(checkIn.getTime())) return warnings;

  // Day 1 = check-in day, so itinerary day N is check-in + (N − 1) days.
  const dateOfDay = (dayNumber: number) => addLocalDays(checkIn, dayNumber - 1);

  if (nights === 3 && dateOfDay(3).getDay() === WEEKDAY.FRI) {
    warnings.push({
      day: 3,
      text: 'Day 3 falls on a Friday — the Dholavira Archaeological Museum is closed every Friday. The excavation site and Road Through Heaven sunset are unaffected, but the museum cannot be visited.',
    });
  }

  const finalDay = nights + 1;
  if (dateOfDay(finalDay).getDay() === WEEKDAY.WED) {
    warnings.push({
      day: finalDay,
      text: `Day ${finalDay} falls on a Wednesday — the Kutch Museum is closed every Wednesday. The complimentary Swaminarayan Temple visit still runs, but the museum does not.`,
    });
  }

  return warnings.sort((a, b) => a.day - b.day);
}
