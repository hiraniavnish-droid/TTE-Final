// ============================================================
// Statue of Unity Hotels — comparison message (CLIENT-FACING).
//
// Kept separate from the page for the same reason as rannCompareMessage.ts:
// CompareMessageInput carries only the client-facing selling price, never
// netTotal/markupAmount, so no edit here can leak an internal figure.
//
// Golf Cart / E-Rickshaw are printed as a flat reference footer — their own
// full-day charge, never divided per person, never added into any total —
// per explicit instruction that these must never be part of a fixed package
// or per-person calculation, only mentioned for the client's own knowledge.
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

export const fmtCompareDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtINR = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Groups ticked cells by hotel, nights ascending inside each group, groups
 *  ordered cheapest-first by the lowest ticked figure in the group. */
export function groupCompareHotelRates(rates: CompareHotelRate[]): CompareHotelGroup[] {
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
      lowest: sorted.reduce((m, r) => Math.min(m, r.sellingTotal), Infinity),
    });
  });
  groups.sort((a, b) => a.lowest - b.lowest);
  return groups;
}

function transportReferenceLines(): string[] {
  const { eRickshaw, golfCart } = TRANSPORT_REFERENCE;
  return [
    `${eRickshaw.label}: ${fmtINR(eRickshaw.perVehicle)}/vehicle (seats ${eRickshaw.capacity})`,
    `${golfCart.label}: ${fmtINR(golfCart.perVehicle)}/vehicle (seats ${golfCart.capacity})`,
  ];
}

/** The WhatsApp / clipboard text. Returns '' when nothing is ticked. */
export function buildSouCompareMessage(i: SouCompareMessageInput): string {
  const groups = groupCompareHotelRates(i.rates);
  if (groups.length === 0) return '';

  const L: string[] = [];
  L.push('*THE TOURISM EXPERTS*');
  L.push('*Statue of Unity — Kevadiya Hotels*');
  L.push('');
  L.push(`Check-in: ${fmtCompareDate(i.checkIn)}`);
  L.push(`${i.pax} guest(s) · ${i.rooms} room(s)`);

  for (const g of groups) {
    L.push('');
    L.push(`*${g.hotelName}*${g.starLabel ? ` (${g.starLabel})` : ''}`);
    L.push(g.rates.map(r => `${r.nights}N ${fmtINR(r.sellingTotal)}`).join('  ·  '));
  }

  if (i.itinerary) {
    const it = i.itinerary;
    L.push('');
    L.push(`*Sightseeing package — ${it.plan.label}*`);
    L.push(`${fmtINR(it.sellingTotal)} for ${it.pax} guest(s) (${fmtINR(it.sellingPerPerson)}/person)`);
    L.push(it.plan.ticketItems.map(t => t.name).join(', '));
    if (it.transferNetTotal > 0) {
      L.push('Includes railway station transfer.');
    }
    L.push('');
    L.push('_For your reference — not included in the package above:_');
    transportReferenceLines().forEach(line => L.push(`_${line}_`));
  }

  L.push('');
  L.push('All rates include GST.');
  L.push('The Tourism Experts');
  return L.join('\n');
}
