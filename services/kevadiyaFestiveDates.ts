// ============================================================
// Kevadiya (Statue of Unity) — festive/blackout date ranges, for display
// only.
//
// NOT an authoritative festival calendar and NOT computed from any date
// logic — every range here is transcribed directly from the supplement/
// blackout notes already stored on individual hotels in inlandData.ts
// (Enrise, Fortune SOU, Villa Euphoria, Soil to Soul, Regenta, Hotel Sai
// Inn), unioned where multiple hotels give slightly different windows for
// the same real festival. Purely a caution aid for the date picker — an
// agent should still confirm with the specific hotel, since suppliers do
// not always agree on the exact days a surcharge applies.
//
// One stale range was deliberately dropped: The Fern Sardar Sarovar's own
// headerNote prints "Diwali period — 18 Oct to 25 October 2025" and a
// "23rd Jan till 26th Jan-2026" Republic Day window — both already in the
// past relative to any date this picker would ever show, evidently a
// leftover from an earlier sheet revision. Carrying those forward would
// mislead rather than caution, so they are excluded here.
// ============================================================

export interface FestiveRange {
  start: string; // ISO yyyy-mm-dd, inclusive
  end: string;   // ISO yyyy-mm-dd, inclusive
  label: string;
  source: string; // which hotel(s) this was transcribed from
}

export const KEVADIYA_FESTIVE_RANGES: FestiveRange[] = [
  { start: '2026-08-14', end: '2026-08-16', label: 'Independence Day', source: 'Fortune SOU, Enrise' },
  { start: '2026-08-28', end: '2026-08-30', label: 'Raksha Bandhan', source: 'Fortune SOU' },
  { start: '2026-09-04', end: '2026-09-07', label: 'Janmashtami', source: 'Enrise, Fortune SOU, Soil to Soul' },
  { start: '2026-10-02', end: '2026-10-02', label: 'Gandhi Jayanti', source: 'Villa Euphoria' },
  { start: '2026-10-09', end: '2026-10-25', label: 'Long weekend / link holidays', source: 'Villa Euphoria, Hotel Sai Inn' },
  { start: '2026-11-04', end: '2026-11-15', label: 'Diwali', source: 'Fortune SOU, Enrise, Villa Euphoria, Soil to Soul' },
  { start: '2026-12-20', end: '2027-01-05', label: 'Christmas & New Year', source: 'Regenta, Fortune SOU, Enrise, Soil to Soul, Hotel Sai Inn' },
  { start: '2027-01-26', end: '2027-01-27', label: 'Republic Day', source: 'Villa Euphoria' },
  { start: '2027-02-12', end: '2027-02-14', label: 'February long weekend', source: 'Villa Euphoria' },
  { start: '2027-03-05', end: '2027-03-07', label: 'March long weekend', source: 'Villa Euphoria' },
  { start: '2027-03-19', end: '2027-03-24', label: 'Holi period', source: 'Fortune SOU, Villa Euphoria' },
];

/** Every festive range whose window includes this ISO date, if any. A date
 *  can fall in more than one (e.g. an overlap between two hotels' windows
 *  for the same real occasion), so this always returns an array. */
export function festiveRangesFor(iso: string): FestiveRange[] {
  return KEVADIYA_FESTIVE_RANGES.filter(r => iso >= r.start && iso <= r.end);
}
