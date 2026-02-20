
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatCurrency } from '../../utils/helpers';
import { ChevronLeft, Settings, Info, Car, Download, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { ItineraryPricing } from './types';

interface PricingControlDeckProps {
  pricing: ItineraryPricing | null;
  markupType: 'percent' | 'fixed';
  setMarkupType: (type: 'percent' | 'fixed') => void;
  markupValue: number;
  setMarkupValue: (val: number) => void;
  onBack: () => void;
  onOpenFleetModal: () => void;
  onGeneratePDF: () => void;
  onCopyQuote: () => void;
  isPdfLoading: boolean;
  copyFeedback: boolean;
}

export const PricingControlDeck: React.FC<PricingControlDeckProps> = ({ 
  pricing, markupType, setMarkupType, markupValue, setMarkupValue, 
  onBack, onOpenFleetModal, onGeneratePDF, onCopyQuote, 
  isPdfLoading, copyFeedback 
}) => {
  const { theme } = useTheme();
  const [showMarkup, setShowMarkup] = useState(false);

  return (
    <div className={cn(
        "border-b backdrop-blur-xl transition-colors flex flex-col p-3 md:p-4 gap-3 md:gap-4",
        theme === 'light' ? "bg-white/95 border-slate-200" : "bg-slate-900/95 border-white/10"
    )}>
        <div className="flex items-center justify-between">
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
                <ChevronLeft size={16} /> <span className="hidden md:inline">Back to Gallery</span><span className="md:hidden">Back</span>
            </button>

            {/* Mobile-friendly Markup Toggle */}
            <div className="flex items-center gap-2 md:gap-4 bg-gray-50 p-1 md:p-1.5 rounded-lg border border-gray-200">
                <button 
                    onClick={() => setShowMarkup(!showMarkup)} 
                    className="md:hidden p-1 text-slate-400"
                >
                    <Settings size={14} />
                </button>
                
                <div className={cn("flex flex-col px-2", showMarkup ? "flex" : "hidden md:flex")}>
                    <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                        <Info size={10} /> Net
                    </span>
                    <span className="text-xs md:text-sm font-mono font-bold text-gray-500">
                        {formatCurrency(pricing?.netTotal || 0)}
                    </span>
                </div>
                
                <div className={cn("h-8 w-px bg-gray-300", showMarkup ? "block" : "hidden md:block")}></div>
                
                <div className={cn("flex items-center gap-2", showMarkup ? "flex" : "hidden md:flex")}>
                    <button 
                        onClick={() => setMarkupType(markupType === 'percent' ? 'fixed' : 'percent')}
                        className="px-2 py-1 text-[10px] font-bold bg-white rounded shadow-sm min-w-[24px]"
                    >
                        {markupType === 'percent' ? '%' : '₹'}
                    </button>
                    <input 
                        type="number" 
                        value={markupValue}
                        onChange={(e) => setMarkupValue(Number(e.target.value))}
                        className="w-12 md:w-16 bg-transparent text-center text-sm font-bold outline-none"
                        placeholder="0"
                    />
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-500/10">
            <div className="flex items-baseline gap-2 w-full md:w-auto justify-between md:justify-start">
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl md:text-3xl font-mono font-bold text-blue-600 leading-none tracking-tight">
                        {formatCurrency(pricing?.finalTotal || 0)}
                    </p>
                    <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase">Total</span>
                </div>
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-500 text-[10px] md:text-xs font-bold border border-gray-200">
                    @ {formatCurrency(pricing?.perPerson || 0)} / person
                </span>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
                <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={onOpenFleetModal}
                    className="flex-1 md:flex-none h-9 md:h-10 px-3 md:px-4 border-dashed border-2 bg-blue-50/50 text-blue-600 hover:bg-blue-100/50 hover:border-blue-300"
                >
                    <Car size={16} /> <span className="ml-1 md:ml-2 text-xs md:text-sm">Fleet</span>
                </Button>

                <Button variant="secondary" onClick={onGeneratePDF} disabled={isPdfLoading} className="flex-1 md:flex-none h-9 md:h-10 px-3 md:px-4 min-w-0">
                    {isPdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    <span className="ml-1 md:ml-2 text-xs md:text-sm truncate">{isPdfLoading ? '...' : 'PDF'}</span>
                </Button>
                <Button onClick={onCopyQuote} className={cn("flex-1 md:flex-none h-9 md:h-10 px-3 md:px-4 gap-1 md:gap-2 transition-all min-w-0", copyFeedback ? "bg-emerald-600" : "bg-blue-600")}>
                    {copyFeedback ? <Check size={16} /> : <Copy size={16} />}
                    <span className="text-xs md:text-sm truncate">{copyFeedback ? "Copied" : "Copy"}</span>
                </Button>
            </div>
        </div>
    </div>
  );
};
