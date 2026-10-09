import type { Lead } from '../types';

/** The exact cohort contributing to dashboard revenue and profit. */
export function isFinancialLead(lead: Pick<Lead, 'status' | 'legacy' | 'wonAt' | 'createdAt'>, start: Date | null = null, end: Date | null = null): boolean {
  if (lead.status !== 'Won' || lead.legacy) return false;
  if (!start && !end) return true;
  const time = new Date(lead.wonAt || lead.createdAt).getTime();
  return Number.isFinite(time) && (!start || time >= start.getTime()) && (!end || time <= end.getTime());
}
