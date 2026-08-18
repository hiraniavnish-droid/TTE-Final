import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { X, Copy, Download, Send, Loader2, ClipboardList } from 'lucide-react';
import { fmtINR, type WallEntry, type QuotableRow } from '../../services/rateWall';

interface Selection {
  entry: WallEntry;
  row: QuotableRow;
}

interface Props {
  selections: Selection[];
  onRemove: (key: string) => void;
  total: number;
  onCopy: () => void;
  onPdf: () => void;
  onSend: () => void;
  pdfBusy?: boolean;
}

// A persistent, always-visible review list of what is currently ticked, so an
// agent can see and untick a selection without hunting back through the wall
// for the one card it came from. The wall stays full width; this is a fixed
// narrow column beside it, not a replacement for the header's running count.
//
// No running total here — the header above the wall already carries it, and
// repeating it a second time added a number without adding information. What
// WAS missing per line was the margin: the price alone reads as a net cost
// unless the markup sitting on top of it is spelled out right beside it.
export const RateWallTray: React.FC<Props> = ({ selections, onRemove, total, onCopy, onPdf, onSend, pdfBusy }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className={cn('w-full lg:w-[248px] lg:shrink-0 lg:sticky lg:top-4 rounded-2xl border p-3 space-y-2.5 transition-shadow',
      isLight ? 'bg-white border-slate-200 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]' : 'bg-white/[0.04] border-white/10 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.35)]')}>
      <div className="flex items-center gap-1.5">
        <ClipboardList size={13} className={cn('shrink-0', getSecondaryTextColor())} />
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', getSecondaryTextColor())}>Selected</span>
        {selections.length > 0 && (
          <span className={cn('ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            isLight ? 'bg-slate-900 text-white' : 'bg-white/15 text-white')}>{selections.length}</span>
        )}
      </div>

      {selections.length === 0 ? (
        <p className={cn('text-[11px] leading-snug py-4 text-center', getSecondaryTextColor())}>
          Tick any rate on the wall to add it here.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[54vh] overflow-y-auto pr-0.5 -mr-0.5">
          {selections.map(s => (
            <div key={s.row.key}
              className={cn('group relative rounded-xl border px-2.5 py-2 transition-colors',
                isLight ? 'border-slate-100 bg-slate-50/60 hover:bg-slate-50' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]')}>
              <button type="button" onClick={() => onRemove(s.row.key)}
                title="Remove from selection"
                className={cn('absolute top-1.5 right-1.5 p-0.5 rounded-md opacity-60 hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 transition-all', getSecondaryTextColor())}>
                <X size={12} />
              </button>
              <div className={cn('text-[10.5px] font-bold leading-tight truncate pr-4', getTextColor())}>{s.entry.hotelName}</div>
              <div className={cn('text-[9.5px] leading-tight truncate mt-0.5', getSecondaryTextColor())}>
                {s.row.roomName}{s.row.planLabel ? ` · ${s.row.planLabel}` : ''}
              </div>
              {/* Net + margin, same as the card it was ticked from — without
                  this, the tray's single figure reads as the net cost rather
                  than the already-marked-up price it actually is. */}
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={cn('text-[12.5px] font-mono font-bold', getTextColor())}>{fmtINR(s.row.sellingTotal)}</span>
                <span className={cn('text-[9px] font-mono', getSecondaryTextColor())}>
                  net {fmtINR(s.row.netTotal)} · +{fmtINR(s.row.markupAmount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        <button type="button" onClick={onCopy} title="Copy as WhatsApp text"
          className={cn('flex items-center justify-center py-1.5 rounded-lg border text-[11px] font-bold transition active:scale-[0.96]',
            isLight ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10')}>
          <Copy size={13} />
        </button>
        <button type="button" onClick={onPdf} disabled={pdfBusy} title="Download PDF"
          className="flex items-center justify-center py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold transition hover:bg-slate-800 active:scale-[0.96] disabled:opacity-60 disabled:active:scale-100">
          {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        </button>
        <button type="button" onClick={onSend} title="Share on WhatsApp"
          className="flex items-center justify-center py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold transition hover:bg-emerald-500 active:scale-[0.96] shadow-[0_2px_10px_-2px_rgba(16,185,129,0.5)]">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};
