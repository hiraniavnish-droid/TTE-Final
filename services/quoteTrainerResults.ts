// ============================================================
// Quotation Trainer — persisted session results.
//
// One row per COMPLETED session, never per question — the trainee's own
// view never lists individual questions (per design), only the aggregate.
// `detail` is stored anyway (admin/debugging only, never rendered to the
// trainee) since it costs nothing extra and answers "which questions is
// everyone getting wrong" later without needing a schema change.
//
// avg_time_correct_sec is computed over CORRECT answers only: a wrong
// answer means the trainee never reached a real number, so timing it would
// reward fast guessing rather than fast, accurate quoting.
// ============================================================

import { supabase } from '../lib/supabase';
import { generateId } from '../utils/helpers';

export interface QuestionOutcome {
  correct: boolean;
  timeTakenSec: number;
}

export interface SessionToSave {
  userId: string;
  userName: string;
  mode: string;
  outcomes: QuestionOutcome[];
}

function summarize(outcomes: QuestionOutcome[]) {
  const attempted = outcomes.length;
  const correct = outcomes.filter(o => o.correct).length;
  const accuracy = attempted ? Math.round((correct / attempted) * 1000) / 10 : 0;
  const correctTimes = outcomes.filter(o => o.correct).map(o => o.timeTakenSec);
  const avgTimeCorrectSec = correctTimes.length
    ? Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length)
    : null;
  return { attempted, correct, accuracy, avgTimeCorrectSec };
}

// Never throws into the UI — a save failure (e.g. the migration hasn't been
// applied yet) shouldn't block the trainee from seeing their own summary or
// starting another round. The caller decides whether/how to surface it.
export async function saveSessionResult(s: SessionToSave): Promise<void> {
  if (s.outcomes.length === 0) return;
  const { attempted, correct, accuracy, avgTimeCorrectSec } = summarize(s.outcomes);
  const { error } = await supabase.from('quote_trainer_results').insert({
    id: generateId(),
    user_id: s.userId,
    user_name: s.userName,
    mode: s.mode,
    attempted, correct, accuracy,
    avg_time_correct_sec: avgTimeCorrectSec,
    detail: s.outcomes,
  });
  if (error) throw error;
}

export interface CumulativeStats {
  sessions: number;
  attempted: number;
  correct: number;
  accuracy: number;
  avgTimeCorrectSec: number | null;
}

interface ResultRow { attempted: number; correct: number; avg_time_correct_sec: number | null }

// Each session's own avg time is itself an average over that session's
// correct answers, so combining sessions needs a weighted mean (by each
// session's correct count) — a plain average of averages would let a
// 1-correct-answer session count as much as a 20-correct-answer one.
function aggregate(rows: ResultRow[]): CumulativeStats {
  const attempted = rows.reduce((sum, r) => sum + r.attempted, 0);
  const correct = rows.reduce((sum, r) => sum + r.correct, 0);
  let weightedTimeSum = 0, weightTotal = 0;
  for (const r of rows) {
    if (r.avg_time_correct_sec != null && r.correct > 0) {
      weightedTimeSum += r.avg_time_correct_sec * r.correct;
      weightTotal += r.correct;
    }
  }
  return {
    sessions: rows.length,
    attempted, correct,
    accuracy: attempted ? Math.round((correct / attempted) * 1000) / 10 : 0,
    avgTimeCorrectSec: weightTotal ? Math.round(weightedTimeSum / weightTotal) : null,
  };
}

export async function fetchMyStats(userId: string): Promise<CumulativeStats | null> {
  const { data, error } = await supabase
    .from('quote_trainer_results')
    .select('attempted, correct, avg_time_correct_sec')
    .eq('user_id', userId);
  if (error || !data || data.length === 0) return null;
  return aggregate(data);
}

export interface UserStats extends CumulativeStats {
  userId: string;
  userName: string;
}

// Admin-only view (RLS lets any authenticated row-read through — the row
// count itself isn't sensitive, it's internal training data — but the page
// only calls this when user.role === 'admin'). One row per trainee, most
// quotations attempted first, so the busiest trainees surface immediately.
export async function fetchAllUsersStats(): Promise<UserStats[]> {
  const { data, error } = await supabase
    .from('quote_trainer_results')
    .select('user_id, user_name, attempted, correct, avg_time_correct_sec');
  if (error || !data || data.length === 0) return [];

  const byUser = new Map<string, { userName: string; rows: ResultRow[] }>();
  for (const r of data) {
    const entry = byUser.get(r.user_id) || { userName: r.user_name, rows: [] };
    entry.userName = r.user_name; // last-seen name wins if it was ever changed
    entry.rows.push(r);
    byUser.set(r.user_id, entry);
  }

  return Array.from(byUser.entries())
    .map(([userId, { userName, rows }]) => ({ userId, userName, ...aggregate(rows) }))
    .sort((a, b) => b.attempted - a.attempted);
}

export interface SessionRecord {
  id: string;
  mode: string;
  attempted: number;
  correct: number;
  accuracy: number;
  avgTimeCorrectSec: number | null;
  // Sum of every question's own timeTakenSec in this session (right and
  // wrong both count here, unlike avg_time_correct_sec) — the closest
  // proxy to "how long was this training session" without a dedicated
  // start/end timestamp column. Derived from `detail`, not stored.
  totalTimeSec: number;
  createdAt: string;
}

// Admin drill-down: every individual session for one trainee, most recent
// first, so a bad run (test data, a data-entry slip) can be found and
// removed with deleteSession() without a schema change.
export async function fetchUserSessions(userId: string): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from('quote_trainer_results')
    .select('id, mode, attempted, correct, accuracy, avg_time_correct_sec, detail, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(r => ({
    id: r.id, mode: r.mode, attempted: r.attempted, correct: r.correct, accuracy: r.accuracy,
    avgTimeCorrectSec: r.avg_time_correct_sec,
    totalTimeSec: Array.isArray(r.detail)
      ? r.detail.reduce((sum: number, d: QuestionOutcome) => sum + (d.timeTakenSec || 0), 0)
      : 0,
    createdAt: r.created_at,
  }));
}

// RLS with no matching policy silently filters the delete to zero rows
// rather than erroring — e.g. before 009_quote_trainer_results_delete.sql
// is applied. Requesting the deleted row back and checking it's actually
// there catches that case; without it the UI would remove the row locally
// and claim success while the real data survives untouched on the server.
export async function deleteSession(sessionId: string): Promise<void> {
  const { data, error } = await supabase.from('quote_trainer_results').delete().eq('id', sessionId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Delete had no effect — check the delete policy has been applied (009_quote_trainer_results_delete.sql).');
}
