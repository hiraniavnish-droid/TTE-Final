export type ReadyPackageTier = 'Standard' | 'Deluxe' | 'Premium' | 'Luxury';

export interface ReadyPackageTierInfo {
  name: ReadyPackageTier;
  perPerson: { two: number; four: number; six: number; extra: number };
  stays: string[];
}

export interface ReadyPackageDay {
  day: number;
  title: string;
  stay: string;
  highlights: string[];
}

export interface ReadyPackage {
  id: string;
  nights: number;
  days: number;
  title: string;
  eyebrow: string;
  route: string;
  summary: string;
  heroLabel: string;
  daysPlan: ReadyPackageDay[];
  tiers: ReadyPackageTierInfo[];
  inclusions: string[];
  exclusions: string[];
  notes: string[];
}

const commonExclusions = [
  'Train, flight and bus tickets',
  'Monument entry fees and White Rann permits',
  'Meals not mentioned in the itinerary',
  'Personal expenses, tips, insurance and laundry',
  'Anything not listed in inclusions',
];

const commonNotes = [
  'Rooms, vehicles and listed hotels are subject to availability at confirmation.',
  'Festival dates, full moon dates and special-event dates may carry a revised tariff.',
  'GST is extra on the total package cost, as applicable.',
  'Vehicle use follows the stated itinerary and is not on a disposal basis.',
  'A 50% advance confirms the booking. Remaining payment is due before arrival as per package terms.',
];

const baseInclusions = (breakfasts: number, dinners: number) => [
  `Accommodation in selected category rooms, tents or bhunga with attached western bathroom`,
  `${breakfasts} breakfast${breakfasts > 1 ? 's' : ''} and ${dinners} dinner${dinners > 1 ? 's' : ''}`,
  'AC transfers and sightseeing as per itinerary',
  'Vehicle, driver allowance, toll and parking',
  'Two bottles of water daily at hotel',
  'Experienced Hindi and Gujarati speaking driver',
];

export const RAJARSHI_READY_PACKAGES: ReadyPackage[] = [
  {
    id: 'kutch-1n-2d', nights: 1, days: 2,
    title: 'Kutch Essentials', eyebrow: '01 Night / 02 Days', route: 'Bhuj · Dholavira · White Rann',
    summary: 'A compact Kutch escape pairing Bhuj’s culture with Dholavira, Road to Heaven and the White Rann sunset.',
    heroLabel: 'Culture to salt desert',
    daysPlan: [
      { day: 1, title: 'Bhuj arrival and local stories', stay: 'Bhuj', highlights: ['Airport or railway-station pickup', 'Aina Mahal, Prag Mahal and Kutch Museum', 'Smritivan and Bhujodi craft village'] },
      { day: 2, title: 'Dholavira and the White Rann', stay: 'Departure', highlights: ['Kala Dungar and Gandhi nu Gaam', 'Road to Heaven and Dholavira archaeological site', 'White Rann sunset, then Bhuj drop'] },
    ],
    tiers: [
      { name: 'Standard', perPerson: { two: 6500, four: 4500, six: 3750, extra: 1000 }, stays: ['Hotel White Desert, Bhuj or similar'] },
      { name: 'Deluxe', perPerson: { two: 7250, four: 5250, six: 4500, extra: 1500 }, stays: ['The Canyon Inn or Kutch Elegance, Bhuj or similar'] },
      { name: 'Premium', perPerson: { two: 8250, four: 6250, six: 5500, extra: 2500 }, stays: ['Ramee The Srinivas Palace or The Ilark, Bhuj or similar'] },
      { name: 'Luxury', perPerson: { two: 9250, four: 7250, six: 6500, extra: 3500 }, stays: ['Hill View Resort or Floating Deck Resort, Bhuj or similar'] },
    ],
    inclusions: baseInclusions(2, 1), exclusions: commonExclusions, notes: commonNotes,
  },
  {
    id: 'kutch-2n-3d', nights: 2, days: 3,
    title: 'Kutch Signature Escape', eyebrow: '02 Nights / 03 Days', route: 'Bhuj · Mandvi · White Rann · Dholavira',
    summary: 'A balanced first Kutch journey: Mandvi’s coast, a White Rann evening and the ancient city of Dholavira.',
    heroLabel: 'Coast, desert and heritage',
    daysPlan: [
      { day: 1, title: 'Bhuj arrival and Mandvi sunset', stay: 'Bhuj', highlights: ['Vijay Vilas Palace and 72 Jinalaya', 'Shyamji Krishna Verma Memorial', 'Mandvi Beach sunset'] },
      { day: 2, title: 'Northern Kutch and White Rann', stay: 'Near White Rann', highlights: ['Gandhi nu Gaam, Kala Dungar and India Bridge', 'White Rann sunset and optional activities', 'Kutchi folk music at resort'] },
      { day: 3, title: 'Dholavira and Bhuj drop', stay: 'Departure', highlights: ['Road to Heaven', 'Dholavira excavation site and museum', 'Bhuj airport or railway-station drop'] },
    ],
    tiers: [
      { name: 'Standard', perPerson: { two: 11000, four: 8250, six: 7500, extra: 3000 }, stays: ['Hotel White Desert, Bhuj or similar', 'Rann Visamo Resort or similar'] },
      { name: 'Deluxe', perPerson: { two: 12500, four: 9500, six: 9250, extra: 3500 }, stays: ['The Canyon Inn or Kutch Elegance, Bhuj or similar', 'Mehefil E Rann Resort or similar'] },
      { name: 'Premium', perPerson: { two: 14750, four: 11500, six: 11250, extra: 4500 }, stays: ['Ramee The Srinivas Palace or The Ilark, Bhuj or similar', 'Gateway to Rann or Kutch Classic Resort Camp or similar'] },
      { name: 'Luxury', perPerson: { two: 23250, four: 20750, six: 20500, extra: 9000 }, stays: ['Seven Sky Clarks Exotica or Hill View Resort, Bhuj or similar', 'Rann Utsav The Tent City, Dhordo'] },
    ],
    inclusions: baseInclusions(3, 2), exclusions: commonExclusions, notes: commonNotes,
  },
  {
    id: 'kutch-3n-4d', nights: 3, days: 4,
    title: 'Kutch Complete Circuit', eyebrow: '03 Nights / 04 Days', route: 'Bhuj · Mandvi · White Rann · Dholavira',
    summary: 'A complete circuit with Bhuj’s crafts, Mandvi’s coast, a White Rann stay and Dholavira’s Harappan story.',
    heroLabel: 'The complete Kutch circuit',
    daysPlan: [
      { day: 1, title: 'Bhuj arrival and local sightseeing', stay: 'Bhuj', highlights: ['Aina Mahal, Prag Mahal and Kutch Museum', 'Smritivan memorial', 'Bhujodi craft village'] },
      { day: 2, title: 'Southern Kutch and Mandvi', stay: 'Bhuj', highlights: ['72 Jinalaya Jain Temple', 'Shyamji Krishna Verma Memorial and Vijay Vilas Palace', 'Mandvi Beach sunset'] },
      { day: 3, title: 'Northern Kutch and White Rann', stay: 'Near White Rann', highlights: ['Gandhi nu Gaam, Kala Dungar and India Bridge', 'White Rann activities and sunset', 'Kutchi folk music evening'] },
      { day: 4, title: 'Dholavira and return to Bhuj', stay: 'Departure', highlights: ['Road to Heaven', 'Dholavira archaeological site and museum', 'Bhuj airport or railway-station drop'] },
    ],
    tiers: [
      { name: 'Standard', perPerson: { two: 15500, four: 11750, six: 11000, extra: 4500 }, stays: ['Hotel White Desert, Bhuj or similar', 'Rann Visamo Resort or similar'] },
      { name: 'Deluxe', perPerson: { two: 17500, four: 13250, six: 12250, extra: 6000 }, stays: ['The Canyon Inn or Kutch Elegance, Bhuj or similar', 'Mehefil E Rann Resort or similar'] },
      { name: 'Premium', perPerson: { two: 20500, four: 16250, six: 15800, extra: 7000 }, stays: ['Ramee The Srinivas Palace or The Ilark, Bhuj or similar', 'Gateway to Rann or Kutch Classic Resort Camp or similar'] },
      { name: 'Luxury', perPerson: { two: 30000, four: 26750, six: 26250, extra: 11000 }, stays: ['Floating Deck Resort or Hill View Resort, Bhuj or similar', 'Rann Utsav The Tent City, Dhordo'] },
    ],
    inclusions: baseInclusions(4, 3), exclusions: commonExclusions, notes: commonNotes,
  },
  {
    id: 'kutch-4n-5d', nights: 4, days: 5,
    title: 'Kutch Grand Explorer', eyebrow: '04 Nights / 05 Days', route: 'Bhuj · Mandvi · Western Kutch · Dholavira · White Rann',
    summary: 'For travellers who want the whole canvas: coast, western temples, Dholavira, White Rann and Bhuj’s heritage.',
    heroLabel: 'A deeper Kutch journey',
    daysPlan: [
      { day: 1, title: 'Bhuj arrival and Mandvi', stay: 'Bhuj', highlights: ['Vijay Vilas Palace and 72 Jinalaya', 'Shyamji Krishna Verma Memorial', 'Mandvi Beach sunset'] },
      { day: 2, title: 'Western Kutch', stay: 'Bhuj', highlights: ['Mata no Madh', 'Narayan Sarovar and Koteshwar', 'Lakhpat Fort and Gurudwara'] },
      { day: 3, title: 'Bhuj to Dholavira', stay: 'Dholavira', highlights: ['Road to Heaven', 'Dholavira archaeological site and museum', 'Sunset point'] },
      { day: 4, title: 'Dholavira to White Rann', stay: 'Near White Rann', highlights: ['Kala Dungar and Gandhi nu Gaam', 'White Rann sunset and activities', 'Kutchi folk music evening'] },
      { day: 5, title: 'Bhuj heritage and departure', stay: 'Departure', highlights: ['Swaminarayan Temple, Kutch Museum and palaces', 'Smritivan and Bhujodi', 'Bhuj airport or railway-station drop'] },
    ],
    tiers: [
      { name: 'Standard', perPerson: { two: 20500, four: 15500, six: 14750, extra: 5500 }, stays: ['Hotel White Desert, Bhuj or similar', 'Ram Rann Resort, Dholavira or similar', 'Rann Visamo Resort or similar'] },
      { name: 'Deluxe', perPerson: { two: 22500, four: 17500, six: 17250, extra: 6500 }, stays: ['The Canyon Inn or Kutch Elegance, Bhuj or similar', 'Rann Resort Dholavira or similar', 'Mehefil E Rann Resort or similar'] },
      { name: 'Premium', perPerson: { two: 27000, four: 21500, six: 21000, extra: 11000 }, stays: ['The Ilark or Ramee The Srinivas Palace, Bhuj or similar', 'Desert Castle or Heritage Resort Dholavira or similar', 'Gateway to Rann or Kutch Classic Resort Camp or similar'] },
      { name: 'Luxury', perPerson: { two: 42500, four: 39250, six: 38500, extra: 17500 }, stays: ['Floating Deck Resort or Hill View Resort, Bhuj or similar', 'Evoke Resort Dholavira or similar', 'Rann Utsav The Tent City, Dhordo'] },
    ],
    inclusions: baseInclusions(5, 4), exclusions: commonExclusions, notes: [...commonNotes.slice(0, 4), 'A 50% advance confirms the booking. Remaining payment is due 30 days before arrival.'],
  },
  {
    id: 'kutch-5n-6d', nights: 5, days: 6,
    title: 'Kutch Immersive Journey', eyebrow: '05 Nights / 06 Days', route: 'Bhuj · Mandvi · Western Kutch · Dholavira · White Rann',
    summary: 'The unhurried Kutch experience, with time for Bhuj, Mandvi, western temples, Dholavira, crafts and the White Rann.',
    heroLabel: 'Six days, every side of Kutch',
    daysPlan: [
      { day: 1, title: 'Bhuj arrival and local sightseeing', stay: 'Bhuj', highlights: ['Swaminarayan Temple, Kutch Museum, Aina Mahal and Prag Mahal', 'Smritivan memorial', 'Relaxed Bhuj evening'] },
      { day: 2, title: 'Southern Kutch and Mandvi', stay: 'Bhuj', highlights: ['Vijay Vilas Palace and 72 Jinalaya', 'Shyamji Krishna Verma Memorial', 'Mandvi Beach sunset'] },
      { day: 3, title: 'Western Kutch', stay: 'Bhuj', highlights: ['Mata no Madh', 'Narayan Sarovar and Koteshwar', 'Lakhpat village, fort and Gurudwara'] },
      { day: 4, title: 'Bhuj to Dholavira', stay: 'Dholavira', highlights: ['Road to Heaven', 'Dholavira archaeological site and museum', 'Dholavira sunset point'] },
      { day: 5, title: 'Dholavira to White Rann', stay: 'Near White Rann', highlights: ['Gandhi nu Gaam and Kala Dungar', 'White Rann activities and sunset', 'Kutchi folk music evening'] },
      { day: 6, title: 'Craft villages and departure', stay: 'Departure', highlights: ['Nirona Rogan Art village', 'Bhujodi craft village and shopping', 'Bhuj airport or railway-station drop'] },
    ],
    tiers: [
      { name: 'Standard', perPerson: { two: 24000, four: 18500, six: 17500, extra: 6500 }, stays: ['Hotel White Desert, Bhuj or similar', 'Ram Rann Resort, Dholavira or similar', 'Rann Visamo Resort, Hodka or similar'] },
      { name: 'Deluxe', perPerson: { two: 27500, four: 21500, six: 19800, extra: 8000 }, stays: ['The Canyon Inn or Kutch Elegance, Bhuj or similar', 'Rann Resort Dholavira or similar', 'Mehefil E Rann Resort, Hodka or similar'] },
      { name: 'Premium', perPerson: { two: 31800, four: 24500, six: 23000, extra: 11000 }, stays: ['The Ilark or Ramee Srinivas Palace, Bhuj or similar', 'Heritage Resort or Desert Castle Resort, Dholavira or similar', 'Gateway to Rann or Kutch Classic Resort Camp or similar'] },
      { name: 'Luxury', perPerson: { two: 50000, four: 44500, six: 39800, extra: 19500 }, stays: ['Floating Deck Resort or Hill View Resort, Bhuj or similar', 'Evoke Dholavira', 'Rann Utsav The Tent City, Dhordo'] },
    ],
    inclusions: baseInclusions(6, 5), exclusions: commonExclusions, notes: commonNotes,
  },
];

export const findRajarshiReadyPackage = (id: string | undefined) => RAJARSHI_READY_PACKAGES.find(pkg => pkg.id === id);

const inr = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

// This is intentionally plain WhatsApp text rather than a hosted itinerary.
// The employee can open WhatsApp straight from a package card and choose the
// client, with every key detail included in the message itself.
export const formatRajarshiPackageWhatsApp = (pkg: ReadyPackage) => [
  '*Rajarshi Tours and Travels*',
  `*${pkg.title}*`,
  `${pkg.eyebrow} | ${pkg.route}`,
  '',
  '*Day-wise itinerary*',
  ...pkg.daysPlan.map(day => `*Day ${day.day} — ${day.title}*\n${day.highlights.map(point => `• ${point}`).join('\n')}`),
  '',
  '*Package rates per person*',
  ...pkg.tiers.map(tier => [
    `*${tier.name}* — 2 guests: ${inr(tier.perPerson.two)} | 4 guests: ${inr(tier.perPerson.four)} | 6 guests: ${inr(tier.perPerson.six)}`,
    `Extra person: ${inr(tier.perPerson.extra)}`,
    `Stay: ${tier.stays.join(' + ')}`,
  ].join('\n')),
  '',
  '*Package includes*',
  ...pkg.inclusions.map(item => `• ${item}`),
  '',
  '*Not included*',
  ...pkg.exclusions.map(item => `• ${item}`),
  '',
  '*Important notes*',
  ...pkg.notes.map(item => `• ${item}`),
  '',
  'Please share your travel dates and number of guests for a final availability check and quotation.',
].join('\n');
