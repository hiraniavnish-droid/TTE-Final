
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
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

export const saveRecentQuote = (q: Omit<RecentQuote, 'id' | 'savedAt'>) => {
  const existing = loadRecentQuotes();
  const entry: RecentQuote = { ...q, id: `${Date.now()}`, savedAt: new Date().toISOString() };
  // Remove duplicate same guest+package
  const deduped = existing.filter(e => !(e.guestName === q.guestName && e.packageId === q.packageId));
  const updated = [entry, ...deduped].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
  return updated;
};
