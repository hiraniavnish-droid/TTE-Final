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

export async function fetchMyStats(userId: string): Promise<CumulativeStats | null> {
  const { data, error } = await supabase
    .from('quote_trainer_results')
    .select('attempted, correct, avg_time_correct_sec')
    .eq('user_id', userId);
  if (error || !data || data.length === 0) return null;

  const attempted = data.reduce((sum, r) => sum + r.attempted, 0);
  const correct = data.reduce((sum, r) => sum + r.correct, 0);

  // Each session's own avg time is itself an average over that session's
  // correct answers, so combining sessions needs a weighted mean (by each
  // session's correct count) — a plain average of averages would let a
  // 1-correct-answer session count as much as a 20-correct-answer one.
  let weightedTimeSum = 0, weightTotal = 0;
  for (const r of data) {
    if (r.avg_time_correct_sec != null && r.correct > 0) {
      weightedTimeSum += r.avg_time_correct_sec * r.correct;
      weightTotal += r.correct;
    }
  }

  return {
    sessions: data.length,
    attempted, correct,
    accuracy: attempted ? Math.round((correct / attempted) * 1000) / 10 : 0,
    avgTimeCorrectSec: weightTotal ? Math.round(weightedTimeSum / weightTotal) : null,
  };
}
