import type { TCTentType } from './rannUtsavRates';

// Operational content from the supplied 2026-27 confirmation vouchers.
// Guest names, PNRs, phone numbers and booking details are intentionally excluded.
export const QUOTATION_CONTACT = {
  name: 'The Tourism Experts', phone: '+91 92747 30220',
  whatsapp: 'https://wa.me/919274730220', email: 'booking@thetourismexperts.com',
  website: 'https://rannutsavtickets.in',
};

export const ROOM_PHOTOS: Record<TCTentType, { hero: string; details: string[]; description: string }> = {
  'Super Premium Tent': { hero: 'sp-bed.jpg', details: ['sp-bed.jpg', 'sp-seating.jpg'], description: 'A spacious stay with comfortable interiors, an attached bathroom and a private porch.' },
  'Premium Tent': { hero: 'premium-hero.jpg', details: ['premium-bed.jpg', 'premium-porch.jpg'], description: 'An air-conditioned tent with a double bed, comfortable interiors and a private porch.' },
  'Deluxe AC Swiss Cottage': { hero: 'deluxe-hero.jpg', details: ['deluxe-seating.jpg', 'deluxe-exterior.jpg'], description: 'An air-conditioned Swiss cottage with a sitting area and an attached bathroom.' },
  'Non-AC Swiss Cottage': { hero: 'nonac-hero.jpg', details: ['nonac-desk.jpg', 'nonac-wardrobe.jpg'], description: 'A Swiss cottage with twin beds, an attached bathroom and a front porch.' },
  'Rajwadi Suite': { hero: 'tent-rajwadi-lg.jpg', details: [], description: 'A private suite with a master bedroom, living room and dining area.' },
  'Darbari Suite': { hero: 'tent-darbari-lg.jpg', details: [], description: 'A private two-bedroom suite with a living room and dining area.' },
};

// Category amenities verified against the supplier accommodation page, 30 September 2026.
export const ROOM_FEATURE_SOURCE = 'https://rannutsav.net/accomodation-at-rann-utsav-kutch/';
export const ROOM_FEATURES: Record<TCTentType, { area: string; highlights: string[]; comparison: string }> = {
  'Super Premium Tent': { area: '473 sq. ft.', highlights: ['Double bed', 'Air conditioning', 'Front porch', 'Sitting area', 'Attached bathroom', 'Luxury toiletries', 'Tea / coffee maker'], comparison: '473 sq. ft. / Double bed / AC\nPorch / Sitting area / Attached bathroom' },
  'Premium Tent': { area: '473 sq. ft.', highlights: ['Double bed', 'Air conditioning', 'Front porch', 'Sitting area', 'Attached bathroom', 'Luxury toiletries', 'Tea / coffee maker'], comparison: '473 sq. ft. / Double bed / AC\nPorch / Sitting area / Attached bathroom' },
  'Deluxe AC Swiss Cottage': { area: '387 sq. ft.', highlights: ['Twin beds', 'Air conditioning', 'Front porch', 'Sitting area', 'Attached bathroom', 'Luxury toiletries', 'Tea / coffee maker'], comparison: '387 sq. ft. / Twin beds / AC\nPorch / Sitting area / Attached bathroom' },
  'Non-AC Swiss Cottage': { area: '387 sq. ft.', highlights: ['Twin beds', 'Non-air-conditioned', 'Front porch', 'Attached bathroom', 'Luxury toiletries', 'Table and two chairs'], comparison: '387 sq. ft. / Twin beds / Non-AC\nFront porch / Attached bathroom' },
  'Rajwadi Suite': { area: '900 sq. ft.', highlights: ['Bedroom / living room', 'Royal sofa set', 'Dressing room', 'Private dining area', 'Express check-in', 'Privilege transfers', 'Luxury toiletries', 'Tea / coffee maker'], comparison: '900 sq. ft. / Bedroom / Living room\nExpress check-in / Privilege transfers' },
  'Darbari Suite': { area: '1,600 sq. ft.', highlights: ['Two bedrooms', 'King-sized beds', 'Royal sofa set', 'Dressing room', 'Private dining area', 'Privilege transfers', 'Luxury toiletries', 'Tea / coffee maker'], comparison: '1,600 sq. ft. / Two bedrooms\nKing-sized beds / Privilege transfers' },
};

export interface QuotationDay { title: string; photos: string[]; entries: [string, string][]; }
const ARRIVAL: QuotationDay = {
  title: 'Welcome to the White Rann', photos: ['rann-sunset-sample-v1.jpg', 'exp-garba-dandiya.jpg'],
  entries: [
    ['12:30 PM onwards', 'Welcome and check-in'], ['12:30 - 2:30 PM', 'Lunch at the dining area'],
    ['2:30 - 4:30 PM', 'Leisure, Club House, craft market, art gallery and activity zones'],
    ['4:00 - 5:00 PM', 'High tea'], ['5:00 PM', 'Depart for Sunset Point'],
    ['5:00 - 7:00 PM', 'White Rann sunset; transfers by bus, camel cart or a combination'],
    ['7:00 - 7:30 PM', 'Return to Tent City'], ['7:30 - 10:00 PM', 'Dinner'],
    ['9:00 - 10:30 PM', 'Kutch cultural programme'],
  ],
};
const KALA: QuotationDay = {
  title: 'Sunrise, crafts and Kala Dungar', photos: ['white-rann.jpg', 'kalo-dungar-aerial.jpg'],
  entries: [
    ['6:00 - 6:30 AM', 'Morning tea / departure for Sunrise Point'],
    ['6:30 - 7:00 AM', 'White Rann sunrise; return at 7:00 AM'],
    ['6:30 - 7:30 AM', 'Yoga session (overlaps the sunrise visit)'],
    ['7:30 - 10:00 AM', 'Breakfast'], ['10:00 AM - 12:30 PM', 'Leisure and activities at Tent City'],
    ['12:30 - 2:30 PM', 'Lunch'], ['2:30 - 3:00 PM', 'Depart for Kala Dungar'],
    ['3:00 - 7:30 PM', 'Kala Dungar via Gandhi Nu Gaam handicraft village; refreshments en route'],
    ['7:30 - 10:00 PM', 'Dinner'], ['9:00 - 10:30 PM', 'Kutch cultural programme'],
  ],
};
const DHOLAVIRA: QuotationDay = {
  title: 'Dholavira and the Road Through Heaven', photos: ['dholavira.jpg', 'road-to-heaven-diagonal.jpg'],
  entries: [
    ['6:00 - 6:30 AM', 'Morning tea'], ['6:30 - 7:30 AM', 'Yoga'],
    ['7:30 - 10:00 AM', 'Breakfast'], ['10:00 AM - 12:30 PM', 'Leisure and activities'],
    ['12:30 - 2:30 PM', 'Lunch; depart for the excursion during this window'],
    ['1:30 - 2:00 PM', 'Depart for Dholavira'], ['2:00 - 3:30 PM', 'Scenic Road Through Heaven; refreshments en route'],
    ['3:30 - 5:30 PM', 'Dholavira archaeological museum and heritage site; museum closed Fridays'],
    ['5:30 - 6:00 PM', 'Tea / coffee and refreshments'], ['6:00 - 6:45 PM', 'Sunset along the Road Through Heaven'],
    ['7:00 - 8:30 PM', 'Return to Tent City'], ['7:30 - 10:00 PM', 'Dinner, according to return time'],
  ],
};
const DEPARTURE: QuotationDay = {
  title: 'Breakfast and onward journey', photos: [],
  entries: [
    ['6:00 - 6:30 AM', 'Morning tea'], ['6:30 - 7:30 AM', 'Yoga'],
    ['7:30 - 10:00 AM', 'Breakfast'], ['9:30 AM', 'Check-out'],
    ['11:30 AM - 2:00 PM', 'Complimentary Swaminarayan Temple and Kutch Museum visit; museum closed Wednesdays'],
  ],
};

export function quotationItinerary(nights: 1 | 2 | 3): QuotationDay[] {
  return nights === 1 ? [ARRIVAL, DEPARTURE] : nights === 2 ? [ARRIVAL, KALA, DEPARTURE] : [ARRIVAL, KALA, DHOLAVIRA, DEPARTURE];
}

// A readable, one-page guest programme. Adjacent operational entries are grouped
// into sessions; full voucher timings remain available in quotationItinerary.
export function quotationCompactItinerary(nights: 1 | 2 | 3): QuotationDay[] {
  const days = quotationItinerary(nights);
  const arrival: QuotationDay = { ...days[0], entries: [
    ['12:30 - 2:30 PM', 'Check-in from 12:30 PM, followed by lunch.'],
    ['2:30 - 5:00 PM', 'Leisure, crafts and activities; high tea 4:00-5:00 PM.'],
    ['5:00 - 7:00 PM', 'Depart at 5:00 PM for White Rann sunset by bus / camel cart.'],
    ['7:00 - 7:30 PM', 'Return to Tent City.'],
    ['7:30 - 10:00 PM', 'Dinner at the dining area.'],
    ['9:00 - 10:30 PM', 'Kutch cultural programme.'],
  ] };
  const kala: QuotationDay = { ...KALA, photos: ['rann-sunrise-sample-v1.jpg'], entries: [
    ['6:00 - 7:30 AM', 'Tea 6:00-6:30 AM; sunrise visit 6:30-7:00 AM; yoga 6:30-7:30 AM (overlaps).'],
    ['7:30 - 10:00 AM', 'Breakfast.'],
    ['10:00 AM - 2:30 PM', 'Leisure until 12:30 PM, then lunch.'],
    ['2:30 - 7:30 PM', 'Depart 2:30-3:00 PM for Kala Dungar via Gandhi Nu Gaam; refreshments en route.'],
    ['7:30 - 10:00 PM', 'Dinner.'],
    ['9:00 - 10:30 PM', 'Kutch cultural programme.'],
  ] };
  const dholavira: QuotationDay = { ...DHOLAVIRA, photos: ['road-to-heaven-diagonal.jpg'], entries: [
    ['6:00 - 10:00 AM', 'Tea 6:00-6:30 AM; yoga 6:30-7:30 AM; breakfast 7:30-10:00 AM.'],
    ['10:00 AM - 2:30 PM', 'Leisure until 12:30 PM, then lunch. Depart 1:30-2:00 PM.'],
    ['2:00 - 3:30 PM', 'Road Through Heaven scenic drive and refreshments.'],
    ['3:30 - 5:30 PM', 'Dholavira archaeological museum and heritage site; museum closed Fridays.'],
    ['5:30 - 6:45 PM', 'Refreshments until 6:00 PM; Road Through Heaven sunset 6:00-6:45 PM.'],
    ['7:00 - 10:00 PM', 'Return 7:00-8:30 PM; dinner 7:30-10:00 PM, as per return time.'],
  ] };
  const departure: QuotationDay = { ...DEPARTURE, photos: ['dhordo-tent-city.jpg'], entries: [
    ['6:00 - 7:30 AM', 'Morning tea 6:00-6:30 AM; yoga 6:30-7:30 AM.'],
    ['7:30 - 10:00 AM', 'Breakfast.'], ['9:30 AM', 'Check-out and onward transfer.'],
    ['11:30 AM - 2:00 PM', 'Swaminarayan Temple and Kutch Museum visit; museum closed Wednesdays.'],
  ] };
  return nights === 1 ? [arrival, departure] : nights === 2 ? [arrival, kala, departure] : [arrival, kala, dholavira, departure];
}

export const TRANSFERS = {
  arrival: ['8:15 AM', '10:00 AM', '1:30 PM', '3:30 PM', '5:30 PM'],
  departure: ['4:30 AM', '9:30 AM'],
  notes: [
    'Scheduled AC coach transfers between Bhuj Railway Station / Bhuj Airport and Tent City. Timings are subject to change; seats are first-come, first-served.',
    'Bhuj to Dhordo: approximately 85 km / 1 hour 45 minutes. Private transfers and transfers outside fixed timings are chargeable.',
    'For Evoke Dholavira guests only: pickup from Evoke Dholavira at 10:00 AM; departure from Tent City to Evoke Dholavira at 9:30 AM.',
    'Early departures may miss breakfast and the complimentary Bhuj sightseeing. Confirm arrangements against your onward journey.',
  ],
};

export const POLICY_SUMMARY = [
  'Cancellation 30 or more days before arrival: 90% refund. 15-29 days: 60% refund. Less than 15 days: no refund.',
  'Check-in date change: 10% of the booking amount. Primary guest name change or category downgrade after booking: 5% each.',
  'A date change is permitted once, more than 72 hours before check-in. Requests within 72 hours are treated under the cancellation policy.',
  'Present the booking voucher and valid government photo ID for each guest at check-in; foreign guests require passport and visa / OCI documentation.',
  'Early tent allotment is subject to availability. Delayed flights / trains use the next available transfer; missed meals and activities are not compensated.',
  'Itineraries and sightseeing timings are indicative and may change with weather, sunset timings or operational circumstances.',
  'Flight / train cancellation does not make the accommodation booking refundable. Personal expenses and chargeable activities are payable separately.',
];

export interface BudgetKutchPackage {
  id: string; name: string; nights: 1 | 2 | 3 | 4; photo: string;
  highlights: string[]; total: number; priceBasis: string; taxNote: string;
}
// Populate with the user's actual Kutch packages; Tent City tariffs are not
// substituted for separate budget itineraries, especially the four-night option.
export const BUDGET_KUTCH_PACKAGES: BudgetKutchPackage[] = [];
