import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { fmtINR, isQuotable, type WallEntry } from '../../services/rateWall';

interface Props {
  entry: WallEntry;
  bandTone: string;              // tailwind border colour class for the left rule
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
}

export const RateWallCard: React.FC<Props> = ({ entry, bandTone, selectedKeys, onToggle }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  // bandTone MUST be the last argument to cn(). cn() runs twMerge, which treats
  // border-l-* and the all-sides border-* as one conflict group and keeps
  // whichever comes later — passing bandTone before the theme classes silently
  // strips it, and the band's colour rule renders as plain grey. Caught in live
  // testing, where the class was simply absent from the rendered element.
  return (
    <div className={cn('border border-l-[3px] p-3.5',
      theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10',
      bandTone)}>
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <span className={cn('text-[13.5px] font-bold', getTextColor())}>{entry.hotelName}</span>
        {entry.starLabel && <span className={cn('text-[10.5px]', getSecondaryTextColor())}>{entry.starLabel}</span>}
        <span className={cn('ml-auto flex items-center gap-1 text-[10.5px]',
          entry.resolutionOk ? getSecondaryTextColor() : 'text-amber-500')}>
          <Wand2 size={11} /> {entry.resolutionChip}
        </span>
      </div>

      <div className={cn('text-[10.5px] mb-2', getSecondaryTextColor())}>{entry.inclusions}</div>

      {entry.festiveFlag && (
        <div className={cn('flex items-start gap-1.5 text-[10.5px] px-2 py-1.5 rounded-lg mb-2',
          theme === 'light' ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300')}>
          <AlertTriangle size={11} className="shrink-0 mt-0.5" /> {entry.festiveFlag}
        </div>
      )}

      {entry.closedReason && (
        <div className={cn('text-[10.5px] px-2 py-1.5 rounded-lg mb-2',
          theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-white/60')}>
          {entry.closedReason}
        </div>
      )}

      <div className="space-y-0.5">
        {entry.rows.map(row => {
          // isQuotable, not row.quotable: the repo's tsconfig omits strict, and
          // without strictNullChecks a boolean-literal discriminant does not
          // narrow. A user-defined type predicate does.
          if (!isQuotable(row)) {
            return (
              <div key={row.key} className={cn('flex items-center gap-2 px-2 py-1.5 text-[12px] opacity-55', getSecondaryTextColor())}>
                <span className="w-3.5 shrink-0" />
                <span className="flex-1">{row.roomName}</span>
                <span className="text-amber-500 font-semibold text-[11px] shrink-0">{row.blockedReason}</span>
              </div>
            );
          }
          return (
            <label key={row.key}
              className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] cursor-pointer select-none',
                theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
              <input type="checkbox" checked={selectedKeys.has(row.key)} onChange={() => onToggle(row.key)}
                className="w-3.5 h-3.5 accent-slate-900 shrink-0" />
              <span className={cn('flex-1', getTextColor())}>{row.roomName}</span>
              <span className="text-right shrink-0 leading-tight">
                <span className={cn('font-mono font-bold text-[13px] block', getTextColor())}>{fmtINR(row.sellingTotal)}</span>
                <span className={cn('font-mono text-[10px] block', getSecondaryTextColor())}>
                  {fmtINR(row.sellingPerNight)}/night · net {fmtINR(row.netTotal)} · margin {fmtINR(row.markupAmount)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
