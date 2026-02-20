
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatCurrency } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { PageLoader } from '../components/ui/PageLoader';
import { 
  ArrowLeft, 
  MapPin, 
  FileText,
  CheckCircle2,
  XCircle,
  Table,
  CalendarDays,
  Bug,
  Tag,
  Info
} from 'lucide-react';

// --- Types ---

interface SeasonalRate {
  id: string;
  name?: string;       // Maps to 'season_name' or 'name'
  season_name?: string;
  valid_from: string;  // "YYYY-MM-DD"
  valid_until: string; // "YYYY-MM-DD"
  // Supports both schema naming conventions
  adult_double?: number; 
  adult_price?: number;
  adult_single?: number;
  single_price?: number;
  child_bed?: number;
  child_price?: number;
}

interface ItineraryItem {
  id: string;
  day_number: number;
  title: string;
  description: string;
}

interface FITPackageDetails {
  id: string;
  name: string;
  image_url?: string;
  duration?: string;
  description?: string;
  route?: string;
  inclusions?: string;
  exclusions?: string;
  tour_itineraries: ItineraryItem[];
  tour_seasonal_pricing: SeasonalRate[];
}

// --- Helper: CleanList Component ---
const CleanList = ({ text, type }: { text?: string, type: 'inclusion' | 'exclusion' }) => {
    if (!text) return <div className="text-sm opacity-50 italic">None listed.</div>;

    // Split by newline, trim, and regex remove bullets
    const items = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.replace(/^[-•*]\s*/, '')); 

    const isInclusion = type === 'inclusion';
    const Icon = isInclusion ? CheckCircle2 : XCircle;
    const colorClass = isInclusion ? 'text-emerald-600' : 'text-rose-600';
    const bgClass = isInclusion ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';

    return (
        <div className={cn("rounded-xl border p-5 h-full", bgClass)}>
            <h3 className={cn("font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-4 pb-2 border-b", isInclusion ? "text-emerald-800 border-emerald-200" : "text-rose-800 border-rose-200")}>
                <Icon size={16} /> {isInclusion ? 'Inclusions' : 'Exclusions'}
            </h3>
            <ul className="space-y-3">
                {items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed group">
                        <Icon size={16} className={cn("mt-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity", colorClass)} />
                        <span className="opacity-90 font-medium">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// --- Helper: Date Formatter ---
const formatDateShort = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const DirectPackageDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTextColor } = useTheme();

  const [pkg, setPkg] = useState<FITPackageDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('tours')
          .select(`
            *,
            tour_itineraries (*),
            tour_seasonal_pricing (*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        // DEBUGGING: Check data arrival
        console.log('📦 Package Data:', data);
        console.log('💰 Pricing Data:', data.tour_seasonal_pricing);

        // Sort Itinerary
        if (data.tour_itineraries) {
            data.tour_itineraries.sort((a: ItineraryItem, b: ItineraryItem) => a.day_number - b.day_number);
        }

        setPkg(data);
      } catch (err) {
        console.error("Error fetching FIT details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  // --- Rate Table Logic ---
  const { sortedRates, currentRateId } = useMemo(() => {
      if (!pkg || !pkg.tour_seasonal_pricing) return { sortedRates: [], currentRateId: null };

      // 1. Sort by Date Ascending
      const rates = [...pkg.tour_seasonal_pricing].sort((a, b) => 
          new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime()
      );

      // 2. Identify Current Season
      const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
      let activeId = null;

      const match = rates.find(r => {
          const from = r.valid_from ? r.valid_from.substring(0, 10) : '0000-00-00';
          const until = r.valid_until ? r.valid_until.substring(0, 10) : '9999-99-99';
          return today >= from && today <= until;
      });

      if (match) activeId = match.id;

      return { sortedRates: rates, currentRateId: activeId };
  }, [pkg]);

  if (loading) return <PageLoader />;
  if (!pkg) return <div className="p-10 text-center opacity-50">Package not found.</div>;

  return (
    <div className="max-w-7xl mx-auto pb-24 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Back Nav */}
      <button 
        onClick={() => navigate('/direct-packages')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm mb-6"
      >
        <ArrowLeft size={18} /> Back to Direct Packages
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* --- LEFT COLUMN: Itinerary & Inclusions --- */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* Header Info */}
            <div className="border-b border-slate-200 pb-6">
                <div className="flex gap-3 mb-3">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border border-slate-200">
                        {pkg.duration || 'N/A'}
                    </span>
                    <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border border-blue-100">
                        FIT / Direct
                    </span>
                </div>
                <h1 className={cn("text-3xl md:text-5xl font-bold font-serif mb-3 leading-tight text-slate-900", getTextColor())}>
                    {pkg.name}
                </h1>
                <div className="flex items-center gap-2 text-sm font-medium opacity-70">
                    <MapPin size={18} className="text-blue-500" /> 
                    <span>{pkg.route || 'Multi-City Route'}</span>
                </div>
            </div>

            {/* Hero Image */}
            <div className="h-72 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm relative group">
                <img 
                    src={pkg.image_url || "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80"} 
                    alt={pkg.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            </div>

            {/* Detailed Itinerary */}
            <div>
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <FileText size={20} />
                    </div>
                    <h2 className={cn("text-2xl font-bold font-serif", getTextColor())}>Detailed Itinerary</h2>
                </div>

                <div className="space-y-8 relative border-l-2 border-slate-200 ml-3 md:ml-4">
                    {pkg.tour_itineraries && pkg.tour_itineraries.length > 0 ? (
                        pkg.tour_itineraries.map((day) => (
                            <div key={day.id} className="pl-6 md:pl-8 relative">
                                {/* Timeline Dot */}
                                <div className={cn(
                                    "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 shadow-sm z-10",
                                    "bg-white border-blue-500" 
                                )} />
                                
                                <h3 className={cn("text-lg font-bold mb-2 flex items-center gap-2 text-slate-800", getTextColor())}>
                                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-100 uppercase tracking-wider">Day {day.day_number}</span> 
                                    {day.title}
                                </h3>
                                {/* Description with whitespace preserved */}
                                <div className={cn("text-sm leading-relaxed opacity-80 whitespace-pre-wrap text-justify font-medium text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100", getTextColor())}>
                                    {day.description || "No description available."}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="pl-8 text-sm italic opacity-50">Itinerary details pending upload.</div>
                    )}
                </div>
            </div>

            {/* Inclusions & Exclusions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
                <CleanList text={pkg.inclusions} type="inclusion" />
                <CleanList text={pkg.exclusions} type="exclusion" />
            </div>
        </div>

        {/* --- RIGHT COLUMN: Seasonal Rate Table (Sticky) --- */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-6">
            <Card className="border-t-4 border-t-slate-800 shadow-xl overflow-hidden relative" noPadding>
                
                {/* Floating Badge */}
                <div className="absolute top-4 right-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wider">
                    Master Rates
                </div>

                <div className="p-6 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Table size={20} className="text-slate-400" />
                        <h3 className={cn("text-lg font-bold font-serif", getTextColor())}>Seasonal Tariffs</h3>
                    </div>
                    <p className="text-xs opacity-50">Net rates per person in INR.</p>
                </div>

                {/* Empty State / Debug Warning */}
                {sortedRates.length === 0 && (
                    <div className="p-6 pt-0">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs flex gap-2 items-start">
                            <Bug size={16} className="shrink-0 mt-0.5" />
                            <div>
                                <strong>No Tariffs Uploaded:</strong> This package has no rows in <code>tour_seasonal_pricing</code>.
                            </div>
                        </div>
                    </div>
                )}

                {/* Rate Table */}
                {sortedRates.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-y border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <th className="py-3 px-4">Validity</th>
                                    <th className="py-3 px-2 text-right">Dbl (PP)</th>
                                    <th className="py-3 px-2 text-right">Sgl</th>
                                    <th className="py-3 px-4 text-right">Chd</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                {sortedRates.map((rate) => {
                                    const isCurrent = rate.id === currentRateId;
                                    // Handle legacy vs new column names
                                    const dbl = rate.adult_double || rate.adult_price || 0;
                                    const sgl = rate.adult_single || rate.single_price || 0;
                                    const chd = rate.child_bed || rate.child_price || 0;
                                    const seasonName = rate.season_name || rate.name || 'Standard';

                                    return (
                                        <tr 
                                            key={rate.id} 
                                            className={cn(
                                                "transition-colors hover:bg-slate-50",
                                                isCurrent ? "bg-emerald-50/60" : ""
                                            )}
                                        >
                                            <td className="py-3 px-4 relative">
                                                {isCurrent && (
                                                    <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-emerald-500 rounded-r-full" />
                                                )}
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("font-bold truncate max-w-[100px]", isCurrent ? "text-emerald-700" : "")}>
                                                            {seasonName}
                                                        </span>
                                                        {isCurrent && <span className="text-[9px] bg-emerald-500 text-white px-1.5 rounded font-bold">NOW</span>}
                                                    </div>
                                                    <span className="text-[10px] opacity-60 flex items-center gap-1 mt-0.5">
                                                        <CalendarDays size={10} />
                                                        {formatDateShort(rate.valid_from)} - {formatDateShort(rate.valid_until)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">
                                                {formatCurrency(dbl)}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono opacity-80">
                                                {sgl ? formatCurrency(sgl) : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono opacity-80">
                                                {chd ? formatCurrency(chd) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed">
                        <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
                        <p>
                            Green highlight indicates active season based on today's date. Rates are subject to change.
                        </p>
                    </div>
                </div>
            </Card>
        </div>

      </div>
    </div>
  );
};
