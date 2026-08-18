import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { X, Copy, Download, Send, Loader2 } from 'lucide-react';
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
export const RateWallTray: React.FC<Props> = ({ selections, onRemove, total, onCopy, onPdf, onSend, pdfBusy }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  return (
    <div className={cn('w-[248px] shrink-0 sticky top-4 rounded-xl border p-2.5 space-y-2',
      theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', getSecondaryTextColor())}>Selected</span>
        <span className={cn('text-[13px] font-bold font-mono', getTextColor())}>{selections.length ? fmtINR(total) : '—'}</span>
      </div>

      {selections.length === 0 ? (
        <p className={cn('text-[11px] leading-snug py-3 text-center', getSecondaryTextColor())}>
          Tick any rate on the wall to add it here.
        </p>
      ) : (
        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-0.5">
          {selections.map(s => (
            <div key={s.row.key} className={cn('flex items-start gap-1.5 rounded-lg border px-2 py-1.5',
              theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
              <div className="min-w-0 flex-1">
                <div className={cn('text-[10.5px] font-bold leading-tight truncate', getTextColor())}>{s.entry.hotelName}</div>
                <div className={cn('text-[9.5px] leading-tight truncate', getSecondaryTextColor())}>
                  {s.row.roomName}{s.row.planLabel ? ` · ${s.row.planLabel}` : ''}
                </div>
                <div className={cn('text-[10.5px] font-mono font-bold mt-0.5', getTextColor())}>{fmtINR(s.row.sellingTotal)}</div>
              </div>
              <button type="button" onClick={() => onRemove(s.row.key)}
                title="Remove from selection"
                className={cn('shrink-0 p-0.5 rounded hover:bg-rose-500/10', getSecondaryTextColor())}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 pt-1">
        <button type="button" onClick={onCopy} title="Copy as WhatsApp text"
          className={cn('flex items-center justify-center py-1.5 rounded-lg border text-[11px] font-bold',
            theme === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white/80')}>
          <Copy size={13} />
        </button>
        <button type="button" onClick={onPdf} disabled={pdfBusy} title="Download PDF"
          className="flex items-center justify-center py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold disabled:opacity-60">
          {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        </button>
        <button type="button" onClick={onSend} title="Share on WhatsApp"
          className="flex items-center justify-center py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};
