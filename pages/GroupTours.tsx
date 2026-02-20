
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageLoader } from '../components/ui/PageLoader';
import { 
  Calendar, 
  MapPin, 
  ArrowRight,
  Search,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';

// Loose type definition for Safe Mode fetching
interface Tour {
  id: string;
  name: string;
  duration?: string;
  route?: string;
  // Arrays might be null/undefined if joins fail, so we type them optionally
  tour_pricing?: Array<{
    currency?: string;
    adult_double?: number;
  }>;
  tour_dates?: Array<{
    start_date?: string;
  }>;
}

const TourCard: React.FC<{ tour: Tour }> = ({ tour }) => {
  const { theme, getTextColor } = useTheme();
  const navigate = useNavigate();

  // --- SAFE MODE DATA PROCESSING ---

  // 1. Price Logic: Default to 0 if missing
  const pricingRaw = tour.tour_pricing && tour.tour_pricing.length > 0 ? tour.tour_pricing[0] : null;
  const price = pricingRaw?.adult_double || 0;
  const currencyCode = pricingRaw?.currency || 'EUR';
  const symbol = currencyCode === 'EUR' ? '€' : currencyCode === 'CHF' ? 'CHF ' : '₹';
  
  // 2. Date Logic: Handle missing dates safely
  const nextDeparture = useMemo(() => {
    if (!tour.tour_dates || tour.tour_dates.length === 0) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validDates = tour.tour_dates
      .filter(d => d.start_date) // Ensure date string exists
      .map(d => ({ raw: d, dateObj: new Date(d.start_date!) })) // Map to object
      .filter(d => !isNaN(d.dateObj.getTime()) && d.dateObj.getTime() >= today.getTime()) // Valid & Future
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()); // Sort ASC

    return validDates.length > 0 ? validDates[0].raw : null;
  }, [tour.tour_dates]);

  return (
    <Card noPadding className="flex flex-col h-full hover:shadow-2xl transition-all duration-300 group relative cursor-pointer" onClick={() => navigate(`/group-tours/${tour.id}`)}>
      {/* Visual Header */}
      <div className="p-6 pb-2">
        <div className="flex justify-between items-start mb-4">
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            theme === 'light' ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-white/5 border-white/10 text-white/50"
          )}>
            {tour.duration || 'N/A'}
          </div>
          
          {nextDeparture && nextDeparture.start_date ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
              <Calendar size={12} /> {new Date(nextDeparture.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 uppercase">
              <AlertCircle size={12} /> Check Dates
            </span>
          )}
        </div>

        <h3 className={cn("text-xl font-bold font-serif leading-tight group-hover:text-blue-600 transition-colors", getTextColor())}>
            {tour.name || 'Untitled Tour'}
        </h3>
        <div className="flex items-center gap-1.5 text-xs opacity-60 mt-2">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{tour.route || 'Route details pending'}</span>
        </div>
      </div>

      {/* Pricing Module */}
      <div className="p-6 pt-4 mt-auto">
        <div className="flex items-end justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-[10px] opacity-50 uppercase font-bold tracking-wider">Starting From</p>
            <p className={cn("text-2xl font-bold font-mono", price === 0 ? "text-slate-400 text-lg" : "text-slate-900")}>
                {price > 0 ? `${symbol}${price.toLocaleString()}` : 'Price TBD'}
            </p>
          </div>
          
          <Button 
            variant="primary" 
            size="sm" 
            className="rounded-full w-10 h-10 p-0 shadow-lg shadow-blue-500/20"
          >
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export const GroupTours = () => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTours = async () => {
      try {
        console.log("Fetching Tours (Safe Mode)...");
        
        // --- SAFE FETCH: No Filters, Raw Data ---
        const { data, error } = await supabase
          .from('tours')
          .select('*, tour_pricing(*), tour_dates(*)');

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        console.log("Raw Data:", data); // Debugging Output
        setTours(data || []);
      } catch (err) {
        console.error("Error fetching group tours:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTours();
  }, []);

  const filteredTours = tours.filter(t => 
    (t.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (t.route || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <h1 className={cn("text-4xl font-bold font-serif", getTextColor())}>Signature Group Tours</h1>
            <p className={cn("text-sm opacity-60 mt-1", getTextColor())}>Expertly crafted fixed departures with guaranteed batches.</p>
        </div>
        
        <div className="relative w-full md:w-96 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Search size={18} />
            </div>
            <input 
                type="text" 
                placeholder="Search destinations..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn("w-full pl-12 pr-4 py-3 rounded-2xl border outline-none shadow-sm transition-all focus:ring-4 focus:ring-blue-500/10", getInputClass())}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTours.map(tour => (
          <TourCard key={tour.id} tour={tour} />
        ))}
      </div>

      {filteredTours.length === 0 && (
          <div className="py-20 text-center opacity-50 flex flex-col items-center">
              <ShoppingBag size={48} className="mb-4 opacity-20" />
              <p className="text-xl font-medium">No results found.</p>
              <p className="text-xs mt-2">Check the console logs if you expected data.</p>
              <Button variant="ghost" onClick={() => setSearch('')} className="mt-2 text-blue-500">Clear filters</Button>
          </div>
      )}
    </div>
  );
};
