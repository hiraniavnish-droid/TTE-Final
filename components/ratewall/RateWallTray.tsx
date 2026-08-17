import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Copy, Download, Loader2 } from 'lucide-react';
import { fmtINR } from '../../services/rateWall';

interface Props {
  count: number;
  clientTotal: number;
  pdfBusy: boolean;
  onCopy: () => void;
  onPdf: () => void;
  onWhatsApp: () => void;
}

export const RateWallTray: React.FC<Props> = ({ count, clientTotal, pdfBusy, onCopy, onPdf, onWhatsApp }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  return (
    <div className={cn('rounded-2xl border p-4 lg:sticky lg:top-4',
      theme === 'light' ? 'bg-white border-slate-200 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]' : 'bg-white/5 border-white/10')}>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className={cn('text-lg font-bold', getTextColor())}>{count}</span>
        <span className={cn('text-[12px]', getSecondaryTextColor())}>selected</span>
        {count > 0 && (
          <span className={cn('ml-auto font-mono font-bold text-[14px]', getTextColor())}>{fmtINR(clientTotal)}</span>
        )}
      </div>

      {count === 0 && (
        <p className={cn('text-[12px] text-center py-5', getSecondaryTextColor())}>
          Tick any room to add it to the quote.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onPdf} disabled={pdfBusy}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 active:scale-[0.97] transition disabled:opacity-60">
          {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF
        </button>
        <button onClick={onCopy}
          className={cn('flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-bold border active:scale-[0.97] transition',
            theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80')}>
          <Copy size={15} /> Copy
        </button>
      </div>
      <button onClick={onWhatsApp}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-500 active:scale-[0.97] transition">
        Share on WhatsApp
      </button>
      <p className={cn('text-[10px] text-center mt-2', getSecondaryTextColor())}>
        Exports carry final rates only — never net or margin.
      </p>
    </div>
  );
};
