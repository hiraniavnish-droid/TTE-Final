import React, { useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { AlertTriangle, Wand2, ChevronDown, Rows3, Star } from 'lucide-react';
import { fmtINR, isQuotable, type WallEntry, type WallRoomRow, type BudgetStatus } from '../../services/rateWall';

interface Props {
  entry: WallEntry;
  bandTone: string;              // tailwind border colour class for the left rule
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  // A page-level preference (e.g. 'CPAI') used only to pick which plan a card
  // defaults to showing. Purely a display default — every plan stays reachable
  // via the dropdown, and ticking is keyed by row.key regardless of what is
  // currently on screen, so this can never hide or lose a selection.
  preferredPlan?: string;
  // A small pill ('Premium' / 'Mid' / 'Value' / 'On request') printed on the
  // card itself. All bands now flow through ONE grid rather than each band
  // getting its own — a band with only 1-2 hotels used to leave the rest of
  // that row empty because the next band was forced onto a new row. The
  // badge is how the agent still sees which tier a card belongs to.
  bandBadgeLabel?: string;
  bandBadgeClass?: string;       // bg/text classes for the badge, chosen by the page
  // Computed by the page from entry.cheapestSelling against the agent's
  // stated per-person budget — never by the card itself, so this stays a
  // single source of truth shared with the 'hide over budget' filter.
  // Absent (or null) when no budget is set: the badge simply does not render.
  budget?: BudgetStatus | null;
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

// A room whose CPAI rate is CPAI-only in the sheet but prints a genuine
// lunch/dinner supplement gets a derived 'Your dates (MAP)' twin (see
// mapDerivable() in inlandWall.ts) — still an answer to "what does this stay
// cost", just under the other plan, so it counts as primary too.
const isPrimaryLabel = (label: string | undefined | null) =>
  label === PRIMARY_PLAN || (label || '').startsWith(`${PRIMARY_PLAN} (`);

// primary — the answer; basis — the printed rates it was split from, kept
// selectable (an agent does sometimes quote a pure weekday stay) but visually
// subordinate so the wall never presents three equal candidates per room.
type CellVariant = 'primary' | 'basis' | 'normal';

// Loose match so 'CPAI', 'CP', 'cpai (breakfast)' etc. all count as the same
// preference — the two suppliers do not spell their plans identically.
const norm = (s: string | undefined | null) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

function pickDefaultRow(rows: WallRoomRow[], preferredPlan: string | undefined): WallRoomRow {
  if (preferredPlan) {
    const pref = norm(preferredPlan);
    const exact = rows.find(r => norm(r.planLabel) === pref);
    if (exact) return exact;
    const starts = rows.find(r => norm(r.planLabel).startsWith(pref) || pref.startsWith(norm(r.planLabel)));
    if (starts) return starts;
    // A derived MAP row carries the axis text baked into its label ('Rate
    // till Sep 2026 (MAP)', 'WEEKDAYS (MAP)') — never a bare 'CPAI'/'MAPAI',
    // so it can never text-match a global preference above, and the
    // 'Default rate' quick-pick would silently do nothing on these hotels.
    // Falling back to matching on MAP-ness alone (does the label end in
    // '(MAP)'?) instead of exact text lets a 'MAPAI'-ish global preference
    // still pick this room's MAP row, and anything else still pick its
    // non-MAP row.
    const prefersMap = /map/.test(pref);
    const byMapness = rows.find(r => /\(map\)$/i.test(r.planLabel || '') === prefersMap);
    if (byMapness) return byMapness;
  }
  // No preference, or nothing matched it: prefer a quotable row over a blocked
  // one so the default view is never a dead end when a choice exists.
  return rows.find(isQuotable) || rows[0];
}

export const RateWallCard: React.FC<Props> = ({ entry, bandTone, selectedKeys, onToggle, preferredPlan, bandBadgeLabel, bandBadgeClass, budget }) => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const groups = useMemo(() => groupByRoom(entry.rows), [entry.rows]);
  const [roomIdx, setRoomIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Reset to the group's own default whenever the room changes; keyed on the
  // room name so switching back to a room the agent already adjusted returns
  // to ITS choice rather than the global default.
  const [planOverride, setPlanOverride] = useState<Record<string, string>>({});
  const [notesExpanded, setNotesExpanded] = useState(false);

  const safeRoomIdx = Math.min(roomIdx, Math.max(0, groups.length - 1));
  const activeGroup = groups[safeRoomIdx];

  const cellBorder = theme === 'light' ? 'border-slate-200 hover:border-slate-300' : 'border-white/15 hover:border-white/25';
  const cellSelected = theme === 'light'
    ? 'border-slate-900 bg-slate-50 shadow-[0_1px_6px_-2px_rgba(15,23,42,0.25)]'
    : 'border-white/60 bg-white/10 shadow-[0_1px_8px_-2px_rgba(255,255,255,0.15)]';
  const cellPrimary = theme === 'light' ? 'border-slate-400 border-[1.5px]' : 'border-white/40 border-[1.5px]';
  const amber = theme === 'light' ? 'text-amber-700' : 'text-amber-300';
  const selectCls = cn('text-[10.5px] rounded-md border px-1.5 py-1 outline-none cursor-pointer transition-colors', getInputClass());

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

  // Renders ONE room group in the current default (collapsed) view: a room
  // dropdown (only when the hotel has more than one room type), a plan
  // dropdown (only when that room has more than one priced plan), and the
  // single active rate. 'Your dates' groups skip the plan dropdown entirely —
  // there is nothing to choose, the split already answers the question — and
  // keep their existing primary+basis rendering underneath.
  // Splits a room group into its plan <select> (or null when there is only
  // one plan to show) and the rate row(s) beneath it, so the CALLER can place
  // the plan select beside the room select on one line instead of stacking
  // 'Deluxe Room' above 'CPAI' above the price — three lines of chrome for
  // what is really one choice of (room, plan).
  const buildGroup = (g: { roomName: string; rows: WallRoomRow[] }) => {
    const primary = g.rows.filter(r => isPrimaryLabel(r.planLabel));
    const basis = primary.length ? g.rows.filter(r => !isPrimaryLabel(r.planLabel)) : [];
    const main = primary.length ? primary : g.rows;

    // A room can have >1 primary row now — a plain 'Your dates' plus its
    // derived '(MAP)' twin — and that pair must be plan-selectable exactly
    // like any other multi-plan room, not just rooms with zero primary rows.
    const isPlanChoice = main.length > 1;
    // A derived label carries the axis text inside it ('Rate till Sep 2026
    // (MAP)', 'WEEKDAYS (MAP)') — unlike 'CPAI'/'MAPAI', which never change.
    // So an exact-label match on planOverride silently breaks the moment the
    // date crosses a season/weekday boundary and the axis text underneath it
    // changes: the stored 'Rate till Sep 2026 (MAP)' matches nothing in the
    // new Oct-Mar row set, and the agent's MAP choice would quietly revert to
    // CPAI without them touching the dropdown. Falling back to 'still ends in
    // (MAP)' before the global default keeps the chosen PLAN sticky even
    // when the specific axis label it was picked on stops existing.
    const priorLabel = planOverride[g.roomName];
    const activeRow = isPlanChoice
      ? (main.find(r => r.planLabel === priorLabel)
          || (priorLabel?.endsWith('(MAP)') ? main.find(r => (r.planLabel || '').endsWith('(MAP)')) : undefined)
          || pickDefaultRow(main, preferredPlan))
      : main[0];
    const shown = isPlanChoice ? [activeRow] : main;

    const planSelect = isPlanChoice ? (
      <select
        value={activeRow.planLabel || ''}
        onChange={e => setPlanOverride(p => ({ ...p, [g.roomName]: e.target.value }))}
        className={cn(selectCls, 'flex-1 min-w-0')}>
        {main.map(r => (
          <option key={r.key} value={r.planLabel || ''}>
            {r.planLabel || 'Rate'}{!isQuotable(r) ? ` — ${r.blockedReason}` : ''}
          </option>
        ))}
      </select>
    ) : null;

    // The printed WEEKDAYS/WEEKENDS columns this figure was split from are
    // deliberately NOT shown here. Once a check-in date is entered, 'Your
    // dates' already IS the answer — showing the two source columns again
    // right next to it read as three different rates for the same room, and
    // agents could not tell why. They are still one click away in 'Compare
    // all rooms & rates' for the rare case of quoting a pure weekday rate on
    // purpose; see the note prop threaded through to the header instead.
    const rates = (
      <div className="space-y-0.5">
        {shown.map(row => renderCell(row, primary.length ? 'primary' : 'normal'))}
      </div>
    );

    return { planSelect, rates, hasBasis: basis.length > 0 };
  };

  // bandTone MUST be the last argument to cn(). cn() runs twMerge, which treats
  // border-l-* and the all-sides border-* as one conflict group and keeps
  // whichever comes later — passing bandTone before the theme classes silently
  // strips it, and the band's colour rule renders as plain grey. Caught in live
  // testing, where the class was simply absent from the rendered element.
  // Budget gets its own visual channel, layered on top of (not instead of)
  // the tier's left-border colour — an agent scanning the wall should be able
  // to tell "best fit for the stated budget" apart from "cheapest overall"
  // without the two signals fighting for the same pixel. Only 'best-fit' gets
  // the strong pop (a glowing ring is a scarce visual, using it for every
  // under-budget card would just make it the new normal and stop meaning
  // anything); 'over' gets a quieter red wash so it still reads at a glance
  // without looking disabled — an agent may well still want to mention it.
  const budgetTreatment = !budget ? '' : budget.bucket === 'best-fit'
    ? (theme === 'light'
        ? 'ring-2 ring-emerald-400 shadow-[0_6px_26px_-6px_rgba(16,185,129,0.45)]'
        : 'ring-2 ring-emerald-400/60 shadow-[0_6px_26px_-6px_rgba(16,185,129,0.3)]')
    : budget.bucket === 'over'
      ? (theme === 'light' ? 'bg-rose-50/70' : 'bg-rose-500/[0.05]')
      : '';

  return (
    <div className={cn('group border border-l-[3px] rounded-xl px-3 py-2.5 transition-all duration-150',
      theme === 'light'
        ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-[0_4px_18px_-6px_rgba(15,23,42,0.14)]'
        : 'bg-white/[0.04] border-white/10 hover:border-white/20 hover:bg-white/[0.06]',
      bandTone, budgetTreatment)}>

      {/* Name on its own line, provenance beneath. At grid width the old
          right-pushed chip wrapped into the hotel name and read as one string. */}
      <div className="flex items-baseline gap-1.5">
        {bandBadgeLabel && (
          <span className={cn('text-[8.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0', bandBadgeClass)}>
            {bandBadgeLabel}
          </span>
        )}
        <span className={cn('text-[12.5px] font-bold leading-tight', getTextColor())}>{entry.hotelName}</span>
        {entry.starLabel && (
          <span className={cn('text-[9.5px] leading-tight ml-auto shrink-0', getSecondaryTextColor())}>{entry.starLabel}</span>
        )}
      </div>

      {/* Budget fit, computed by the page from the hotel's CHEAPEST quotable
          option — not whichever room/plan the dropdown happens to show — so
          this can never disagree with the 'hide over budget' filter. Absent
          entirely when no budget is set; on-request-only hotels get no badge
          at all rather than a guessed one, since there is nothing to compare. */}
      {budget && (
        <div className={cn('inline-flex items-center gap-1 text-[9.5px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full w-fit',
          budget.bucket === 'best-fit'
            ? (theme === 'light' ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-400/20 text-emerald-200')
            : budget.bucket === 'under'
              ? (theme === 'light' ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-300')
              : (theme === 'light' ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/10 text-rose-300'))}>
          {budget.bucket === 'best-fit' && <Star size={9} className="shrink-0 fill-current" />}
          {budget.bucket === 'best-fit'
            ? (budget.delta === 0 ? 'Best fit — exactly on budget' : `Best fit — ${fmtINR(budget.delta)} to spare`)
            : budget.fits ? `${fmtINR(budget.delta)} under budget` : `${fmtINR(budget.delta)} over budget`}
        </div>
      )}

      {/* GST-included and the per-hotel resolution basis ('standard dates',
          'both meal plans priced'...) are dropped from the collapsed header —
          GST applies to every hotel on both sheets, so repeating it on every
          one of 20-190 cards was pure noise. The resolution chip only matters
          when something ISN'T straightforward, so it now only appears as the
          amber flag below when resolutionOk is false. */}
      {!entry.resolutionOk && !entry.festiveFlag && (
        <div className={cn('flex items-center gap-1 text-[9.5px] mt-0.5', 'text-amber-500')}>
          <Wand2 size={9} className="shrink-0" /> {entry.resolutionChip}
        </div>
      )}

      {entry.closedReason && (
        <div className={cn('text-[10px] mt-1', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>{entry.closedReason}</div>
      )}

      {/* Supplier festive/blackout wording and agent-only supplier caveats
          (parser ambiguities, hotels printed twice with conflicting rates)
          are free text straight off the sheet and can run to a whole
          paragraph — 'Fortune Statue Of Unity Kevadia' prints six festival
          windows in one remark. Clamped to 2 lines with a toggle so one long
          note cannot blow out every card's height; never exported, by
          contract in rateWall.ts / formatClientExport. */}
      {(entry.festiveFlag || entry.reviewNotes?.length) ? (
        <div className="mt-1">
          <div className={cn('flex items-start gap-1 text-[10px] leading-snug', amber, !notesExpanded && 'line-clamp-2')}>
            <AlertTriangle size={10} className="shrink-0 mt-[1.5px]" />
            <span>{[entry.festiveFlag, ...(entry.reviewNotes || [])].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" onClick={() => setNotesExpanded(v => !v)}
            className={cn('text-[9px] font-semibold underline underline-offset-2 mt-0.5 transition-opacity hover:opacity-70', getSecondaryTextColor())}>
            {notesExpanded ? 'Show less' : 'Show full note'}
          </button>
        </div>
      ) : null}

      {/* Collapsed default: one room, one plan, one rate — a room dropdown
          only appears when the hotel has more than one room type. This is
          what keeps the card to a couple of rows instead of listing every
          room x every plan, so 5-6 hotels fit across a row instead of 1-2. */}
      <div className="mt-1.5">
        {/* The collapsed room/plan pickers are hidden once expanded — the full
            listing below already contains this exact combination, and showing
            both left the same tick box appearing to duplicate itself.
            Room select and plan select share ONE row rather than stacking —
            'Deluxe Room' above 'CPAI' above the price was three lines of
            chrome for a single (room, plan) choice. */}
        {!expanded && groups.length > 0 && (() => {
          const { planSelect, rates } = buildGroup(activeGroup);
          const roomSelect = groups.length > 1 ? (
            <select
              value={safeRoomIdx}
              onChange={e => setRoomIdx(Number(e.target.value))}
              className={cn(selectCls, 'flex-1 min-w-0')}>
              {groups.map((g, i) => <option key={g.roomName} value={i}>{g.roomName}</option>)}
            </select>
          ) : (
            <div className={cn('text-[11.5px] leading-tight flex-1 min-w-0 truncate self-center', getTextColor())}>
              {activeGroup.roomName}
            </div>
          );
          return (
            <>
              <div className="flex items-center gap-1 mb-1">
                {roomSelect}
                {planSelect}
              </div>
              {rates}
            </>
          );
        })()}

        {/* Every room x every plan, exactly as before — for ticking several
            combinations from the same hotel (e.g. CPAI AND MAPAI, or two room
            types) without having to flip the dropdowns back and forth. */}
        {groups.length > 0 && (groups.length > 1 || (groups[0].rows.length > 1 && !groups[0].rows.some(r => r.planLabel === PRIMARY_PLAN))) && (
          <button type="button" onClick={() => setExpanded(v => !v)}
            className={cn('flex items-center gap-1 mt-2 text-[9.5px] font-semibold transition-colors hover:text-slate-900',
              theme === 'dark' && 'hover:text-white', getSecondaryTextColor())}>
            <Rows3 size={10} className="shrink-0" />
            {expanded ? 'Hide all rooms & rates' : 'Compare all rooms & rates'}
            <ChevronDown size={10} className={cn('shrink-0 transition-transform duration-200', expanded && 'rotate-180')} />
          </button>
        )}

        {expanded && (
          <div className={cn('mt-1.5 pt-1.5 border-t space-y-1.5', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
            {groups.map(g => (
              <div key={g.roomName}>
                <div className={cn('text-[11px] leading-tight mb-0.5', getTextColor())}>{g.roomName}</div>
                {(() => {
                  const primary = g.rows.filter(r => isPrimaryLabel(r.planLabel));
                  const basis = primary.length ? g.rows.filter(r => !isPrimaryLabel(r.planLabel)) : [];
                  const main = primary.length ? primary : g.rows;
                  return (
                    <>
                      <div className="space-y-0.5">
                        {main.map(row => renderCell(row, primary.length ? 'primary' : 'normal'))}
                      </div>
                      {basis.length > 0 && (
                        <div className="mt-1 pl-2 space-y-0.5">
                          <span className={cn('text-[9px] font-bold uppercase tracking-wider', getSecondaryTextColor())}>Printed basis</span>
                          {basis.map(row => renderCell(row, 'basis'))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
