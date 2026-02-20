
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatCurrency } from '../../utils/helpers';
import { Sparkles, ArrowRight, MapPin, Star } from 'lucide-react';
import { Card } from '../ui/Card';
import { Hotel, ItineraryPackage } from '../../types';
import { FALLBACK_IMG, calculateGalleryPrice, generateRouteSummary } from './utils';

interface GalleryViewProps {
  packages: ItineraryPackage[];
  pax: number;
  gallerySharingMode: 'Double' | 'Quad';
  setGallerySharingMode: (mode: 'Double' | 'Quad') => void;
  onSelectPackage: (pkgId: string, tier: 'Budget' | 'Premium') => void;
  onOpenCustomBuilder: () => void;
  hotelData: Record<string, Hotel[]>;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  packages, pax, gallerySharingMode, setGallerySharingMode, onSelectPackage, onOpenCustomBuilder, hotelData
}) => {
  const { theme, getTextColor } = useTheme();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <button 
            onClick={onOpenCustomBuilder}
            className={cn(
                "flex flex-col items-center justify-center text-center p-8 rounded-2xl border-2 border-dashed transition-all group h-[380px]", 
                theme === 'light' ? "border-blue-300 bg-blue-50/50 hover:bg-blue-50" : "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20"
            )}
        >
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles size={32} className="text-blue-600" />
            </div>
            <h3 className={cn("text-xl font-bold font-serif mb-2", getTextColor())}>Create Your Own</h3>
            <p className="text-sm opacity-60 max-w-[200px] leading-relaxed">
                Build a fully customized day-by-day itinerary from scratch.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm font-bold text-blue-600 group-hover:underline">
                Start Building <ArrowRight size={16} />
            </div>
        </button>

        {packages.map((pkg) => {
            const budgetTotal = calculateGalleryPrice(pkg, 'Budget', pax, gallerySharingMode, hotelData);
            const premiumTotal = calculateGalleryPrice(pkg, 'Premium', pax, gallerySharingMode, hotelData);
            const budgetPerPerson = pax > 0 ? Math.round(budgetTotal / pax) : 0;
            const premiumPerPerson = pax > 0 ? Math.round(premiumTotal / pax) : 0;

            return (
                <Card key={pkg.id} noPadding className="flex flex-col hover:shadow-xl transition-all duration-300 overflow-hidden group border-0 ring-1 ring-slate-200">
                    <div className="h-48 relative overflow-hidden bg-slate-200">
                        <img 
                            src={pkg.img || FALLBACK_IMG} 
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                            alt={pkg.name || "Package Image"}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 text-white">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2 py-1 rounded border border-white/20">
                                {pkg.days - 1}N / {pkg.days}D
                            </span>
                            <h3 className="text-xl font-bold font-serif mt-2 shadow-sm">{pkg.name}</h3>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase px-1">Mode</span>
                            <select 
                                value={gallerySharingMode}
                                onChange={(e) => setGallerySharingMode(e.target.value as any)}
                                className="text-[10px] font-bold bg-transparent outline-none cursor-pointer text-slate-800"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="Double">2 Pax</option>
                                <option value="Quad">4 Pax</option>
                            </select>
                        </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                        <div className="mb-4">
                            <div className={cn("flex items-start gap-1.5 text-xs font-bold uppercase tracking-wider opacity-60 mb-1", getTextColor())}>
                                <MapPin size={12} className="mt-0.5" /> Route Summary
                            </div>
                            <p className={cn("text-sm font-medium leading-snug", getTextColor())}>
                                {generateRouteSummary(pkg.route)}
                            </p>
                        </div>
                        <div className="space-y-3 mt-auto">
                            <button onClick={() => onSelectPackage(pkg.id, 'Budget')} className="w-full flex justify-between items-center p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group/btn">
                                <div className="text-left">
                                    <div className="text-xs font-bold uppercase text-slate-500">Budget</div>
                                    <div className="text-lg font-mono font-bold text-slate-900 group-hover/btn:text-blue-700">{formatCurrency(budgetTotal)}</div>
                                    <div className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Total for {pax} Adults<span className="opacity-60 ml-1">(@ {formatCurrency(budgetPerPerson)}/pp)</span></div>
                                </div>
                                <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all text-blue-500" />
                            </button>
                            <button onClick={() => onSelectPackage(pkg.id, 'Premium')} className="w-full flex justify-between items-center p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all group/btn">
                                <div className="text-left">
                                    <div className="text-xs font-bold uppercase text-slate-500">Premium</div>
                                    <div className="text-lg font-mono font-bold text-slate-900 group-hover/btn:text-amber-700">{formatCurrency(premiumTotal)}</div>
                                    <div className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Total for {pax} Adults<span className="opacity-60 ml-1">(@ {formatCurrency(premiumPerPerson)}/pp)</span></div>
                                </div>
                                <div className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" /><ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all text-amber-600" /></div>
                            </button>
                        </div>
                    </div>
                </Card>
            );
        })}
    </div>
  );
};
