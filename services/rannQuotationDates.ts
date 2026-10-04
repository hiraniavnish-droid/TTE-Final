import { quoteTentCity, TC_SEASON, tcTier } from './rannUtsavRates';
import { addLocalDays } from './rannItinerary';
import type { RannQuotationModel } from './rannQuotationPdf';

// Event windows are from the supplied 2026-27 supplier brochure, not astronomical dates.
export function quotationDateEvent(date: Date): string {
  const m = date.getMonth(), d = date.getDate();
  const events: string[] = [];
  if (m === 10 && d >= 8 && d <= 14) events.push('Diwali');
  if ((m === 10 && d >= 22 && d <= 25) || (m === 11 && d >= 21 && d <= 24) || (m === 0 && d >= 20 && d <= 23) || (m === 1 && d >= 18 && d <= 21)) events.push('Full-moon period');
  if ((m === 11 && d >= 18) || (m === 0 && d <= 2)) events.push('Christmas / New Year');
  if ((m === 10 && d === 9) || (m === 11 && d === 8) || (m === 0 && d === 7) || (m === 1 && d === 6)) events.push('Dark moon');
  return events.join(' + ') || 'Non-festive dates';
}
export const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export function quotationDateOptions(model: RannQuotationModel) {
  const candidates = Array.from({ length: 61 }, (_, i) => i - 30).filter(offset => offset !== 0).map(offset => {
    const date = addLocalDays(model.checkIn, offset);
    if (date < TC_SEASON.start || addLocalDays(date, model.nights - 1) > TC_SEASON.end) return null;
    const quote = quoteTentCity({ tent: model.category, checkIn: date, nights: model.nights, rooms: model.rooms, single: model.single, extraMattress: model.extraMattresses, discountPct: model.discountPct, commissionPct: 0 });
    return { date, offset, total: quote.sellingPrice, difference: quote.sellingPrice - model.price.total, event: quotationDateEvent(date), tier: tcTier(date) };
  }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
  const chosen: typeof candidates = [];
  const take = (predicate: (c: typeof candidates[number]) => boolean) => {
    const c = candidates.find(c => !chosen.includes(c) && predicate(c));
    if (c) chosen.push(c);
  };
  take(c => c.difference < 0 && c.offset < 0);
  take(c => c.difference < 0 && c.offset > 0);
  take(c => c.event !== quotationDateEvent(model.checkIn) && c.event !== 'Non-festive dates');
  while (chosen.length < 3 && chosen.length < candidates.length) {
    take(c => !chosen.some(o => o.total === c.total && o.event === c.event));
    if (chosen.length < 3 && !candidates.some(c => !chosen.includes(c) && !chosen.some(o => o.total === c.total && o.event === c.event))) take(() => true);
  }
  return chosen.slice(0, 3).sort((a, b) => a.date.getTime() - b.date.getTime());
}
