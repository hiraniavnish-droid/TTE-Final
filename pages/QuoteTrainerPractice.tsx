// ============================================================
// Quotation Trainer — internal practice tool, linked in the sidebar
// (components/Layout.tsx) as 'Quote Trainer' for the whole team.
//
// The trainee gets a bare customer enquiry (dates, party size, budget,
// sightseeing wishlist) — no hotel name, no rate. Each question PRE-NAMES
// 3-4 hotels (the shortlist a real agent would send a client), every one
// priced at MAP (breakfast + dinner). The trainee's job is just the two
// numbers per hotel: package price per person, and total margin earned.
// No discount round — one clean markup step per hotel, since stacking a
// second 'take X% off the quoted price' step was the single biggest
// source of near-miss errors that had nothing to do with pricing skill.
// Every answer is graded against buildInlandWall() — the same resolver the
// real app quotes off — never a hand-typed "correct" number.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn, generateId } from '../utils/helpers';
import { Timer, Play, ChevronRight, Check, X, RotateCcw, Trophy, Clock, Target, History, Users } from 'lucide-react';
import {
  generateQuestion, gradeAnswer,
  type TrainerQuestion, type GradeResult, type SubmittedLine,
} from '../services/quoteTrainerEngine';
import {
  saveSessionResult, fetchMyStats, fetchAllUsersStats,
  type CumulativeStats, type UserStats,
} from '../services/quoteTrainerResults';

type Mode = '10min' | '15min' | '10q' | '15q' | '20q' | 'untimed';
type Phase = 'setup' | 'active' | 'ended';

const CHALLENGES: { id: Mode; label: string; group: string }[] = [
  { id: '10min', label: '10-min challenge', group: 'Timed' },
  { id: '15min', label: '15-min challenge', group: 'Timed' },
  { id: '10q', label: '10 quotations', group: 'Fixed count' },
  { id: '15q', label: '15 quotations', group: 'Fixed count' },
  { id: '20q', label: '20 quotations', group: 'Fixed count' },
  { id: 'untimed', label: 'Untimed practice', group: 'Open-ended' },
];

const isTimeMode = (m: Mode) => m === '10min' || m === '15min';
const questionTargetOf = (m: Mode): number => (m === '10q' ? 10 : m === '15q' ? 15 : m === '20q' ? 20 : 0);

interface HistoryItem {
  question: TrainerQuestion;
  grade: GradeResult;
  timeTakenSec: number;
}

type LineForm = Record<string, { sellingPerPerson: string; totalMargin: string }>;

const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

const emptyLineForm = (q: TrainerQuestion): LineForm => {
  const f: LineForm = {};
  for (const li of q.lineItems) f[li.hotelName] = { sellingPerPerson: '', totalMargin: '' };
  return f;
};

export const QuoteTrainerPractice: React.FC = () => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const { user } = useAuth();
  const light = theme === 'light';
  const isAdmin = user?.role === 'admin';

  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<Mode>('10min');
  const [timeLeft, setTimeLeft] = useState(0);
  const [question, setQuestion] = useState<TrainerQuestion | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [form, setForm] = useState<LineForm>({});
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<CumulativeStats | null>(null);
  const [teamStats, setTeamStats] = useState<UserStats[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // setInterval captures whatever `history` closure existed when start()
  // ran; a ref kept in sync on every update lets endSession read the true
  // latest count instead of whatever it was at session start.
  const historyRef = useRef<HistoryItem[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const loadStats = useCallback(() => {
    if (!user) return;
    fetchMyStats(user.id).then(setMyStats).catch(() => { /* non-critical — panel just shows nothing */ });
    if (user.role === 'admin') {
      fetchAllUsersStats().then(setTeamStats).catch(() => { /* non-critical */ });
    }
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const nextQuestion = useCallback(() => {
    try {
      const q = generateQuestion(generateId());
      setQuestion(q);
      setForm(emptyLineForm(q));
      setGenError(null);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not generate a question');
      setQuestion(null);
      setForm({});
    }
    setQuestionStartedAt(Date.now());
    setGrade(null);
  }, []);

  const endSession = useCallback(() => {
    stopTimer();
    setPhase('ended');
    const finished = historyRef.current;
    if (user && finished.length > 0) {
      saveSessionResult({
        userId: user.id, userName: user.name, mode,
        outcomes: finished.map(h => ({ correct: h.grade.allCorrect, timeTakenSec: h.timeTakenSec })),
      })
        .then(loadStats)
        .catch(err => {
          console.error('quote trainer: failed to save session', err);
          toast.error('Could not save this session — your results were not recorded.');
        });
    }
  }, [stopTimer, mode, user, loadStats]);

  const start = () => {
    setHistory([]);
    const duration = mode === '10min' ? 600 : mode === '15min' ? 900 : 0;
    setTimeLeft(duration);
    setPhase('active');
    nextQuestion();
    if (isTimeMode(mode)) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { endSession(); return 0; }
          return t - 1;
        });
      }, 1000);
    }
  };

  const submit = () => {
    if (!question) return;
    const submitted: SubmittedLine[] = question.lineItems.map(li => ({
      hotelName: li.hotelName,
      sellingPerPerson: parseFloat(form[li.hotelName]?.sellingPerPerson ?? ''),
      totalMargin: parseFloat(form[li.hotelName]?.totalMargin ?? ''),
    }));
    const g = gradeAnswer(question, submitted);
    setGrade(g);
    setHistory(h => [...h, { question, grade: g, timeTakenSec: Math.round((Date.now() - questionStartedAt) / 1000) }]);
  };

  const attempted = history.length;
  const questionTarget = questionTargetOf(mode);
  const isLastQuestion = questionTarget > 0 && attempted >= questionTarget;
  const correct = history.filter(h => h.grade.allCorrect).length;
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  // Only correct answers count toward the average — a wrong answer means
  // the trainee never actually reached a real number, so timing it would
  // reward fast guessing rather than fast, accurate quoting.
  const correctTimes = history.filter(h => h.grade.allCorrect).map(h => h.timeTakenSec);
  const avgTime = correctTimes.length ? Math.round(correctTimes.reduce((s, t) => s + t, 0) / correctTimes.length) : 0;

  const cardCls = cn('rounded-2xl border p-4 md:p-5',
    light ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/10');
  const labelCls = cn('text-[10px] font-bold uppercase tracking-wider mb-1 block', getSecondaryTextColor());
  const inputCls = cn('w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors', getInputClass());
  const pageCls = 'p-3 md:p-6';

  const StatsPanel: React.FC = () => (
    <>
      {myStats && (
        <div className={cardCls}>
          <div className={cn('flex items-center gap-1.5', labelCls)}><History size={12} /> Your training history</div>
          <div className="grid grid-cols-4 gap-3 mt-1">
            <Stat label="Sessions" value={String(myStats.sessions)} light={light} />
            <Stat label="Quotations" value={String(myStats.attempted)} light={light} />
            <Stat label="Accuracy" value={`${myStats.accuracy}%`} light={light} />
            <Stat label="Avg time" value={myStats.avgTimeCorrectSec != null ? `${myStats.avgTimeCorrectSec}s` : '—'} light={light} />
          </div>
        </div>
      )}
      {isAdmin && teamStats && teamStats.length > 0 && (
        <div className={cardCls}>
          <div className={cn('flex items-center gap-1.5', labelCls)}><Users size={12} /> Team training history (admin)</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={cn('text-left border-b', light ? 'border-slate-200' : 'border-white/10')}>
                  <th className={cn('py-1.5 pr-3 font-semibold', getSecondaryTextColor())}>Agent</th>
                  <th className={cn('py-1.5 px-3 font-semibold text-right', getSecondaryTextColor())}>Sessions</th>
                  <th className={cn('py-1.5 px-3 font-semibold text-right', getSecondaryTextColor())}>Quotations</th>
                  <th className={cn('py-1.5 px-3 font-semibold text-right', getSecondaryTextColor())}>Accuracy</th>
                  <th className={cn('py-1.5 pl-3 font-semibold text-right', getSecondaryTextColor())}>Avg time</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map(u => (
                  <tr key={u.userId} className={cn('border-b last:border-0', light ? 'border-slate-100' : 'border-white/5')}>
                    <td className={cn('py-1.5 pr-3 font-semibold', getTextColor())}>{u.userName}{u.userId === user?.id ? ' (you)' : ''}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{u.sessions}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{u.attempted}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{u.accuracy}%</td>
                    <td className="py-1.5 pl-3 text-right font-mono">{u.avgTimeCorrectSec != null ? `${u.avgTimeCorrectSec}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );

  // ── setup ──
  if (phase === 'setup') {
    return (
      <div className={cn(pageCls, 'max-w-3xl mx-auto space-y-5')}>
        <div>
          <h1 className={cn('text-xl font-bold', getTextColor())}>Quotation Trainer — Statue of Unity</h1>
          <p className={cn('text-sm mt-1', getSecondaryTextColor())}>
            Practice tool. Each round gives you a bare customer enquiry — dates, party size, budget,
            sightseeing wishlist — and 3-4 named hotels to price, all at MAP (breakfast + dinner). Find
            the rates yourself and enter the numbers below. Graded against the real Kevadiya rate engine,
            ±₹10 / ±0.1% tolerance.
          </p>
        </div>
        <StatsPanel />
        <div className={cardCls}>
          <div className={labelCls}>Choose a challenge</div>
          <div className="space-y-3">
            {Array.from(new Set(CHALLENGES.map(c => c.group))).map(group => (
              <div key={group}>
                <div className={cn('text-[10px] font-semibold uppercase tracking-wider mb-1.5', getSecondaryTextColor())}>{group}</div>
                <div className="flex flex-wrap gap-2">
                  {CHALLENGES.filter(c => c.group === group).map(c => (
                    <button key={c.id} type="button" onClick={() => setMode(c.id)}
                      className={cn('flex-1 min-w-[120px] rounded-xl border px-3 py-3 text-sm font-semibold transition',
                        mode === c.id
                          ? (light ? 'border-slate-900 bg-slate-900 text-white' : 'border-white bg-white text-slate-900')
                          : cn(getInputClass(), getSecondaryTextColor()))}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={start}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 transition">
            <Play size={16} /> Start
          </button>
        </div>
      </div>
    );
  }

  // ── ended ──
  if (phase === 'ended') {
    return (
      <div className={cn(pageCls, 'max-w-3xl mx-auto space-y-5')}>
        <div className={cn(cardCls, 'text-center')}>
          <Trophy size={28} className="mx-auto mb-2 text-amber-500" />
          <h1 className={cn('text-xl font-bold', getTextColor())}>Session complete</h1>
          <p className={cn('text-xs mt-1', getSecondaryTextColor())}>
            {attempted > 0 ? 'Saved to your training history.' : 'Nothing submitted — nothing to save.'}
          </p>
          <div className="grid grid-cols-4 gap-3 mt-4">
            <Stat label="Quotations sent" value={String(attempted)} light={light} />
            <Stat label="Qualified" value={String(correct)} light={light} />
            <Stat label="Accuracy" value={`${accuracy}%`} light={light} />
            <Stat label="Avg time (correct)" value={correctTimes.length ? `${avgTime}s` : '—'} light={light} />
          </div>
          <button type="button" onClick={() => setPhase('setup')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-80">
            <RotateCcw size={14} /> Start again
          </button>
        </div>
        <StatsPanel />
      </div>
    );
  }

  // ── active ──
  return (
    <div className={cn(pageCls, 'space-y-4')}>
      {/* scoreboard */}
      <div className={cn('sticky top-0 z-10 flex items-center gap-4 rounded-xl border px-4 py-2.5 backdrop-blur',
        light ? 'bg-white/90 border-slate-200' : 'bg-slate-900/90 border-white/10')}>
        {isTimeMode(mode) && (
          <div className={cn('flex items-center gap-1.5 font-mono font-bold text-sm',
            timeLeft <= 30 ? 'text-rose-500' : getTextColor())}>
            <Timer size={14} /> {fmtClock(timeLeft)}
          </div>
        )}
        <ScoreChip icon={<Target size={12} />} label="Attempted"
          value={questionTarget > 0 ? `${attempted}/${questionTarget}` : String(attempted)} />
        <ScoreChip icon={<Check size={12} />} label="Correct" value={String(correct)} />
        <ScoreChip icon={<Trophy size={12} />} label="Accuracy" value={`${accuracy}%`} />
        <ScoreChip icon={<Clock size={12} />} label="Avg" value={`${avgTime}s`} />
        <button type="button" onClick={endSession}
          className={cn('ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-lg transition', getInputClass(), getSecondaryTextColor())}>
          End session
        </button>
      </div>

      {genError && (
        <div className={cardCls}>
          <p className="text-sm text-rose-500">{genError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="max-w-2xl space-y-4">
      {question && (
        <>
          {/* the enquiry */}
          <div className={cardCls}>
            <div className={labelCls}>Client enquiry</div>
            <p className={cn('text-sm leading-relaxed', getTextColor())}>
              "We'd like to travel to the Statue of Unity on <b>{question.checkIn}</b> for{' '}
              <b>{question.nights} night{question.nights === 1 ? '' : 's'}</b>. We are{' '}
              <b>{question.pax} people</b>. Our budget is around{' '}
              <b>{fmtINR(question.budgetPerPerson)} per person</b>.
              {question.minStarRating > 0 && <> We'd prefer a <b>{question.minStarRating}-star or above</b> property.</>}{' '}
              We'd like to cover: {question.sightseeing.join(', ')}."
            </p>
            <div className={cn('mt-2 text-xs', getSecondaryTextColor())}>
              Standard markup for this quote: <b>{question.markupPercent}%</b>. All prices below at{' '}
              <b>MAP (breakfast + dinner)</b>. Assume max 2 guests share a room — this party needs{' '}
              <b>{question.rooms} room{question.rooms === 1 ? '' : 's'}</b>.
            </div>
          </div>

          {/* answer form — one row per pre-named hotel */}
          <div className={cardCls}>
            <div className={labelCls}>Price each of these {question.lineItems.length} hotels (MAP)</div>
            <div className="space-y-3 mt-2">
              {question.lineItems.map(li => (
                <div key={li.hotelName} className={cn('rounded-xl border p-3', light ? 'border-slate-200' : 'border-white/10')}>
                  <div className={cn('text-sm font-bold mb-2', getTextColor())}>{li.hotelName}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Package price / person (₹)" hint="Total selling price ÷ number of people"
                      value={form[li.hotelName]?.sellingPerPerson ?? ''} disabled={!!grade}
                      onChange={v => setForm(f => ({ ...f, [li.hotelName]: { ...f[li.hotelName], sellingPerPerson: v } }))}
                      inputCls={inputCls} labelCls={labelCls} />
                    <NumField label="Total margin earned (₹)" hint="Total markup for the whole booking — not per person"
                      value={form[li.hotelName]?.totalMargin ?? ''} disabled={!!grade}
                      onChange={v => setForm(f => ({ ...f, [li.hotelName]: { ...f[li.hotelName], totalMargin: v } }))}
                      inputCls={inputCls} labelCls={labelCls} />
                  </div>
                  {grade && (() => {
                    const lg = grade.lines.find(l => l.hotelName === li.hotelName)!;
                    return (
                      <div className={cn('mt-2 pt-2 border-t space-y-0.5', light ? 'border-slate-100' : 'border-white/10')}>
                        <FieldRow label="Price/person" fr={lg.perPerson} money />
                        <FieldRow label="Total margin" fr={lg.margin} money />
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            {!grade ? (
              <button type="button" onClick={submit}
                className="mt-4 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 transition">
                Submit answer
              </button>
            ) : (
              <div className="mt-4 space-y-2">
                <div className={cn('rounded-xl border p-3 flex items-center gap-1.5 font-bold text-sm',
                  grade.allCorrect
                    ? (light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-400/30 bg-emerald-500/5')
                    : (light ? 'border-rose-200 bg-rose-50' : 'border-rose-400/30 bg-rose-500/5'))}>
                  {grade.allCorrect
                    ? <><Check size={14} className="text-emerald-600" /> <span className="text-emerald-700">All {question.lineItems.length} hotels correct</span></>
                    : <><X size={14} className="text-rose-600" /> <span className="text-rose-700">
                        {grade.lines.filter(l => l.allCorrect).length}/{question.lineItems.length} hotels correct
                      </span></>}
                </div>
                {isLastQuestion ? (
                  <button type="button" onClick={endSession}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 transition">
                    Finish session <Trophy size={16} />
                  </button>
                ) : (
                  <button type="button" onClick={nextQuestion}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 transition">
                    Next question <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* session log — fills the extra width on wide screens with something
          actually useful, rather than just stretching the form card. */}
      <div className={cardCls}>
        <div className={labelCls}>This session ({attempted})</div>
        <div className="space-y-1.5 mt-2 max-h-[70vh] overflow-y-auto">
          {history.slice().reverse().map((h, idx) => (
            <div key={h.question.id} className={cn('rounded-lg border px-2.5 py-1.5 text-[11px]',
              h.grade.allCorrect
                ? (light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-400/30 bg-emerald-500/5')
                : (light ? 'border-rose-200 bg-rose-50' : 'border-rose-400/30 bg-rose-500/5'))}>
              <div className="flex items-center justify-between">
                <span className={cn('font-bold', getTextColor())}>Q{attempted - idx} · {h.timeTakenSec}s</span>
                {h.grade.allCorrect
                  ? <Check size={12} className="text-emerald-600 shrink-0" />
                  : <X size={12} className="text-rose-600 shrink-0" />}
              </div>
              <div className={cn('truncate mt-0.5', getSecondaryTextColor())}>
                {h.grade.lines.filter(l => l.allCorrect).length}/{h.grade.lines.length} hotels correct
              </div>
            </div>
          ))}
          {attempted === 0 && <div className={cn('text-xs', getSecondaryTextColor())}>Nothing submitted yet.</div>}
        </div>
      </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; light: boolean }> = ({ label, value, light }) => (
  <div className={cn('rounded-xl border p-3', light ? 'border-slate-200' : 'border-white/10')}>
    <div className="text-lg font-bold font-mono">{value}</div>
    <div className={cn('text-[10px] uppercase tracking-wider', light ? 'text-slate-500' : 'text-slate-400')}>{label}</div>
  </div>
);

const ScoreChip: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="hidden sm:flex items-center gap-1 text-xs font-semibold">
    {icon}<span className="font-mono">{value}</span>
    <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
  </div>
);

const NumField: React.FC<{
  label: string; hint?: string; value: string; disabled: boolean; onChange: (v: string) => void;
  inputCls: string; labelCls: string;
}> = ({ label, hint, value, disabled, onChange, inputCls, labelCls }) => (
  <div>
    <span className={labelCls}>{label}</span>
    <input type="number" inputMode="decimal" value={value} disabled={disabled}
      onChange={e => onChange(e.target.value)} placeholder="0" className={inputCls} />
    {hint && <span className="block text-[10px] opacity-60 mt-0.5">{hint}</span>}
  </div>
);

const FieldRow: React.FC<{ label: string; fr: { correct: boolean; expected: number | string; got: number | string }; money?: boolean }> = ({ label, fr, money }) => {
  const fmt = (v: number | string) => money && typeof v === 'number' ? fmtINR(v) : String(v);
  return (
    <div className="flex items-center gap-2 text-[11px] py-0.5">
      {fr.correct ? <Check size={11} className="text-emerald-600 shrink-0" /> : <X size={11} className="text-rose-600 shrink-0" />}
      <span className="font-semibold w-24 shrink-0">{label}</span>
      <span className="opacity-70">you: {fmt(fr.got)}</span>
      {!fr.correct && <span className="opacity-70">· correct: {fmt(fr.expected)}</span>}
    </div>
  );
};
