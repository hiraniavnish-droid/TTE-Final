/** Namak 2026-27 tariff: supplied brochure pp. 9-10 and approved resort website. */
export const NAMAK_CATEGORIES = {
  premium: { name: 'Premium Tent', base: 8500, extra: 2500, area: '392 sq ft', inventory: 10 },
  superPremium: { name: 'Super Premium Tent', base: 10500, extra: 2500, area: '520 sq ft', inventory: 10 },
  darbari: { name: 'Darbari Suite', base: 28000, extra: 6000, area: '1,200 sq ft', inventory: 1 },
} as const;
export type NamakCategory = keyof typeof NAMAK_CATEGORIES;
export interface NamakInput {
  guestName: string; reference: string; category: NamakCategory; checkIn: string;
  nights: number; rooms: number; extraPersons: number; discountPct: number; gstPct: number | null;
}
export const NAMAK_INCLUSIONS = {
  tents: ['Breakfast, hi-tea and dinner', 'Cultural programme'],
  darbari: ['All meals', 'Priority check-in', 'Pickup, drop-off, sightseeing and transfers as per confirmed itinerary', 'Complimentary early check-in and late checkout, subject to availability'],
};
export const namakMoney = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function addNamakDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const namakDate = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function namakSupplement(date: string) {
  if ((date >= '2026-11-22' && date <= '2026-11-25') || (date >= '2027-02-18' && date <= '2027-02-21')) return { amount: 1500, label: 'Full moon' };
  if ((date >= '2026-12-18' && date <= '2026-12-31') || (date >= '2027-01-20' && date <= '2027-01-23')) return { amount: 3000, label: 'Premium dates' };
  return { amount: 0, label: 'Standard' };
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function quoteNamak(input: NamakInput) {
  const category = NAMAK_CATEGORIES[input.category];
  if (!category) throw new Error('Choose an accommodation category.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.checkIn) || !Number.isFinite(Date.parse(`${input.checkIn}T00:00:00Z`)) || addNamakDays(input.checkIn, 0) !== input.checkIn) throw new Error('Choose a valid check-in date.');
  for (const [label, n, min, max] of [['Nights', input.nights, 1, 28], ['Tents / suites', input.rooms, 1, category.inventory], ['Extra guests', input.extraPersons, 0, 40]] as const) {
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  if (!Number.isFinite(input.discountPct) || input.discountPct < 0 || input.discountPct > 100) throw new Error('Discount must be between 0% and 100%.');
  if (input.gstPct !== null && (!Number.isFinite(input.gstPct) || input.gstPct < 0 || input.gstPct > 100)) throw new Error('Enter a valid GST percentage.');
  const checkOut = addNamakDays(input.checkIn, input.nights);
  if (input.checkIn < '2026-11-01' || addNamakDays(checkOut, -1) > '2027-02-28') throw new Error('Published tariff covers nights from 1 Nov 2026 to 28 Feb 2027.');
  const nightly = Array.from({ length: input.nights }, (_, i) => {
    const date = addNamakDays(input.checkIn, i); const band = namakSupplement(date);
    const supplement = input.category === 'darbari' ? 0 : band.amount;
    return { date, base: category.base, supplement, label: input.category === 'darbari' ? 'Fixed suite tariff' : band.label, perRoom: category.base + supplement, roomTotal: (category.base + supplement) * input.rooms };
  });
  const roomRent = nightly.reduce((sum, n) => sum + n.roomTotal, 0);
  const discount = round(roomRent * input.discountPct / 100);
  const extras = input.extraPersons * category.extra * input.nights;
  const subtotal = round(roomRent - discount + extras);
  const gst = input.gstPct === null ? null : round(subtotal * input.gstPct / 100);
  return { ...input, checkOut, nightly, roomRent, discount, extras, subtotal, gst, total: gst === null ? subtotal : round(subtotal + gst), guests: input.rooms * 2 + input.extraPersons, roomNights: input.rooms * input.nights, inclusions: input.category === 'darbari' ? NAMAK_INCLUSIONS.darbari : NAMAK_INCLUSIONS.tents };
}
export type NamakQuote = ReturnType<typeof quoteNamak>;
export function namakMessage(q: NamakQuote) {
  return [ '*Namak Resort | Rann of Kutch*', q.guestName ? `Prepared for: ${q.guestName}` : '', q.reference ? `Reference: ${q.reference}` : '', '', `*${NAMAK_CATEGORIES[q.category].name}*`, `${namakDate(q.checkIn)} to ${namakDate(q.checkOut)} | ${q.nights} night(s)`, `${q.rooms} tent(s) / suite(s) | ${q.guests} guests (${q.extraPersons} extra)`, '', `Accommodation: ${namakMoney(q.roomRent)}`, q.discount ? `Room discount (${q.discountPct}%): -${namakMoney(q.discount)}` : '', q.extras ? `Extra guests: ${namakMoney(q.extras)}` : '', q.gst === null ? `*Stay total: ${namakMoney(q.total)} + applicable GST*` : `GST (${q.gstPct}%): ${namakMoney(q.gst)}\n*Grand total: ${namakMoney(q.total)}*`, '', '*Included*', ...q.inclusions.map(x => `• ${x}`), '', q.category !== 'darbari' ? 'Lunch, transport and sightseeing are not included in this quotation.' : 'Transfer routes and sightseeing follow the confirmed itinerary.', 'Subject to availability. Room capacity, child policy, check-in/out timings and booking terms must be confirmed before payment.' ].filter(Boolean).join('\n');
}
