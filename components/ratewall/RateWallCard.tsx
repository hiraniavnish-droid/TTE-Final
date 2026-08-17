import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { fmtINR, isQuotable, type WallEntry, type WallRoomRow } from '../../services/rateWall';

interface Props {
  entry: WallEntry;
  bandTone: string;              // tailwind border colour class for the left rule
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
}

// One line per ROOM, with that room's meal plans priced side by side, so an
// agent compares EPAI against MAPAI without changing any control.
//
// Grouping is by printed room name. Verified against rajarshiData.ts: no hotel
// prints two rooms under the same name, so this cannot merge distinct rooms.
// (Grouping on the key's room-index prefix would be structurally safer but
// hard-codes one supplier's key format into the shared card.) Insertion order
// is preserved rather than sorted — the sheet's own room order is meaningful.
function groupByRoom(rows: WallRoomRow[]): { roomName: string; rows: WallRoomRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, WallRoomRow[]>();
  for (const row of rows) {
    let bucket = map.get(row.roomName);
    if (!bucket) { bucket = []; map.set(row.roomName, bucket); order.push(row.roomName); }
    bucket.push(row);
  }
  return order.map(roomName => ({ roomName, rows: map.get(roomName) as WallRoomRow[] }));
}

export const RateWallCard: React.FC<Props> = ({ entry, bandTone, selectedKeys, onToggle }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const groups = groupByRoom(entry.rows);

  const cellBorder = theme === 'light' ? 'border-slate-200' : 'border-white/15';
  const cellSelected = theme === 'light' ? 'border-slate-900 bg-slate-50' : 'border-white/60 bg-white/10';

  // bandTone MUST be the last argument to cn(). cn() runs twMerge, which treats
  // border-l-* and the all-sides border-* as one conflict group and keeps
  // whichever comes later — passing bandTone before the theme classes silently
  // strips it, and the band's colour rule renders as plain grey. Caught in live
  // testing, where the class was simply absent from the rendered element.
  return (
    <div className={cn('border border-l-[3px] rounded-lg px-3 py-2',
      theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10',
      bandTone)}>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn('text-[13px] font-bold leading-tight', getTextColor())}>{entry.hotelName}</span>
        {entry.starLabel && <span className={cn('text-[10px] leading-tight', getSecondaryTextColor())}>{entry.starLabel}</span>}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {entry.inclusions && <span className={cn('text-[10px]', getSecondaryTextColor())}>{entry.inclusions}</span>}
          {entry.festiveFlag ? (
            <span className={cn('flex items-center gap-1 text-[10px] font-semibold',
              theme === 'light' ? 'text-amber-700' : 'text-amber-300')}>
              <AlertTriangle size={10} className="shrink-0" /> {entry.festiveFlag}
            </span>
          ) : (
            <span className={cn('flex items-center gap-1 text-[10px]', entry.resolutionOk ? getSecondaryTextColor() : 'text-amber-500')}>
              <Wand2 size={10} className="shrink-0" /> {entry.resolutionChip}
            </span>
          )}
        </span>
      </div>

      {entry.closedReason && (
        <div className={cn('text-[10px] mt-1', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>{entry.closedReason}</div>
      )}

      <div className="mt-1.5 space-y-1">
        {groups.map(g => (
          <div key={g.roomName} className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[12px] leading-tight', getTextColor())} style={{ flex: '1 1 150px' }}>{g.roomName}</span>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {g.rows.map(row => {
                // isQuotable, not row.quotable: the repo's tsconfig omits strict, and
                // without strictNullChecks a boolean-literal discriminant does not
                // narrow. A user-defined type predicate does.
                if (!isQuotable(row)) {
                  return (
                    <span key={row.key}
                      className={cn('px-2 py-0.5 rounded-lg border border-dashed text-[11px] opacity-60', cellBorder, getSecondaryTextColor())}>
                      {row.planLabel ? `${row.planLabel} · ` : ''}{row.blockedReason}
                    </span>
                  );
                }
                const on = selectedKeys.has(row.key);
                return (
                  <label key={row.key}
                    className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] cursor-pointer select-none transition',
                      on ? cellSelected : cellBorder)}>
                    <input type="checkbox" checked={on} onChange={() => onToggle(row.key)}
                      className="w-3 h-3 accent-slate-900 shrink-0" />
                    {row.planLabel && <span className={cn('font-bold', getTextColor())}>{row.planLabel}</span>}
                    <span className={cn('font-mono font-bold', getTextColor())}>{fmtINR(row.sellingTotal)}</span>
                    <span className={cn('font-mono text-[10px]', getSecondaryTextColor())}>
                      net {fmtINR(row.netTotal)} · +{fmtINR(row.markupAmount)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
