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
          className={cn('px-2 py-0.5 rounded-lg border border-dashed opacity-60',
            small ? 'text-[10px]' : 'text-[11px]', cellBorder, getSecondaryTextColor())}>
          {row.planLabel ? `${row.planLabel} · ` : ''}{row.blockedReason}
        </span>
      );
    }
    const on = selectedKeys.has(row.key);
    return (
      <label key={row.key}
        className={cn('flex flex-col rounded-lg border cursor-pointer select-none transition',
          small ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
          on ? cellSelected : variant === 'primary' ? cellPrimary : cellBorder)}>
        <span className="flex items-center gap-1.5">
          <input type="checkbox" checked={on} onChange={() => onToggle(row.key)}
            className="w-3 h-3 accent-slate-900 shrink-0" />
          {row.planLabel && (
            <span className={cn('font-bold', small ? 'text-[10px]' : 'text-[11px]',
              small ? getSecondaryTextColor() : getTextColor())}>{row.planLabel}</span>
          )}
          <span className={cn('font-mono font-bold', getTextColor(),
            variant === 'primary' ? 'text-[14px]' : small ? 'text-[10.5px]' : 'text-[11px]')}>
            {fmtINR(row.sellingTotal)}
          </span>
          <span className={cn('font-mono', small ? 'text-[9px]' : 'text-[10px]', getSecondaryTextColor())}>
            net {fmtINR(row.netTotal)} · +{fmtINR(row.markupAmount)}
          </span>
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

      {/* Agent-only supplier caveats — parser ambiguities, hotels printed twice
          with conflicting rates. Never exported, by contract in rateWall.ts. */}
      {entry.reviewNotes?.length ? (
        <div className={cn('flex items-start gap-1 text-[10px] leading-snug mt-1', amber)}>
          <AlertTriangle size={10} className="shrink-0 mt-[1.5px]" />
          <span>{entry.reviewNotes.join(' · ')}</span>
        </div>
      ) : null}

      <div className="mt-1.5 space-y-1">
        {groups.map(g => {
          // A 'Your dates' row is the answer; the printed columns beside it are
          // the basis it was split from. Three equal cells on one line wraps
          // badly at laptop width and, worse, invites the agent to quote a
          // weekday rate for a stay that runs over a Saturday — so the basis
          // moves to its own subordinate line beneath.
          const primary = g.rows.filter(r => r.planLabel === PRIMARY_PLAN);
          const basis = primary.length ? g.rows.filter(r => r.planLabel !== PRIMARY_PLAN) : [];
          const main = primary.length ? primary : g.rows;
          return (
            <div key={g.roomName}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[12px] leading-tight', getTextColor())} style={{ flex: '1 1 150px' }}>{g.roomName}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {main.map(row => renderCell(row, primary.length ? 'primary' : 'normal'))}
                </div>
              </div>
              {basis.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-end mt-0.5">
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
