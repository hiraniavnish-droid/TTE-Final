import React, { useMemo, useState } from 'react';
import { cn } from '../utils/helpers';
import { useTheme } from '../contexts/ThemeContext';
import { ActivityLog } from '../types';
import { Flame, Zap, CalendarDays, TrendingUp } from 'lucide-react';

interface Props {
  logs: ActivityLog[];
}

const WEEKS = 26; // ~6 months
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CELL_SIZE = 14;
const CELL_GAP = 3;

export const ActivityHeatmap: React.FC<Props> = ({ logs }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const [hoveredCell, setHoveredCell] = useState<{ key: string; x: number; y: number } | null>(null);

  const { cells, maxCount, monthMarkers, stats, weekTotals, weeksShown } = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      const d = new Date(log.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dynamically compute how many weeks to show:
    // Find the earliest log within last WEEKS weeks, add 1 buffer week, min 4 weeks
    const earliest = logs.length > 0
      ? logs.reduce((min, l) => {
          const t = new Date(l.timestamp).getTime();
          return t < min ? t : min;
        }, Date.now())
      : null;

    let weeksShown = 4; // minimum when no data
    if (earliest) {
      const daysBack = Math.ceil((today.getTime() - earliest) / (1000 * 60 * 60 * 24));
      const weeksBack = Math.ceil(daysBack / 7) + 2; // +2 buffer weeks
      weeksShown = Math.min(Math.max(weeksBack, 4), WEEKS);
    }

    const totalCells = weeksShown * 7;
    const grid: { date: Date; count: number; key: string; isToday: boolean; isFuture: boolean }[] = [];

    for (let i = totalCells - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const isFuture = d > today;
      grid.push({ date: new Date(d), count: isFuture ? 0 : (counts[key] || 0), key, isToday: i === 0, isFuture });
    }

    const maxCount = Math.max(...grid.map(c => c.count), 1);

    // Month header markers
    const seenMonths = new Set<number>();
    const monthMarkers: { col: number; label: string }[] = [];
    grid.forEach((cell, i) => {
      const col = Math.floor(i / 7);
      const month = cell.date.getMonth();
      if (!seenMonths.has(month) && col > 0) {
        seenMonths.add(month);
        monthMarkers.push({ col, label: MONTH_LABELS[month] });
      }
    });

    // Stats
    const activeDays = grid.filter(c => c.count > 0 && !c.isFuture).length;
    const totalActions = grid.reduce((s, c) => s + c.count, 0);
    const bestDay = grid.reduce((best, c) => c.count > best.count ? c : best, grid[0]);

    // Current streak (consecutive days with activity ending today)
    let streak = 0;
    for (let i = grid.length - 1; i >= 0; i--) {
      if (grid[i].isFuture) continue;
      if (grid[i].count > 0) streak++;
      else break;
    }

    // Week totals for sparkline
    const weekTotals: number[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const weekCells = grid.slice(w * 7, w * 7 + 7);
      weekTotals.push(weekCells.reduce((s, c) => s + c.count, 0));
    }

    return { cells: grid, maxCount, monthMarkers, stats: { activeDays, totalActions, bestDay, streak }, weekTotals, weeksShown };
  }, [logs]);

  const columns: typeof cells[] = [];
  for (let w = 0; w < weeksShown; w++) {
    columns.push(cells.slice(w * 7, w * 7 + 7));
  }

  const maxWeekTotal = Math.max(...weekTotals, 1);

  const getColor = (count: number, isFuture: boolean) => {
    if (isFuture) return 'transparent';
    if (count === 0) {
      return theme === 'light' ? 'rgba(226,232,240,0.8)' : theme === 'ocean' ? 'rgba(30,58,138,0.3)' : 'rgba(255,255,255,0.06)';
    }
    const intensity = count / maxCount;
    if (theme === 'light') {
      if (intensity <= 0.25) return '#c7d2fe';
      if (intensity <= 0.5)  return '#818cf8';
      if (intensity <= 0.75) return '#6366f1';
      return '#4338ca';
    } else if (theme === 'ocean') {
      if (intensity <= 0.25) return 'rgba(99,102,241,0.35)';
      if (intensity <= 0.5)  return 'rgba(99,102,241,0.60)';
      if (intensity <= 0.75) return 'rgba(99,102,241,0.85)';
      return '#818cf8';
    } else {
      if (intensity <= 0.25) return 'rgba(129,140,248,0.30)';
      if (intensity <= 0.5)  return 'rgba(129,140,248,0.55)';
      if (intensity <= 0.75) return 'rgba(129,140,248,0.80)';
      return '#a5b4fc';
    }
  };

  const todayCell = cells.find(c => c.isToday);
  const hoveredData = hoveredCell ? cells.find(c => c.key === hoveredCell.key) : null;

  const cardBg = theme === 'light'
    ? 'bg-white border-slate-200 shadow-sm'
    : theme === 'ocean'
      ? 'bg-blue-950/60 border-blue-700/40'
      : 'bg-slate-800/80 border-slate-700/50';

  const statCardBg = theme === 'light'
    ? 'bg-slate-50 border-slate-200'
    : theme === 'ocean'
      ? 'bg-blue-900/40 border-blue-700/30'
      : 'bg-slate-700/50 border-slate-600/40';

  return (
    <div className={cn('rounded-2xl border p-5 md:p-6', cardBg)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <CalendarDays size={16} className={theme === 'light' ? 'text-indigo-500' : 'text-indigo-400'} />
            <h3 className={cn('font-bold text-base', getTextColor())}>Activity Heatmap</h3>
          </div>
          <p className={cn('text-xs', getSecondaryTextColor(), 'opacity-60')}>
            {stats.totalActions} actions · last {weeksShown} weeks
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-medium opacity-40', getTextColor())}>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: getColor(Math.round(v * maxCount), false),
                border: theme === 'light' && v === 0 ? '1px solid rgba(0,0,0,0.06)' : undefined,
              }}
            />
          ))}
          <span className={cn('text-[10px] font-medium opacity-40', getTextColor())}>More</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-2.5', statCardBg)}>
          <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400')}>
            <Zap size={13} />
          </div>
          <div>
            <div className={cn('text-lg font-extrabold leading-none', getTextColor())}>{stats.totalActions}</div>
            <div className={cn('text-[10px] font-medium mt-0.5 opacity-50', getTextColor())}>Total Actions</div>
          </div>
        </div>
        <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-2.5', statCardBg)}>
          <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400')}>
            <CalendarDays size={13} />
          </div>
          <div>
            <div className={cn('text-lg font-extrabold leading-none', getTextColor())}>{stats.activeDays}</div>
            <div className={cn('text-[10px] font-medium mt-0.5 opacity-50', getTextColor())}>Active Days</div>
          </div>
        </div>
        <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-2.5', statCardBg)}>
          <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400')}>
            <Flame size={13} />
          </div>
          <div>
            <div className={cn('text-lg font-extrabold leading-none', getTextColor())}>{stats.streak}</div>
            <div className={cn('text-[10px] font-medium mt-0.5 opacity-50', getTextColor())}>Day Streak</div>
          </div>
        </div>
        <div className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-2.5', statCardBg)}>
          <div className={cn('p-1.5 rounded-lg', theme === 'light' ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-400')}>
            <TrendingUp size={13} />
          </div>
          <div>
            <div className={cn('text-lg font-extrabold leading-none', getTextColor())}>{stats.bestDay?.count || 0}</div>
            <div className={cn('text-[10px] font-medium mt-0.5 opacity-50', getTextColor())}>Best Day</div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1 min-w-min relative">
          {/* Day labels */}
          <div className="flex flex-col shrink-0 justify-start" style={{ gap: CELL_GAP, marginTop: 20 }}>
            {DAY_LABELS.map((d, i) => (
              <div
                key={i}
                className={cn('text-[9px] font-semibold flex items-center justify-end pr-1', getTextColor(), 'opacity-35')}
                style={{ height: CELL_SIZE, width: 22 }}
              >
                {i % 2 === 0 ? d : ''}
              </div>
            ))}
          </div>

          {/* Columns */}
          <div>
            {/* Month labels */}
            <div className="flex relative" style={{ height: 18, gap: CELL_GAP, marginBottom: 2 }}>
              {columns.map((_, colIdx) => {
                const marker = monthMarkers.find(m => m.col === colIdx);
                return (
                  <div key={colIdx} style={{ width: CELL_SIZE, position: 'relative', flexShrink: 0 }}>
                    {marker && (
                      <span
                        className={cn('absolute text-[10px] font-bold whitespace-nowrap', getTextColor(), 'opacity-50')}
                        style={{ top: 2, left: 0 }}
                      >
                        {marker.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cells */}
            <div className="flex" style={{ gap: CELL_GAP }}>
              {columns.map((week, wi) => (
                <div key={wi} className="flex flex-col" style={{ gap: CELL_GAP }}>
                  {week.map((cell) => (
                    <div
                      key={cell.key}
                      className="relative cursor-default transition-transform duration-150 hover:scale-125 hover:z-10"
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderRadius: 3,
                        backgroundColor: getColor(cell.count, cell.isFuture),
                        outline: cell.isToday ? `2px solid ${theme === 'light' ? '#6366f1' : '#818cf8'}` : undefined,
                        outlineOffset: cell.isToday ? 1 : undefined,
                        opacity: cell.isFuture ? 0 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!cell.isFuture) {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setHoveredCell({ key: cell.key, x: rect.left, y: rect.top });
                        }
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={
                        cell.isFuture ? undefined :
                        `${cell.date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}: ${cell.count} action${cell.count !== 1 ? 's' : ''}`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Week activity sparkline */}
            <div className="flex mt-2" style={{ gap: CELL_GAP }}>
              {weekTotals.map((total, wi) => (
                <div
                  key={wi}
                  className="flex items-end"
                  style={{ width: CELL_SIZE, height: 14 }}
                >
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: total === 0 ? 2 : Math.max(3, Math.round((total / maxWeekTotal) * 14)),
                      backgroundColor: total === 0
                        ? (theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)')
                        : (theme === 'light' ? 'rgba(99,102,241,0.35)' : 'rgba(129,140,248,0.35)'),
                    }}
                    title={`Week ${wi + 1}: ${total} actions`}
                  />
                </div>
              ))}
            </div>
            <div className={cn('text-[9px] font-medium opacity-30 mt-1', getTextColor())}>weekly volume</div>
          </div>
        </div>
      </div>

      {/* Today label */}
      {todayCell && (
        <div className={cn('mt-2 text-[10px] font-medium opacity-40 flex items-center gap-1.5', getTextColor())}>
          <div
            className="w-3 h-3 rounded-sm inline-block"
            style={{ outline: `2px solid ${theme === 'light' ? '#6366f1' : '#818cf8'}`, outlineOffset: 1 }}
          />
          Today
        </div>
      )}
    </div>
  );
};
