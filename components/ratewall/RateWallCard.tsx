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

// The label an adapter uses for the row that answers the agent's actual
// question, as opposed to the printed columns it was derived from. Inland's
// weekday/weekend rooms emit it; Rajarshi emits no such row, so every Rajarshi
// group takes the 'normal' path below and renders exactly as it did before.
const PRIMARY_PLAN = 'Your dates';

// primary — the answer; basis — the printed rates it was split from, kept
// selectable (an agent does sometimes quote a pure weekday stay) but visually
// subordinate so the wall never presents three equal candidates per room.
type CellVariant = 'primary' | 'basis' | 'normal';

export const RateWallCard: React.FC<Props> = ({ entry, bandTone, selectedKeys, onToggle }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const groups = groupByRoom(entry.rows);

  const cellBorder = theme === 'light' ? 'border-slate-200' : 'border-white/15';
  const cellSelected = theme === 'light' ? 'border-slate-900 bg-slate-50' : 'border-white/60 bg-white/10';
  const cellPrimary = theme === 'light' ? 'border-slate-400 border-[1.5px]' : 'border-white/40 border-[1.5px]';
  const amber = theme === 'light' ? 'text-amber-700' : 'text-amber-300';

  const renderCell = (row: WallRoomRow, variant: CellVariant) => {
    const small = variant === 'basis';
    // isQuotable, not row.quotable: the repo's tsconfig omits strict, and
    // without strictNullChecks a boolean-literal discriminant does not
    // narrow. A user-defined type predicate does.
    if (!isQuotable(row)) {
      return (
        <span key={row.key}
          className={cn('flex items-center gap-1.5 w-full px-2 py-0.5 rounded-lg border border-dashed opacity-60',
            small ? 'text-[10px]' : 'text-[10.5px]', cellBorder, getSecondaryTextColor())}>
          {row.planLabel && <span className="truncate">{row.planLabel}</span>}
          <span className="ml-auto shrink-0 font-semibold">{row.blockedReason}</span>
        </span>
      );
    }
    const on = selectedKeys.has(row.key);
    return (
      <label key={row.key}
        className={cn('flex flex-col w-full rounded-lg border cursor-pointer select-none transition',
          small ? 'px-1.5 py-0.5' : 'px-2 py-1',
          on ? cellSelected : variant === 'primary' ? cellPrimary : cellBorder)}>
        {/* Label left, price hard right. In a narrow grid card the two would
            otherwise collide once a plan label runs long. */}
        <span className="flex items-center gap-1.5 w-full">
          <input type="checkbox" checked={on} onChange={() => onToggle(row.key)}
            className="w-3 h-3 accent-slate-900 shrink-0" />
          {row.planLabel && (
            <span className={cn('font-bold truncate', small ? 'text-[10px]' : 'text-[11px]',
              small ? getSecondaryTextColor() : getTextColor())}>{row.planLabel}</span>
          )}
          <span className={cn('font-mono font-bold ml-auto shrink-0', getTextColor(),
            variant === 'primary' ? 'text-[14px]' : small ? 'text-[10.5px]' : 'text-[12px]')}>
            {fmtINR(row.sellingTotal)}
          </span>
        </span>
        <span className={cn('font-mono pl-[18px]', small ? 'text-[9px]' : 'text-[9.5px]', getSecondaryTextColor())}>
          net {fmtINR(row.netTotal)} · +{fmtINR(row.markupAmount)}
        </span>
        {/* Agent-only provenance. formatClientExport never prints it. */}
        {row.derivedNote && (
          <span className={cn('text-[9.5px] leading-tight pl-[18px]', getSecondaryTextColor())}>{row.derivedNote}</span>
        )}
        {/* The opposite: a qualifier that must reach the customer, so it is
            unmissable on the cell rather than tucked into a tooltip. */}
        {row.clientNote && (
          <span className={cn('flex items-start gap-1 text-[9.5px] font-semibold leading-tight pl-[18px]', amber)}>
            <AlertTriangle size={9} className="shrink-0 mt-[1.5px]" /> {row.clientNote}
          </span>
        )}
      </label>
    );
  };

  // bandTone MUST be the last argument to cn(). cn() runs twMerge, which treats
  // border-l-* and the all-sides border-* as one conflict group and keeps
  // whichever comes later — passing bandTone before the theme classes silently
  // strips it, and the band's colour rule renders as plain grey. Caught in live
  // testing, where the class was simply absent from the rendered element.
  return (
    <div className={cn('border border-l-[3px] rounded-lg px-3 py-2',
      theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10',
      bandTone)}>

      {/* Name on its own line, provenance beneath. At grid width the old
          right-pushed chip wrapped into the hotel name and read as one string. */}
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-[12.5px] font-bold leading-tight', getTextColor())}>{entry.hotelName}</span>
        {entry.starLabel && (
          <span className={cn('text-[9.5px] leading-tight ml-auto shrink-0', getSecondaryTextColor())}>{entry.starLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
        {entry.inclusions && <span className={cn('text-[9.5px]', getSecondaryTextColor())}>{entry.inclusions}</span>}
        {entry.festiveFlag ? (
          <span className={cn('flex items-center gap-1 text-[9.5px] font-semibold',
            theme === 'light' ? 'text-amber-700' : 'text-amber-300')}>
            <AlertTriangle size={9} className="shrink-0" /> {entry.festiveFlag}
          </span>
        ) : (
          <span className={cn('flex items-center gap-1 text-[9.5px]', entry.resolutionOk ? getSecondaryTextColor() : 'text-amber-500')}>
            <Wand2 size={9} className="shrink-0" /> {entry.resolutionChip}
          </span>
        )}
      </div>

      {entry.closedReason && (
        <div className={cn('text-[10px] mt-1', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>{entry.closedReason}</div>
      )}

      {/* Agent-only supplier caveats — parser ambiguities, hotels printed twice
          with conflicting rates. Never exported, by contract in rateWall.ts. */}
      {entry.reviewNotes?.length ? (
        <div className={cn('flex items-start gap-1 text-[10px] leading-snug mt-1', amber)}>
          <AlertTriangle size={10} className="shrink-0 mt-[1.5px]" />
          <span>{entry.reviewNotes.join(' · ')}</span>
        </div>
      ) : null}

      {/* The card sits in a multi-column grid, so it is roughly 280-340px wide.
          Room name and rates therefore STACK rather than sitting on one line
          pushed to opposite edges — that older full-width layout left a large
          empty gutter down the middle of every row. */}
      <div className="mt-1.5 space-y-1.5">
        {groups.map(g => {
          // A 'Your dates' row is the answer; the printed columns beside it are
          // the basis it was split from. Keeping the basis visually subordinate
          // stops the agent quoting a weekday rate for a stay that runs over a
          // Saturday.
          const primary = g.rows.filter(r => r.planLabel === PRIMARY_PLAN);
          const basis = primary.length ? g.rows.filter(r => r.planLabel !== PRIMARY_PLAN) : [];
          const main = primary.length ? primary : g.rows;
          return (
            <div key={g.roomName}>
              <div className={cn('text-[11.5px] leading-tight mb-0.5', getTextColor())}>{g.roomName}</div>
              <div className="space-y-0.5">
                {main.map(row => renderCell(row, primary.length ? 'primary' : 'normal'))}
              </div>
              {basis.length > 0 && (
                <div className="mt-1 pl-2 space-y-0.5">
                  <span className={cn('text-[9px] font-bold uppercase tracking-wider', getSecondaryTextColor())}>Printed basis</span>
                  {basis.map(row => renderCell(row, 'basis'))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
