
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatCurrency } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { PageLoader } from '../components/ui/PageLoader';
import { 
  Search, 
  MapPin, 
  Building2, 
  BedDouble, 
  CalendarDays, 
  Sun, 
  Moon,
  Utensils,
  Users
} from 'lucide-react';

interface BlockedRate {
  id: string;
  city: string;
  hotel_name: string;
  room_category: string;
  // Weekday
  wd_single_cp: number | null;
  wd_single_map: number | null;
  wd_single_ap: number | null;
  wd_double_cp: number | null;
  wd_double_map: number | null;
  wd_double_ap: number | null;
  wd_triple_cp: number | null;
  wd_triple_map: number | null;
  wd_triple_ap: number | null;
  // Weekend
  we_single_cp: number | null;
  we_single_map: number | null;
  we_single_ap: number | null;
  we_double_cp: number | null;
  we_double_map: number | null;
  we_double_ap: number | null;
  we_triple_cp: number | null;
  we_triple_map: number | null;
  we_triple_ap: number | null;
}

export const BlockedRates = () => {
  const { getTextColor, getInputClass } = useTheme();
  
  const [rates, setRates] = useState<BlockedRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'weekday' | 'weekend'>('weekday');

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const { data, error } = await supabase
          .from('hotel_blocked_rates')
          .select('*');

        if (error) throw error;
        setRates(data || []);
      } catch (err) {
        console.error('Error fetching blocked rates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  const filteredRates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rates;
    return rates.filter(rate => 
      (rate.hotel_name?.toLowerCase() || '').includes(q) || 
      (rate.city?.toLowerCase() || '').includes(q)
    );
  }, [rates, search]);

  const formatPrice = (val: number | null) => {
    if (val === null || val === undefined || val === 0) return '-';
    return formatCurrency(val);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col items-center justify-center py-8 space-y-6">
        <h1 className={cn("text-4xl font-bold font-serif text-center", getTextColor())}>Blocked Hotel Rates</h1>
        
        {/* Search Bar */}
        <div className="relative w-full max-w-2xl group">
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className={cn("relative flex items-center px-6 py-4 rounded-2xl border shadow-lg bg-white/80 backdrop-blur-xl transition-all focus-within:ring-2 ring-blue-500/20")}>
                <Search size={22} className="opacity-40 shrink-0 mr-4" />
                <input 
                    type="text" 
                    placeholder="Search by City or Hotel Name..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent outline-none text-lg font-medium placeholder:font-normal placeholder:opacity-50"
                    autoFocus
                />
            </div>
        </div>

        {/* Toggle Switch */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 shadow-inner">
            <button
                onClick={() => setViewMode('weekday')}
                className={cn(
                    "px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-300",
                    viewMode === 'weekday' 
                        ? "bg-white text-blue-600 shadow-sm scale-100" 
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
            >
                <Sun size={16} /> Weekday Rates
            </button>
            <button
                onClick={() => setViewMode('weekend')}
                className={cn(
                    "px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-300",
                    viewMode === 'weekend' 
                        ? "bg-white text-indigo-600 shadow-sm scale-100" 
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
            >
                <Moon size={16} /> Weekend Rates
            </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRates.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-50 flex flex-col items-center">
                <Building2 size={48} className="mb-4 opacity-20" />
                <p className="text-xl font-medium">No hotels found.</p>
                <p className="text-sm mt-1">Try adjusting your search criteria.</p>
            </div>
        )}

        {filteredRates.map((rate) => {
            const prefix = viewMode === 'weekday' ? 'wd' : 'we';
            
            return (
                <Card key={rate.id} noPadding className="flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 border border-slate-200">
                    
                    {/* Hotel Header */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className={cn("text-xl font-bold font-serif text-slate-900 leading-tight")}>
                                    {rate.hotel_name}
                                </h3>
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white border rounded text-xs">
                                        <MapPin size={12} className="text-blue-500" /> {rate.city}
                                    </span>
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white border rounded text-xs">
                                        <BedDouble size={12} className="text-purple-500" /> {rate.room_category}
                                    </span>
                                </div>
                            </div>
                            <div className={cn(
                                "p-2 rounded-lg",
                                viewMode === 'weekday' ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                                {viewMode === 'weekday' ? <Sun size={20} /> : <Moon size={20} />}
                            </div>
                        </div>
                    </div>

                    {/* Rates Grid */}
                    <div className="p-5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <th className="pb-3 pl-2">Meal Plan</th>
                                        <th className="pb-3 text-right">Single</th>
                                        <th className="pb-3 text-right">Double</th>
                                        <th className="pb-3 text-right pr-2">Triple</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-mono text-slate-700">
                                    {['CP', 'MAP', 'AP'].map((plan) => {
                                        const pLower = plan.toLowerCase();
                                        // Dynamic Access: rate['wd_single_cp']
                                        const single = (rate as any)[`${prefix}_single_${pLower}`];
                                        const double = (rate as any)[`${prefix}_double_${pLower}`];
                                        const triple = (rate as any)[`${prefix}_triple_${pLower}`];

                                        return (
                                            <tr key={plan} className="group hover:bg-slate-50 transition-colors">
                                                <td className="py-3 pl-2 font-sans font-bold text-slate-500 flex items-center gap-2">
                                                    <Utensils size={12} className="opacity-40" /> {plan}
                                                </td>
                                                <td className="py-3 text-right font-bold">
                                                    {formatPrice(single)}
                                                </td>
                                                <td className="py-3 text-right font-bold text-slate-900 bg-slate-50/50 group-hover:bg-slate-100/50 rounded">
                                                    {formatPrice(double)}
                                                </td>
                                                <td className="py-3 text-right pr-2 font-bold opacity-70">
                                                    {formatPrice(triple)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Legend */}
                        <div className="mt-4 flex gap-4 text-[10px] text-slate-400 font-medium uppercase tracking-wider border-t border-slate-100 pt-3">
                            <span>CP: Breakfast</span>
                            <span>MAP: Bfast + Dinner</span>
                            <span>AP: All Meals</span>
                        </div>
                    </div>
                </Card>
            );
        })}
      </div>
    </div>
  );
};
