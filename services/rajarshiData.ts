// Auto-transcribed from "Exclusive Rate Sheet 2026-27 for TTE AHMEDABAD.pdf"
// (Rajarshi Travels, Bhuj — B2B rate sheet 2026-27). All rates are per ROOM
// per NIGHT and INCLUSIVE of GST per the sheet's global T&C. Verify against
// the PDF before relying on any single number.

export type RajPlan = 'EPAI' | 'CPAI' | 'MAPAI';
export type RajCity = 'Bhuj' | 'Mandvi' | 'Dholavira' | 'Dhordo' | 'Hodka' | 'Gorewali';

export interface RajTier {
  id: string;                 // 'peak' | 'diwali' | 'xmas' etc. ('base' is implicit)
  label: string;              // e.g. 'Black-Out / Peak Dates'
  windows: { from: string; to: string; label?: string }[]; // ISO dates, inclusive
  mode: 'replace' | 'surcharge';
  surcharge?: number;         // per room per night, only when mode==='surcharge'
}

export interface RajRoom {
  name: string;
  occupancy: string;          // as printed, e.g. 'Single/Double', 'Quad Sharing (4 pax)'
  count?: number;             // no. of rooms if printed
  // rates keyed by tier id; 'base' always present. Within a tier, keyed by plan.
  rates: Record<string, Partial<Record<RajPlan, number>>>;
}

export interface RajHotel {
  id: string;                 // kebab-case slug
  name: string;
  city: RajCity;
  descriptor?: string;        // star rating / locality line as printed
  rooms: RajRoom[];
  tiers: RajTier[];           // empty array if hotel has no peak dates
  // extra person / extra bed / mattress, keyed by tier id then plan.
  extraPerson?: Record<string, Partial<Record<RajPlan, number>>>;
  extraPersonLabel?: string;  // the sheet's own wording ('Extra Bed', 'Extra Person with Mattress'...)
  mealSupplement?: { amount: number; note?: string }; // per person per meal upgrade, if offered
  validity?: { from: string; to: string };  // seasonal camps only (e.g. Nov 2026–Feb 2027)
  notes?: string[];           // any hotel-specific remarks printed on the sheet
}

export const RAJARSHI_SUPPLIER = {
  id: 'rajarshi',
  name: 'Rajarshi Travels',
  location: 'Bhuj, Kutch',
  phone: '+91-7874821212 / +91-7874521212',
  email: 'info@rajarshitravels.in',
  season: '2026-27',
  gstIncluded: true,
} as const;

export const RAJARSHI_HOTELS: RajHotel[] = [
  // ───────────────────────────── BHUJ ─────────────────────────────
  {
    id: 'time-square-club-resort-spa',
    name: 'Time Square Club Resort & Spa, Bhuj',
    city: 'Bhuj',
    descriptor: 'Only – Classified 5 Star Property at Entire Kutch with Pure Veg. Restaurant',
    rooms: [
      {
        name: 'Deluxe Room (King Bed)',
        occupancy: 'Single/Double',
        count: 62,
        rates: {
          base: { CPAI: 7350, MAPAI: 9700 },
          diwali: { MAPAI: 11850 },
          xmas: { MAPAI: 14200 },
        },
      },
      {
        name: 'Deluxe Room (Twin Bed)',
        occupancy: 'Single/Double',
        count: 6,
        rates: {
          base: { CPAI: 7350, MAPAI: 9700 },
          diwali: { MAPAI: 11850 },
          xmas: { MAPAI: 14200 },
        },
      },
    ],
    tiers: [
      {
        id: 'diwali',
        label: 'Black-Out / Diwali Date Rate',
        windows: [{ from: '2026-11-06', to: '2026-11-15', label: 'Diwali Date' }],
        mode: 'replace',
      },
      {
        id: 'xmas',
        label: 'Christmas / New Year Date Rate',
        windows: [{ from: '2026-12-19', to: '2027-01-03', label: 'Christmas / New Year Date' }],
        mode: 'replace',
      },
    ],
    extraPerson: {
      base: { CPAI: 2100, MAPAI: 3000 },
      diwali: { MAPAI: 3000 },
      xmas: { MAPAI: 3000 },
    },
    extraPersonLabel: 'Extra Person / Child',
    notes: [
      'MAPAI rate (9,700 base / 11,850 Diwali / 14,200 Xmas) is printed generically for "Deluxe Room" without a King/Twin split; applied to both room rows.',
    ],
  },
  {
    id: 'floating-deck-resort',
    name: 'Floating Deck Resort, Bhuj',
    city: 'Bhuj',
    descriptor: '04 Star – New Property',
    rooms: [
      {
        name: 'Superior Room',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { CPAI: 5000 }, peak: { CPAI: 6700 } },
      },
      {
        name: 'Superior Premium Room',
        occupancy: 'Single/Double',
        count: 16,
        rates: { base: { CPAI: 5750 }, peak: { CPAI: 7500 } },
      },
      {
        name: 'Pool View Room',
        occupancy: 'Single/Double',
        count: 7,
        rates: { base: { CPAI: 6700 }, peak: { CPAI: 9400 } },
      },
      {
        name: 'Lake View Room with Balcony',
        occupancy: 'Single/Double',
        count: 14,
        rates: { base: { CPAI: 9000 }, peak: { CPAI: 11700 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Peak Date Rate / Black-out Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-21', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { CPAI: 1575 }, peak: { CPAI: 1890 } },
    extraPersonLabel: 'Extra Bed',
    mealSupplement: { amount: 1050, note: 'Per Meal, Per Person (Veg. Only)' },
  },
  {
    id: 'hill-view-resort',
    name: 'Hill View Resort, Bhuj',
    city: 'Bhuj',
    rooms: [
      {
        name: 'Deluxe AC',
        occupancy: 'Single/Double',
        count: 8,
        rates: { base: { CPAI: 4600 }, peak: { CPAI: 6000 } },
      },
      {
        name: 'Super Deluxe AC',
        occupancy: 'Single/Double',
        count: 8,
        rates: { base: { CPAI: 5400 }, peak: { CPAI: 6800 } },
      },
      {
        name: 'Cabana AC',
        occupancy: 'Single/Double',
        count: 16,
        rates: { base: { CPAI: 6400 }, peak: { CPAI: 7700 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-05', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-21', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-03', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-19', to: '2027-01-27', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { CPAI: 1600 }, peak: { CPAI: 1600 } },
    extraPersonLabel: 'Extra Bed',
    mealSupplement: { amount: 800, note: 'Per Meal, Per Person' },
  },
  {
    id: 'ramee-the-srinivas-palace',
    name: 'Ramee The Srinivas Palace, Bhuj',
    city: 'Bhuj',
    descriptor: 'Mirjapar Road',
    rooms: [
      {
        name: 'Superior Twin Bed AC',
        occupancy: 'Single/Double',
        count: 10,
        rates: { base: { MAPAI: 5500 } },
      },
      {
        name: 'Executive King Bed AC',
        occupancy: 'Single/Double',
        count: 22,
        rates: { base: { MAPAI: 5500 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate (Additional Rs 1,000 on room rate)',
        windows: [
          { from: '2026-11-05', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-12-19', to: '2027-01-05', label: 'Christmas Date' },
          { from: '2027-01-09', to: '2027-01-15', label: 'Uttrayan' },
        ],
        mode: 'surcharge',
        surcharge: 1000,
      },
    ],
    extraPerson: { base: { MAPAI: 2000 } },
    extraPersonLabel: 'Extra Person with Mattress',
    notes: ['Black-out surcharge (Rs 1,000/room) explicitly stated to leave the extra-person rate unchanged.'],
  },
  {
    id: 'hotel-ilark',
    name: 'Hotel Ilark, Bhuj',
    city: 'Bhuj',
    rooms: [
      {
        name: 'Deluxe AC',
        occupancy: 'Single/Double',
        count: 38,
        rates: { base: { CPAI: 3900 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate (Additional Rs 1,000)',
        windows: [
          { from: '2026-11-05', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-12-23', to: '2027-01-03', label: 'Christmas Date' },
        ],
        mode: 'surcharge',
        surcharge: 1000,
      },
    ],
    extraPerson: { base: { CPAI: 1260 } },
    extraPersonLabel: 'Extra Bed',
    mealSupplement: { amount: 700, note: 'Per Meal, Per Person' },
  },
  {
    id: 'dream-resort-bhujodi',
    name: 'Dream Resort at Bhujodi, Bhuj',
    city: 'Bhuj',
    rooms: [
      {
        name: 'Super Deluxe Room',
        occupancy: 'Single/Double',
        count: 40,
        rates: { base: { CPAI: 3100 }, peak: { CPAI: 3850 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-19', to: '2027-01-05', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-13', to: '2027-01-17', label: 'Jan 2027 Full Moon Date' },
          { from: '2027-01-21', to: '2027-01-27', label: 'Republic Day' },
          { from: '2027-02-20', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { CPAI: 800 }, peak: { CPAI: 800 } },
    extraPersonLabel: 'Extra Person with Mattress',
    mealSupplement: { amount: 400, note: 'Per Meal, Per Person' },
  },
  {
    id: 'hotel-canyon-inn',
    name: 'Hotel Canyon Inn, Bhuj',
    city: 'Bhuj',
    descriptor: '02 Star',
    rooms: [
      {
        name: 'Deluxe AC',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { CPAI: 2500 }, peak: { CPAI: 3500 } },
      },
      {
        name: 'Super Deluxe AC',
        occupancy: 'Single/Double',
        count: 35,
        rates: { base: { CPAI: 2900 }, peak: { CPAI: 3900 } },
      },
      {
        name: 'Semi Suite',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { CPAI: 4400 }, peak: { CPAI: 5400 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { CPAI: 1000 }, peak: { CPAI: 1000 } },
    extraPersonLabel: 'Extra Person with Mattress',
    mealSupplement: { amount: 400, note: 'Per Meal, Per Person' },
  },
  {
    id: 'hotel-kutch-elegance',
    name: 'Hotel Kutch Elegance, Madhapar – Bhuj',
    city: 'Bhuj',
    descriptor: '02 Star – New Property',
    rooms: [
      {
        name: 'Deluxe AC Room',
        occupancy: 'Single/Double',
        count: 32,
        rates: { base: { CPAI: 2600 }, peak: { CPAI: 3600 } },
      },
      {
        name: 'Super Deluxe AC',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { CPAI: 3300 }, peak: { CPAI: 4300 } },
      },
      {
        name: 'Suite',
        occupancy: 'Single/Double',
        count: 2,
        rates: { base: { CPAI: 4300 }, peak: { CPAI: 5300 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { CPAI: 1000 }, peak: { CPAI: 1000 } },
    extraPersonLabel: 'Extra Person with Mattress',
    mealSupplement: { amount: 400, note: 'Per Meal, Per Person' },
    notes: ['Not in the sheet\'s "17 hotels" summary count but printed in full on page 3 of the PDF; included per source.'],
  },
  {
    id: 'hotel-white-desert',
    name: 'Hotel White Desert, Near Bhuj Airport – Bhuj',
    city: 'Bhuj',
    descriptor: 'Budget Property',
    rooms: [
      {
        name: 'Deluxe AC Room',
        occupancy: 'Single/Double',
        count: 9,
        rates: { base: { EPAI: 1600, CPAI: 1800 }, peak: { CPAI: 2800 } },
      },
      {
        name: 'Super Deluxe AC',
        occupancy: 'Single/Double',
        count: 24,
        rates: { base: { EPAI: 2000, CPAI: 2200 }, peak: { CPAI: 3200 } },
      },
      {
        name: 'Family Room – Quad Sharing',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { EPAI: 3300, CPAI: 3800 }, peak: { CPAI: 4800 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { EPAI: 600, CPAI: 750 }, peak: { CPAI: 1000 } },
    extraPersonLabel: 'Extra Person / Child with Mattress',
    notes: [
      '"Family Room – Quad Sharing" occupancy is printed as "Single / Double Occupancy" in the source despite its name; kept as printed.',
      'Black-out rate only prints a CPAI figure (no EPAI black-out rate given) — EPAI key omitted for the peak tier.',
    ],
  },

  // ──────────────────────────── MANDVI ────────────────────────────
  {
    id: 'serena-beach-resort',
    name: 'Serena Beach Resort, Mandvi',
    city: 'Mandvi',
    rooms: [
      {
        name: 'Deluxe AC Huts',
        occupancy: 'Single/Double',
        count: 26,
        rates: { base: { CPAI: 8500, MAPAI: 9700 }, peak: { CPAI: 10300, MAPAI: 11700 } },
      },
      {
        name: 'Garden Villa',
        occupancy: 'Quad Sharing',
        count: 5,
        rates: { base: { CPAI: 15750, MAPAI: 18500 }, peak: { CPAI: 18500, MAPAI: 21350 } },
      },
      {
        name: 'Pool Villa',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { CPAI: 21300, MAPAI: 23300 }, peak: { CPAI: 23900, MAPAI: 25900 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-12-19', to: '2027-01-01', label: 'Christmas Date and New Year' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { CPAI: 3300, MAPAI: 4200 }, peak: { CPAI: 3300, MAPAI: 4200 } },
    extraPersonLabel: 'Extra Bed',
    notes: [
      'Extra Bed rate is only printed for Deluxe AC Huts; Garden Villa and Pool Villa show no extra-bed figure in the source.',
      'Rate not valid for 31/Dec/2026, per source note.',
    ],
  },
  {
    id: 'vijay-vilas-heritage-resort',
    name: 'Vijay Vilas Heritage Resort, Mandvi',
    city: 'Mandvi',
    rooms: [
      {
        name: 'Heritage Room / Villa',
        occupancy: 'Single/Double',
        rates: { base: { MAPAI: 7000 }, peak: { MAPAI: 9000 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-08', to: '2026-11-17', label: 'Diwali Date' },
          { from: '2026-12-20', to: '2027-01-05', label: 'Christmas Date and New Year' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 2250 }, peak: { MAPAI: 2250 } },
    extraPersonLabel: 'Extra Bed',
    notes: ['No room count printed for this hotel in the source.'],
  },

  // ─────────────────────────── DHOLAVIRA ───────────────────────────
  {
    id: 'rann-resort-dholavira',
    name: 'Rann Resort, Dholavira',
    city: 'Dholavira',
    rooms: [
      {
        name: 'AC Cottages',
        occupancy: 'Single/Double',
        count: 16,
        rates: { base: { MAPAI: 5200 }, peak: { MAPAI: 6200 } },
      },
      {
        name: 'Rajwadi AC Cottages',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { MAPAI: 6200 }, peak: { MAPAI: 7200 } },
      },
      {
        name: 'Superior Bhunga AC',
        occupancy: 'Single/Double',
        count: 6,
        rates: { base: { MAPAI: 6800 }, peak: { MAPAI: 7800 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 1800 }, peak: { MAPAI: 1800 } },
    extraPersonLabel: 'Extra Bed',
    notes: ['Black-out table is printed once (after Heritage Resort, Dholavira) and shared by all three Dholavira hotels.'],
  },
  {
    id: 'desert-castle-resort',
    name: 'Desert Castle Resort, Dholavira',
    city: 'Dholavira',
    rooms: [
      {
        name: 'Deluxe Room',
        occupancy: 'Single/Double',
        count: 10,
        rates: { base: { MAPAI: 5800 }, peak: { MAPAI: 6800 } },
      },
      {
        name: 'Superior Room',
        occupancy: 'Single/Double',
        count: 6,
        rates: { base: { MAPAI: 6800 }, peak: { MAPAI: 7800 } },
      },
      {
        name: 'Queen Castle',
        occupancy: 'Single/Double',
        count: 6,
        rates: { base: { MAPAI: 7800 }, peak: { MAPAI: 8800 } },
      },
      {
        name: 'King Castle',
        occupancy: 'Single/Double',
        count: 2,
        rates: { base: { MAPAI: 9800 }, peak: { MAPAI: 10800 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 2000 }, peak: { MAPAI: 2000 } },
    extraPersonLabel: 'Extra Bed',
    notes: ['Black-out table is printed once (after this hotel\'s section) and shared by all three Dholavira hotels.'],
  },
  {
    id: 'heritage-resort-dholavira',
    name: 'Heritage Resort, Dholavira',
    city: 'Dholavira',
    rooms: [
      {
        name: 'Kutchi Bhunga',
        occupancy: 'Single/Double',
        count: 22,
        rates: { base: { MAPAI: 5800 }, peak: { MAPAI: 7300 } },
      },
      {
        name: 'Kutchi Bhunga (Twin Bed)',
        occupancy: 'Single/Double',
        count: 8,
        rates: { base: { MAPAI: 5800 }, peak: { MAPAI: 7300 } },
      },
      {
        name: 'Premium Bhunga with Private Pool',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { MAPAI: 14800 }, peak: { MAPAI: 17300 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black-Out Date Rate',
        windows: [
          { from: '2026-11-07', to: '2026-11-15', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-20', to: '2027-01-01', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-21', to: '2027-01-26', label: 'Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-21', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 2000 }, peak: { MAPAI: 2000 } },
    extraPersonLabel: 'Extra Mattress',
    notes: [
      '"Premium Bhunga with Private Pool" rates (14,800 base / 17,300 peak) are printed without a meal-plan code in the source; assumed MAPAI to match every other Dholavira/Dhordo room.',
    ],
  },

  // ─────────────────────── DHORDO / HODKA / GOREWALI ───────────────────────
  {
    id: 'rann-heritage-resort-dhordo',
    name: 'Rann Heritage Resort, Dhordo',
    city: 'Dhordo',
    descriptor: 'Nearest Stay to White Rann',
    validity: { from: '2026-11-01', to: '2027-02-28' },
    rooms: [
      {
        name: 'Deluxe Non AC Tents',
        occupancy: 'Single/Double',
        count: 26,
        rates: { base: { MAPAI: 5500 }, peak: { MAPAI: 6500 } },
      },
      {
        name: 'Mughal AC Tents',
        occupancy: 'Single/Double',
        count: 14,
        rates: { base: { MAPAI: 6300 }, peak: { MAPAI: 7750 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Peak Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-19', to: '2027-01-05', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-13', to: '2027-01-27', label: 'Uttrayan, Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-19', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 2000 }, peak: { MAPAI: 2000 } },
    extraPersonLabel: 'Extra Person with Mattress',
  },
  {
    id: 'kutch-classic-resort-camp',
    name: 'Kutch Classic Resort Camp, Gorewali',
    city: 'Gorewali',
    validity: { from: '2026-11-01', to: '2027-02-28' },
    rooms: [
      {
        name: 'Deluxe Non AC Tents',
        occupancy: 'Single/Double',
        count: 12,
        rates: { base: { MAPAI: 4300 }, peak: { MAPAI: 5600 } },
      },
      {
        name: 'Premium AC Tents',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { MAPAI: 5150 }, peak: { MAPAI: 6400 } },
      },
      {
        name: 'Premium AC Mughal Tents',
        occupancy: 'Single/Double',
        count: 15,
        rates: { base: { MAPAI: 6150 }, peak: { MAPAI: 7400 } },
      },
      {
        name: 'King Family Tents',
        occupancy: 'Quad Sharing',
        count: 1,
        rates: { base: { MAPAI: 10300 }, peak: { MAPAI: 11900 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Peak Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-19', to: '2027-01-05', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-13', to: '2027-01-27', label: 'Uttrayan, Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-20', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 2000 }, peak: { MAPAI: 2000 } },
    extraPersonLabel: 'Extra Bed',
    notes: [
      'Source header wrongly reads "Rate for Nov, 2025 to Feb, 2026"; interpreted as the 2026-27 season consistent with the rest of the sheet.',
      'Premium AC Mughal Tents room count is printed as 15 in the base-rate line but 10 in the peak-rate line; base figure (15) kept, discrepancy noted here.',
    ],
  },
  {
    id: 'mahefeel-e-rann-resort',
    name: 'Mahefeel-E-Rann Resort, Hodka',
    city: 'Hodka',
    rooms: [
      {
        name: 'Non AC Tents',
        occupancy: 'Single/Double',
        count: 3,
        rates: { base: { MAPAI: 3500 }, peak: { MAPAI: 4500 } },
      },
      {
        name: 'AC Bhunga',
        occupancy: 'Single/Double',
        count: 10,
        rates: { base: { MAPAI: 4300 }, peak: { MAPAI: 5300 } },
      },
      {
        name: 'AC Family Bhunga',
        occupancy: 'Quad Sharing',
        count: 10,
        rates: { base: { MAPAI: 6400 }, peak: { MAPAI: 7400 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Peak Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          {
            from: '2026-12-20',
            to: '2027-01-27',
            label: 'Christmas Date & Dec 2026 Full Moon / Uttrayan, Republic Day & Jan 2027 Full Moon',
          },
          { from: '2027-02-20', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 1800 }, peak: { MAPAI: 1800 } },
    extraPersonLabel: 'Extra Bed',
    notes: [
      'Source blackout table merges the "Christmas Date & Dec 2026 Full Moon" row and the "Uttrayan, Republic Day & Jan 2027 Full Moon" row into one shared date cell (20-Dec-2026 to 27-Jan-2027, highlighted in the PDF); encoded as printed.',
    ],
  },
  {
    id: 'desert-inn-resort-dhordo',
    name: 'Desert Inn Resort, Dhordo',
    city: 'Dhordo',
    validity: { from: '2026-11-01', to: '2027-02-28' },
    rooms: [
      {
        name: 'Deluxe Non AC Tents',
        occupancy: 'Single/Double',
        count: 20,
        rates: { base: { MAPAI: 5200 }, peak: { MAPAI: 6000 } },
      },
      {
        name: 'Premium AC Tents',
        occupancy: 'Single/Double',
        count: 20,
        rates: { base: { MAPAI: 6400 }, peak: { MAPAI: 7200 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Black Out Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          { from: '2026-12-19', to: '2027-01-05', label: 'Christmas Date & Dec 2026 Full Moon' },
          { from: '2027-01-13', to: '2027-01-27', label: 'Uttrayan, Republic Day & Jan 2027 Full Moon' },
          { from: '2027-02-20', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 2000 }, peak: { MAPAI: 2000 } },
    extraPersonLabel: 'Extra Bed',
    notes: ['Source header reads "Rate for Nov,2026 and Feb,2027".'],
  },
  {
    id: 'rann-visamo-village-resort',
    name: 'Rann Visamo Village Resort, Hodka',
    city: 'Hodka',
    rooms: [
      {
        name: 'Non AC Tents',
        occupancy: 'Single/Double',
        count: 5,
        rates: { base: { MAPAI: 3500 }, peak: { MAPAI: 4000 } },
      },
      {
        name: 'Traditional AC Cottages',
        occupancy: 'Single/Double',
        count: 16,
        rates: { base: { MAPAI: 4500 }, peak: { MAPAI: 5000 } },
      },
      {
        name: 'AC Bhunga',
        occupancy: 'Single/Double',
        count: 4,
        rates: { base: { MAPAI: 4500 }, peak: { MAPAI: 5000 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Peak Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          {
            from: '2026-12-22',
            to: '2027-01-27',
            label: 'Christmas Date & Dec 2026 Full Moon / Uttrayan, Republic Day & Jan 2027 Full Moon',
          },
          { from: '2027-02-20', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 1800 }, peak: { MAPAI: 1800 } },
    extraPersonLabel: 'Extra Bed',
    notes: [
      'Source blackout table merges the "Christmas Date & Dec 2026 Full Moon" row and the "Uttrayan, Republic Day & Jan 2027 Full Moon" row into one shared date cell (22-Dec-2026 to 27-Jan-2027, highlighted in the PDF); encoded as printed.',
    ],
  },
  {
    id: 'kutir-craft-village-resort',
    name: 'Kutir Craft Village Resort, Hodka',
    city: 'Hodka',
    rooms: [
      {
        name: 'Non AC Bhunga',
        occupancy: 'Single/Double',
        count: 6,
        rates: { base: { MAPAI: 3500 }, peak: { MAPAI: 4500 } },
      },
      {
        name: 'AC Bhunga',
        occupancy: 'Single/Double',
        count: 3,
        rates: { base: { MAPAI: 4500 }, peak: { MAPAI: 5500 } },
      },
      {
        name: 'Non AC Family Bhunga',
        occupancy: '04 Person',
        count: 5,
        rates: { base: { MAPAI: 6000 }, peak: { MAPAI: 7000 } },
      },
      {
        name: 'AC Family Bhunga',
        occupancy: '04 Person',
        count: 3,
        rates: { base: { MAPAI: 6500 }, peak: { MAPAI: 7500 } },
      },
    ],
    tiers: [
      {
        id: 'peak',
        label: 'Peak Date Rate',
        windows: [
          { from: '2026-11-06', to: '2026-11-13', label: 'Diwali Date' },
          { from: '2026-11-23', to: '2026-11-25', label: 'Nov 2026 – Full Moon' },
          {
            from: '2026-12-20',
            to: '2027-01-27',
            label: 'Christmas Date & Dec 2026 Full Moon / Uttrayan, Republic Day & Jan 2027 Full Moon',
          },
          { from: '2027-02-20', to: '2027-02-22', label: 'Feb 2027 – Full Moon' },
        ],
        mode: 'replace',
      },
    ],
    extraPerson: { base: { MAPAI: 1800 }, peak: { MAPAI: 1800 } },
    extraPersonLabel: 'Extra Bed',
    notes: [
      'Source blackout table merges the "Christmas Date & Dec 2026 Full Moon" row and the "Uttrayan, Republic Day & Jan 2027 Full Moon" row into one shared date cell (20-Dec-2026 to 27-Jan-2027, highlighted in the PDF); encoded as printed.',
    ],
  },
];
