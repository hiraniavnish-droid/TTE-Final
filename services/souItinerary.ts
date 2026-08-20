// ============================================================
// Statue of Unity / Kevadiya — sightseeing itinerary add-on.
//
// Transcribed verbatim from the supplier sheet (screenshot, Aug 2026): two
// fixed ticket bundles, 1N2D and 2N3D, each a flat list of attractions with a
// per-person cost (₹0 for the ones the sheet marks free/included).
//
// Golf Cart and E-Rickshaw (E-Auto) are DELIBERATELY NOT part of this
// pricing — per the user's explicit instruction, these are always shown as a
// reference-only footnote (their own full-day charge, never divided into a
// per-person figure baked into the package) and never summed into any total,
// fixed-package price, or per-person calculation. See TRANSPORT_NOTE below;
// souItineraryMessage.ts is the only place that note is rendered, and it is
// kept structurally separate from the priced total for that reason.
// ============================================================

export interface SouTicketItem {
  name: string;
  /** ₹ per person. 0 = sheet marks it free/included. */
  costPerPerson: number;
}

export type SouItineraryNights = 1 | 2;

export interface SouItineraryPlan {
  nights: SouItineraryNights;
  label: string; // '1N2D' | '2N3D'
  ticketItems: SouTicketItem[];
}

export const SOU_ITINERARIES: Record<SouItineraryNights, SouItineraryPlan> = {
  1: {
    nights: 1,
    label: '1N2D',
    ticketItems: [
      { name: 'Jungle Safari', costPerPerson: 200 },
      { name: 'Entry Tickets + Viewing Gallery', costPerPerson: 380 },
      { name: 'Dam View', costPerPerson: 0 },
      { name: 'Valley of Flowers', costPerPerson: 0 },
      { name: 'Laser Show (subject to availability)', costPerPerson: 0 },
      { name: 'Narmada Aarti', costPerPerson: 0 },
    ],
  },
  2: {
    nights: 2,
    label: '2N3D',
    ticketItems: [
      { name: 'Entry Tickets + Viewing Gallery', costPerPerson: 380 },
      { name: 'Jungle Safari', costPerPerson: 200 },
      { name: 'Aarogya Van', costPerPerson: 50 },
      { name: 'Cactus Garden', costPerPerson: 30 },
      { name: 'Butterfly Garden', costPerPerson: 30 },
      { name: 'Miyaki Forest', costPerPerson: 50 },
      { name: 'Ekta Nursery', costPerPerson: 50 },
      { name: 'Narmada Aarti', costPerPerson: 0 },
      { name: 'Laser Show (subject to availability)', costPerPerson: 0 },
      { name: 'Dam View', costPerPerson: 0 },
    ],
  },
};

/** Optional local transfer, included in the priced total only when picked. */
export const RAILWAY_TRANSFER_PER_PERSON = 500;

// Reference-only, never priced into anything — see file header.
export const TRANSPORT_REFERENCE = {
  eRickshaw: { label: 'E-Rickshaw (full day)', perVehicle: 2100, capacity: 3 },
  golfCart: { label: 'Golf Cart (full day)', perVehicle: 5000, capacity: 5 },
};

/** ₹ per person per day — the agency's handling/service charge on this
 *  add-on package. "Day" = nights + 1, matching how the sheet itself counts
 *  (1N2D = 1 night, 2 days; 2N3D = 2 nights, 3 days). */
export const ITINERARY_MARKUP_PER_PAX_PER_DAY = 100;

export interface SouItineraryPriceInput {
  nights: SouItineraryNights;
  pax: number;
  includeRailwayTransfer: boolean;
}

export interface SouItineraryPrice {
  plan: SouItineraryPlan;
  pax: number;
  days: number;
  ticketNetPerPerson: number;
  ticketNetTotal: number;
  transferNetTotal: number;
  netTotal: number;
  markupTotal: number;
  sellingTotal: number;
  sellingPerPerson: number;
}

export function priceSouItinerary(input: SouItineraryPriceInput): SouItineraryPrice {
  const plan = SOU_ITINERARIES[input.nights];
  const days = input.nights + 1;
  const ticketNetPerPerson = plan.ticketItems.reduce((sum, t) => sum + t.costPerPerson, 0);
  const ticketNetTotal = ticketNetPerPerson * input.pax;
  const transferNetTotal = input.includeRailwayTransfer ? RAILWAY_TRANSFER_PER_PERSON * input.pax : 0;
  const netTotal = ticketNetTotal + transferNetTotal;
  const markupTotal = ITINERARY_MARKUP_PER_PAX_PER_DAY * input.pax * days;
  const sellingTotal = netTotal + markupTotal;
  return {
    plan, pax: input.pax, days,
    ticketNetPerPerson, ticketNetTotal, transferNetTotal, netTotal, markupTotal,
    sellingTotal,
    sellingPerPerson: Math.round(sellingTotal / input.pax),
  };
}
