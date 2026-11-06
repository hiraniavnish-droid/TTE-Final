import { localStore, readStoredArray } from '../../lib/browserStorage';

const KEY = 'tte_recent_quotes';
const MAX = 6;

export interface RecentQuote {
  id: string;
  guestName: string;
  pax: number;
  packageName: string;
  packageId: string;
  tier: 'Budget' | 'Premium';
  total: number;
  startDate: string;
  savedAt: string;
}

export const loadRecentQuotes = (): RecentQuote[] => {
  return readStoredArray<RecentQuote>(localStore, KEY, q => q && typeof q.id === 'string' && typeof q.guestName === 'string' && typeof q.packageId === 'string' && typeof q.packageName === 'string');
};

export const saveRecentQuote = (q: Omit<RecentQuote, 'id' | 'savedAt'>) => {
  const existing = loadRecentQuotes();
  const entry: RecentQuote = { ...q, id: `${Date.now()}`, savedAt: new Date().toISOString() };
  // Remove duplicate same guest+package
  const deduped = existing.filter(e => !(e.guestName === q.guestName && e.packageId === q.packageId));
  const updated = [entry, ...deduped].slice(0, MAX);
  try {
    localStore.setItem(KEY, JSON.stringify(updated));
  } catch {}
  return updated;
};
