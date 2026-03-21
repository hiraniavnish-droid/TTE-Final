import React, { useMemo } from 'react';
import { cn } from '../utils/helpers';
import { useTheme } from '../contexts/ThemeContext';
import { ActivityLog } from '../types';

interface Props {
  logs: ActivityLog[];
}

const WEEKS = 18; // ~4 months displayed
const DAY_LABELS = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const ActivityHeatmap: React.FC<Props> = ({ logs }) => {
  const { theme, getTextColor } = useTheme();

  const { cells, maxCount, monthMarkers } = useMemo(() => {
    // Build a map of date -> count
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      const d = new Date(log.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    // Build the grid: WEEKS columns × 7 rows (Sun-Sat)
    // Anchor the last column to today's week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=Sun

    // Last cell = today's position in grid
    const totalCells = WEEKS * 7;
    const grid: { date: Date; count: number; key: string }[] = [];

    for (let i = totalCells - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      grid.push({ date: new Date(d), count: counts[key] || 0, key });
    }

    const maxCount = Math.max(...grid.map(c => c.count), 1);

    // Month header markers: find first cell in each month
    const seen = new Set<number>();
    const monthMarkers: { col: number; label: string }[] = [];
    grid.forEach((cell, i) => {
      const col = Math.floor(i / 7);
      const month = cell.date.getMonth();
      if (!seen.has(col) && !seen.has(month)) {
        seen.add(month);
        seen.add(col);
        monthMarkers.push({ col, label: MONTH_LABELS[month] });
      }
    });

    return { cells: grid, maxCount, monthMarkers };
  }, [logs]);

  const getColor = (count: number) => {
    if (count === 0) {
      return theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    }
    const intensity = count / maxCount;
    if (theme === 'light') {
      if (intensity < 0.25) return 'rgba(99,102,241,0.25)';
      if (intensity < 0.5)  return 'rgba(99,102,241,0.50)';
      if (intensity < 0.75) return 'rgba(99,102,241,0.75)';
      return 'rgba(99,102,241,1)';
    } else {
      if (intensity < 0.25) return 'rgba(129,140,248,0.25)';
      if (intensity < 0.5)  return 'rgba(129,140,248,0.50)';
      if (intensity < 0.75) return 'rgba(129,140,248,0.80)';
      return 'rgba(129,140,248,1)';
    }
  };

  // Organize into columns (weeks)
  const columns: typeof cells[] = [];
  for (let w = 0; w < WEEKS; w++) {
    columns.push(cells.slice(w * 7, w * 7 + 7));
  }

  const totalActivity = cells.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className={cn(
      'rounded-2xl border p-5',
      theme === 'light' ? 'bg-white/90 border-slate-200 shadow-sm' : theme === 'ocean' ? 'bg-blue-950/60 border-blue-700/40' : 'bg-slate-800/80 border-slate-700/50'
    )}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={cn("font-bold font-serif", getTextColor())}>Activity Heatmap</h3>
          <p className={cn("text-[11px] opacity-50 mt-0.5", getTextColor())}>
            {totalActivity} actions in the last {WEEKS} weeks
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] opacity-40">
          <span className={cn("text-[10px]", getTextColor())}>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: getColor(v * maxCount) }} />
          ))}
          <span className={cn("text-[10px]", getTextColor())}>More</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-2.5 min-w-min">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mt-5 shrink-0">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className={cn("text-[9px] font-medium opacity-40 h-[11px] flex items-center", getTextColor())}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div>
            {/* Month labels */}
            <div className="flex gap-[3px] mb-1 relative h-4">
              {columns.map((_, colIdx) => {
                const marker = monthMarkers.find(m => m.col === colIdx);
                return (
                  <div key={colIdx} className="w-[11px]">
                    {marker && (
                      <span className={cn("text-[9px] font-semibold opacity-50 absolute whitespace-nowrap", getTextColor())}>
                        {marker.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cells */}
            <div className="flex gap-[3px]">
              {columns.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <div
                      key={cell.key}
                      className="w-[11px] h-[11px] rounded-[2px] transition-all duration-200 hover:ring-1 hover:ring-indigo-400 hover:scale-125 cursor-default"
                      style={{ backgroundColor: getColor(cell.count) }}
                      title={`${cell.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}: ${cell.count} action${cell.count !== 1 ? 's' : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
