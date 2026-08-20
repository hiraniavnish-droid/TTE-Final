// ============================================================
// Quotation Trainer — internal practice tool, NOT linked in the sidebar yet.
// Reachable at /quote-trainer while it's being tried out; add a nav entry
// in Layout.tsx to roll it out once it's proven.
//
// The trainee gets a bare customer enquiry (dates, party size, budget,
// sightseeing wishlist) — no hotel name, no rate. They go find the right
// hotel themselves (real Rate Wall, the rate sheet, wherever they'd
// normally look), price it by hand, and pick just a hotel + meal plan (never
// a room — a hotel can print half a dozen room types, and asking for the
// exact one would test sheet-reading trivia, not quotation judgement) plus
// two numbers: the per-person package price and the total margin earned.
// Every answer is graded against buildInlandWall() — the same resolver the
// real app quotes off — never a hand-typed "correct" number.
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn, generateId } from '../utils/helpers';
import { Timer, Play, ChevronRight, Check, X, RotateCcw, Trophy, Clock, Target } from 'lucide-react';
import {
  generateQuestion, gradeAnswer, MEAL_PLAN_LABEL,
  type TrainerQuestion, type GradeResult, type SubmittedAnswer, type MealPlan,
} from '../services/quoteTrainerEngine';

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
  submitted: SubmittedAnswer;
  grade: GradeResult;
  timeTakenSec: number;
}

const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

const EMPTY_FORM = { hotelName: '', mealPlan: '' as MealPlan | '', sellingPerPerson: '', totalMargin: '' };

export const QuoteTrainerPractice: React.FC = () => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const light = theme === 'light';

  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<Mode>('10min');
  const [timeLeft, setTimeLeft] = useState(0);
  const [question, setQuestion] = useState<TrainerQuestion | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const nextQuestion = useCallback(() => {
    try {
      setQuestion(generateQuestion(generateId()));
      setGenError(null);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not generate a question');
      setQuestion(null);
    }
    setQuestionStartedAt(Date.now());
    setForm(EMPTY_FORM);
    setGrade(null);
  }, []);

  const endSession = useCallback(() => {
    stopTimer();
    setPhase('ended');
  }, [stopTimer]);

  const start = () => {
    setHistory([]);
    const duration = mode === '10min' ? 600 : mode === '15min' ? 900 : 0;
    setTimeLeft(duration);
    setPhase('active');
    nextQuestion();
    if (isTimeMode(mode)) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { stopTimer(); setPhase('ended'); return 0; }
          return t - 1;
        });
      }, 1000);
    }
  };

  const submit = () => {
    if (!question) return;
    const submitted: SubmittedAnswer = {
      hotelName: form.hotelName,
      mealPlan: form.mealPlan,
      sellingPerPerson: parseFloat(form.sellingPerPerson),
      totalMargin: parseFloat(form.totalMargin),
    };
    const g = gradeAnswer(question, submitted);
    setGrade(g);
    setHistory(h => [...h, {
      question, submitted, grade: g,
      timeTakenSec: Math.round((Date.now() - questionStartedAt) / 1000),
    }]);
  };

  // Plan choices depend on which hotel is picked — a hotel that never
  // prints a dinner supplement should not offer 'Breakfast + Dinner' at all.
  const planChoices = useMemo(
    () => (question && form.hotelName ? question.plansByHotel[form.hotelName] || [] : []),
    [question, form.hotelName],
  );

  const attempted = history.length;
  const questionTarget = questionTargetOf(mode);
  const isLastQuestion = questionTarget > 0 && attempted >= questionTarget;
  const correct = history.filter(h => h.grade.allCorrect).length;
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  const avgTime = attempted ? Math.round(history.reduce((s, h) => s + h.timeTakenSec, 0) / attempted) : 0;

  const cardCls = cn('rounded-2xl border p-4 md:p-5',
    light ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/10');
  const labelCls = cn('text-[10px] font-bold uppercase tracking-wider mb-1 block', getSecondaryTextColor());
  const inputCls = cn('w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors', getInputClass());
  const pageCls = 'p-3 md:p-6';

  // ── setup ──
  if (phase === 'setup') {
    return (
      <div className={cn(pageCls, 'max-w-2xl mx-auto space-y-5')}>
        <div>
          <h1 className={cn('text-xl font-bold', getTextColor())}>Quotation Trainer — Statue of Unity</h1>
          <p className={cn('text-sm mt-1', getSecondaryTextColor())}>
            Practice tool. Each round gives you a bare customer enquiry — dates, party size, budget,
            sightseeing wishlist — no hotel, no rate. Find the right hotel yourself, price it, and
            enter the numbers below. Graded against the real Kevadiya rate engine, ±₹10 / ±0.1% tolerance.
          </p>
        </div>
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
      <div className={cn(pageCls, 'max-w-5xl mx-auto space-y-5')}>
        <div className={cn(cardCls, 'text-center')}>
          <Trophy size={28} className="mx-auto mb-2 text-amber-500" />
          <h1 className={cn('text-xl font-bold', getTextColor())}>Session complete</h1>
          <div className="grid grid-cols-4 gap-3 mt-4">
            <Stat label="Attempted" value={String(attempted)} light={light} />
            <Stat label="Correct" value={String(correct)} light={light} />
            <Stat label="Accuracy" value={`${accuracy}%`} light={light} />
            <Stat label="Avg time" value={`${avgTime}s`} light={light} />
          </div>
          <button type="button" onClick={() => setPhase('setup')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:opacity-80">
            <RotateCcw size={14} /> Start again
          </button>
        </div>

        <div className={cardCls}>
          <div className={labelCls}>Review ({attempted} question{attempted === 1 ? '' : 's'})</div>
          <div className="space-y-2 mt-2">
            {history.map((h, idx) => (
              <div key={h.question.id} className={cn('rounded-xl border p-3 text-xs',
                h.grade.allCorrect
                  ? (light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-400/30 bg-emerald-500/5')
                  : (light ? 'border-rose-200 bg-rose-50' : 'border-rose-400/30 bg-rose-500/5'))}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('font-bold', getTextColor())}>
                    Q{idx + 1} · {h.question.pax} pax · {h.question.nights}N · {h.timeTakenSec}s
                  </span>
                  {h.grade.allCorrect
                    ? <Check size={14} className="text-emerald-600" />
                    : <X size={14} className="text-rose-600" />}
                </div>
                <FieldRow label="Hotel" fr={h.grade.hotel} />
                <FieldRow label="Meal plan" fr={h.grade.mealPlan} />
                <FieldRow label="Price/person" fr={h.grade.perPerson} money />
                <FieldRow label="Total margin" fr={h.grade.margin} money />
              </div>
            ))}
            {attempted === 0 && <div className={cn('text-sm', getSecondaryTextColor())}>No questions attempted.</div>}
          </div>
        </div>
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
              Standard markup for this quote: <b>{question.markupPercent}%</b>.
              {question.discountPercent > 0
                ? <> Client has separately asked for a further <b>{question.discountPercent}% discount</b> off the quoted price.</>
                : <> No discount requested this round.</>}
            </div>
          </div>

          {/* answer form */}
          <div className={cardCls}>
            <div className={labelCls}>Your quotation</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={labelCls}>Recommended hotel</span>
                <select value={form.hotelName} disabled={!!grade}
                  onChange={e => setForm(f => ({ ...f, hotelName: e.target.value, mealPlan: '' }))}
                  className={inputCls}>
                  <option value="">Select…</option>
                  {question.hotelOptions.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <span className={labelCls}>Meal plan</span>
                <select value={form.mealPlan} disabled={!!grade || !form.hotelName}
                  onChange={e => setForm(f => ({ ...f, mealPlan: e.target.value as MealPlan }))}
                  className={inputCls}>
                  <option value="">Select…</option>
                  {planChoices.map(p => (
                    <option key={p.mealPlan} value={p.mealPlan}>{MEAL_PLAN_LABEL[p.mealPlan]}</option>
                  ))}
                </select>
              </div>
              <NumField label="Package price / person (₹)" value={form.sellingPerPerson} disabled={!!grade}
                onChange={v => setForm(f => ({ ...f, sellingPerPerson: v }))} inputCls={inputCls} labelCls={labelCls} />
              <NumField label="Total margin earned (₹)" value={form.totalMargin} disabled={!!grade}
                onChange={v => setForm(f => ({ ...f, totalMargin: v }))} inputCls={inputCls} labelCls={labelCls} />
            </div>

            {!grade ? (
              <button type="button" onClick={submit}
                className="mt-4 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 transition">
                Submit answer
              </button>
            ) : (
              <div className="mt-4 space-y-2">
                <div className={cn('rounded-xl border p-3',
                  grade.allCorrect
                    ? (light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-400/30 bg-emerald-500/5')
                    : (light ? 'border-rose-200 bg-rose-50' : 'border-rose-400/30 bg-rose-500/5'))}>
                  <div className="flex items-center gap-1.5 font-bold text-sm mb-2">
                    {grade.allCorrect
                      ? <><Check size={14} className="text-emerald-600" /> <span className="text-emerald-700">All correct</span></>
                      : <><X size={14} className="text-rose-600" /> <span className="text-rose-700">Some fields off</span></>}
                  </div>
                  <FieldRow label="Hotel" fr={grade.hotel} />
                  <FieldRow label="Meal plan" fr={grade.mealPlan} />
                  <FieldRow label="Price/person" fr={grade.perPerson} money />
                  <FieldRow label="Total margin" fr={grade.margin} money />
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
              <div className={cn('truncate mt-0.5', getSecondaryTextColor())}>{h.submitted.hotelName || '—'}</div>
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
  label: string; value: string; disabled: boolean; onChange: (v: string) => void;
  inputCls: string; labelCls: string;
}> = ({ label, value, disabled, onChange, inputCls, labelCls }) => (
  <div>
    <span className={labelCls}>{label}</span>
    <input type="number" inputMode="decimal" value={value} disabled={disabled}
      onChange={e => onChange(e.target.value)} placeholder="0" className={inputCls} />
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
