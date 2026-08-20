// ============================================================
// Statue of Unity Hotels — comparison message (CLIENT-FACING).
//
// Kept separate from the page for the same reason as rannCompareMessage.ts:
// CompareMessageInput carries only the client-facing selling price, never
// netTotal/markupAmount, so no edit here can leak an internal figure.
//
// When a sightseeing package is included, the hotel total and the package
// total are combined into ONE figure per option — the client is buying one
// package, not a hotel bill plus a separate ticket bill — per explicit
// instruction: "it should not give hotel rate separate and the package rate
// separate." The itinerary content itself (what's included) is printed once,
// since it is the same package regardless of which hotel option it rides on.
//
// Golf Cart / E-Rickshaw are printed as a flat reference footer — their own
// full-day charge, never divided per person, never added into any total —
// per explicit instruction that these must never be part of a fixed package
// or per-person calculation, only mentioned for the client's own knowledge.
//
// Checkout time (11:00 AM) and check-in time (2:00 PM) are the standard
// convention used across Indian hotels generally — no per-hotel checkout
// time is printed anywhere in the supplier sheets, so this is stated as a
// general convention, not attributed to a specific hotel's own policy.
// ============================================================

import type { SouOptionNights } from './souHotelOptions';
import { TRANSPORT_REFERENCE, type SouItineraryPrice } from './souItinerary';

export interface CompareHotelRate {
  hotelId: string;
  hotelName: string;
  starLabel?: string;
  nights: SouOptionNights;
  sellingTotal: number;
}

export interface SouCompareMessageInput {
  checkIn: string; // ISO yyyy-mm-dd
  rooms: number;
  pax: number;
  rates: CompareHotelRate[];
  itinerary: SouItineraryPrice | null; // null = itinerary not included
}

export interface CompareHotelGroup {
  hotelId: string;
  hotelName: string;
  starLabel?: string;
  rates: CompareHotelRate[];
  lowest: number;
}

// Local date arithmetic only — the UTC-based ISO serialiser is banned in this
// repo because it rolls an IST date back a day.
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export const fmtCompareDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtINR = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

const starEmoji = (starLabel: string | undefined): string => {
  const m = /^(\d+)\s*star/i.exec((starLabel || '').trim());
  return m ? '⭐'.repeat(Math.min(5, Number(m[1]))) : '';
};

// Best-effort emoji per ticket item, purely decorative — falls back to a
// generic pin when a name doesn't match anything below. Never affects price
// or the item's printed name, only what's prefixed to it in the message.
const ITEM_EMOJI: [RegExp, string][] = [
  [/jungle safari/i, '🦁'],
  [/viewing gallery|entry ticket/i, '🗽'],
  [/dam view/i, '🌊'],
  [/valley of flowers/i, '🌸'],
  [/laser show/i, '🎇'],
  [/narmada aarti/i, '🪔'],
  [/aarogya van/i, '🌿'],
  [/cactus garden/i, '🌵'],
  [/butterfly garden/i, '🦋'],
  [/miyaki|miyawaki|forest/i, '🌳'],
  [/nursery/i, '🌱'],
];
const itemEmoji = (name: string): string => (ITEM_EMOJI.find(([re]) => re.test(name))?.[1]) || '📍';

/** Groups ticked cells by hotel, nights ascending inside each group, groups
 *  ordered cheapest-first by the lowest COMBINED (hotel + package) figure —
 *  the number the client actually sees first for that group. */
export function groupCompareHotelRates(rates: CompareHotelRate[], itineraryTotal: number): CompareHotelGroup[] {
  const byHotel = new Map<string, CompareHotelRate[]>();
  for (const r of rates) {
    const list = byHotel.get(r.hotelId);
    if (list) list.push(r); else byHotel.set(r.hotelId, [r]);
  }
  const groups: CompareHotelGroup[] = [];
  byHotel.forEach((rs, hotelId) => {
    const sorted = rs.slice().sort((a, b) => a.nights - b.nights);
    groups.push({
      hotelId, hotelName: sorted[0].hotelName, starLabel: sorted[0].starLabel,
      rates: sorted,
      lowest: sorted.reduce((m, r) => Math.min(m, r.sellingTotal + itineraryTotal), Infinity),
    });
  });
  groups.sort((a, b) => a.lowest - b.lowest);
  return groups;
}

function transportReferenceLines(): string[] {
  const { eRickshaw, golfCart } = TRANSPORT_REFERENCE;
  return [
    `🛺 ${eRickshaw.label}: ${fmtINR(eRickshaw.perVehicle)}/vehicle (seats ${eRickshaw.capacity})`,
    `🛻 ${golfCart.label}: ${fmtINR(golfCart.perVehicle)}/vehicle (seats ${golfCart.capacity})`,
  ];
}

const DIVIDER = '━━━━━━━━━━━━━━━';

/** The WhatsApp / clipboard text. Returns '' when nothing is ticked. */
export function buildSouCompareMessage(i: SouCompareMessageInput): string {
  const itineraryTotal = i.itinerary?.sellingTotal ?? 0;
  const groups = groupCompareHotelRates(i.rates, itineraryTotal);
  if (groups.length === 0) return '';

  const L: string[] = [];
  L.push('🌟 *THE TOURISM EXPERTS* 🌟');
  L.push('🏛️ *Statue of Unity — Kevadiya*');
  L.push('');
  L.push(`👥 ${i.pax} guest(s)  ·  🛏️ ${i.rooms} room(s)`);

  groups.forEach((g, gi) => {
    L.push('');
    L.push(DIVIDER);
    L.push(`🏨 *Option ${gi + 1}: ${g.hotelName}* ${starEmoji(g.starLabel)}`.trim());
    L.push(DIVIDER);
    g.rates.forEach(r => {
      const checkOutIso = addDaysISO(i.checkIn, r.nights);
      const combined = r.sellingTotal + itineraryTotal;
      const perPerson = Math.round(combined / i.pax);
      L.push('');
      L.push(`🌙 *${r.nights}N / ${r.nights + 1}D*${i.itinerary ? ' — Statue of Unity KV Package' : ''}`);
      L.push(`📅 Check-in: ${fmtCompareDate(i.checkIn)} (after 2:00 PM)`);
      L.push(`📅 Check-out: ${fmtCompareDate(checkOutIso)} (by 11:00 AM)`);
      L.push(`💰 *${fmtINR(combined)}* total  (₹${fmtINR(perPerson).slice(1)}/person)`);
    });
  });

  if (i.itinerary) {
    const it = i.itinerary;
    L.push('');
    L.push(DIVIDER);
    L.push(`🗺️ *What's Included — ${it.plan.label} Sightseeing Package*`);
    L.push(DIVIDER);
    it.plan.ticketItems.forEach((t, idx) => {
      L.push(`${idx + 1}. ${itemEmoji(t.name)} ${t.name}`);
    });
    if (it.transferNetTotal > 0) {
      L.push(`${it.plan.ticketItems.length + 1}. 🚕 Railway station transfer`);
    }
    L.push('');
    L.push('_For your reference — not included in the package above:_');
    transportReferenceLines().forEach(line => L.push(`_${line}_`));
  }

  L.push('');
  L.push(DIVIDER);
  L.push('✅ All rates include GST');
  L.push('📞 The Tourism Experts');
  return L.join('\n');
}
