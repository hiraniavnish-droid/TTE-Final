
// Peak date pricing engine for Kutch/Gujarat 2025-26 season
// Source: B2B Rate Sheet 2025-26

export interface PeakPeriod {
  name: string;
  start: string; // 'YYYY-MM-DD'
  end: string;   // 'YYYY-MM-DD' (inclusive)
}

// Consolidated peak/blackout periods across all Kutch hotels
export const KUTCH_PEAK_PERIODS: PeakPeriod[] = [
  { name: 'Diwali',                       start: '2025-10-15', end: '2025-10-26' },
  { name: 'Full Moon (Nov)',               start: '2025-11-04', end: '2025-11-06' },
  { name: 'Full Moon (Dec)',               start: '2025-12-03', end: '2025-12-05' },
  { name: 'Christmas & New Year',          start: '2025-12-20', end: '2026-01-05' },
  { name: 'Makar Sankranti / Uttrayan',   start: '2026-01-10', end: '2026-01-15' },
  { name: 'Republic Day',                  start: '2026-01-24', end: '2026-01-27' },
  { name: 'Full Moon (Feb)',               start: '2026-01-31', end: '2026-02-02' },
  { name: 'Full Moon (Mar)',               start: '2026-03-02', end: '2026-03-04' },
];

// Per-hotel peak rate supplement (₹ per room per night above standard rate)
// Based on blackout/peak date rates in the 2025-26 B2B Rate Sheet
export const HOTEL_PEAK_SUPPLEMENTS: Record<string, number> = {
  // BHUJ
  'Times Square Spa and Resort': 2000,
  'Seven Sky Clarks Exotica': 1000,
  'Floating Deck Resort': 1500,
  'Hill View Resort': 1500,
  'Ramee The Srinivas Palace': 1000,
  'Hotel LA CASA DE RANN': 1300,
  'Hotel Ilark': 1000,
  'Dream Resort': 1000,
  'Canyon Inn': 1000,
  'Kutch Elegance': 1000,
  // MANDVI
  'Serena Beach Resort': 1700,
  'Vijay Vilas Heritage Resort': 1600,
  // DHOLAVIRA
  'Rann Resort Dholavira': 1000,
  'Heritage Resort Dholavira': 1000,
  'Road To Heaven Resort': 1000,
  // DHORDO / HODKA
  'Rann Heritage Resort': 1000,
  'Kutch Classic Resort Camp': 1300,
  'Mahefeel-E-Rann Resort': 850,
  'Desert King Resort': 1000,
  'Rann Visamo Village Resort': 400,
  'Kutir Craft Village Resort': 800,
  'Shaam-E-Sarhad Village Resort': 700,
};

export const getDatePeakPeriod = (dateStr: string): PeakPeriod | null => {
  const d = new Date(dateStr + 'T00:00:00');
  return KUTCH_PEAK_PERIODS.find(p => {
    return d >= new Date(p.start + 'T00:00:00') && d <= new Date(p.end + 'T00:00:00');
  }) ?? null;
};

export const getPeakSupplement = (hotelName: string, dateStr: string): number => {
  const period = getDatePeakPeriod(dateStr);
  if (!period) return 0;
  return HOTEL_PEAK_SUPPLEMENTS[hotelName] ?? 0;
};

// Returns unique peak periods that overlap any day of the trip
export const getTripPeakPeriods = (startDate: string, days: number): PeakPeriod[] => {
  const seen = new Set<string>();
  const result: PeakPeriod[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const p = getDatePeakPeriod(iso);
    if (p && !seen.has(p.name)) {
      seen.add(p.name);
      result.push(p);
    }
  }
  return result;
};

export const getDayDateStr = (startDate: string, dayIndex: number): string => {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().split('T')[0];
};
