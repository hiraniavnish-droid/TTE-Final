import React, { useId } from 'react';
import { Check, FileText } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { isSuite, type TCTentType } from '../../services/rannUtsavRates';

const categories: TCTentType[] = ['Super Premium Tent', 'Premium Tent', 'Deluxe AC Swiss Cottage', 'Non-AC Swiss Cottage'];
interface Props {
  tent: TCTentType;
  multiple: boolean;
  extraCategories: TCTentType[];
  onMultipleChange: (value: boolean) => void;
  onExtraCategoriesChange: (value: TCTentType[]) => void;
}
/** The priced tent is always included; only additional categories need input. */
export function RannPdfOptions({ tent, multiple, extraCategories, onMultipleChange, onExtraCategoriesChange }: Props) {
  const { theme } = useTheme();
  const id = useId();
  const enabled = multiple && !isSuite(tent);
  const count = 1 + (enabled ? extraCategories.filter(c => c !== tent).length : 0);
  return (
    <section aria-label="Quotation PDF options" className={cn('mt-3 rounded-xl border p-3 space-y-3', theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold"><FileText size={15} /> Quotation PDF</span>
        <span className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', theme === 'light' ? 'bg-white text-slate-600 border border-slate-200' : 'bg-white/10 text-white/80')}>{count === 1 ? '1 selected tent' : `${count} tent options`}</span>
      </div>
      <div className="flex items-start gap-2 text-xs"><Check size={14} className="shrink-0 text-emerald-600" /><p><span className="font-semibold">{tent}</span><span className="block mt-0.5 opacity-65">Included automatically from your quotation.</span></p></div>
      {!isSuite(tent) && <>
        <label htmlFor={id} className="flex items-center justify-between gap-3 min-h-8 cursor-pointer text-xs font-medium">
          Include multiple tent options
          <span className="relative inline-flex h-5 w-9 shrink-0">
            <input id={id} type="checkbox" role="switch" checked={enabled} onChange={e => onMultipleChange(e.target.checked)} className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <span aria-hidden="true" className={cn('pointer-events-none h-5 w-9 rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-slate-500', enabled ? 'bg-slate-900' : 'bg-slate-300')}>
              <span className={cn('block m-0.5 h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none', enabled ? 'translate-x-4' : 'translate-x-0')} />
            </span>
          </span>
        </label>
        {enabled && <fieldset className="space-y-2">
          <legend className="text-[11px] opacity-65 mb-2">Add alternatives to the same PDF</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categories.map(category => {
              const current = category === tent;
              const selected = current || extraCategories.includes(category);
              return <label key={category} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug min-h-10', current ? 'cursor-default' : 'cursor-pointer', theme === 'light' ? selected ? 'bg-white border-slate-500' : 'bg-white border-slate-200 hover:border-slate-400' : selected ? 'bg-white/10 border-white/40' : 'border-white/10 hover:border-white/30')}>
                <input type="checkbox" checked={selected} disabled={current} aria-label={category} onChange={() => onExtraCategoriesChange(selected ? extraCategories.filter(c => c !== category) : [...extraCategories, category])} className="h-3.5 w-3.5 shrink-0 accent-slate-900" />
                <span>{category}{current && <span className="block text-[10px] opacity-60">Current quotation</span>}</span>
              </label>;
            })}
          </div>
          <p className="text-[11px] opacity-65">{count === 1 ? 'Add another tent to export multiple options.' : 'One PDF with photos and prices for these tents.'}</p>
        </fieldset>}
      </>}
    </section>
  );
}
