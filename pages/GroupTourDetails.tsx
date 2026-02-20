
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatCurrency } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageLoader } from '../components/ui/PageLoader';
import { 
  Calendar, 
  MapPin, 
  ArrowLeft,
  Download,
  Utensils,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';

interface TourItinerary {
  id: string;
  day_number: number;
  title: string;
  description: string;
  meals: string;
}

interface TourDate {
  id: string;
  start_date: string;
}

interface TourPricing {
  currency: string;
  adult_double: number;
}

interface Tour {
  id: string;
  name: string;
  duration: string;
  route: string;
  pdf_url: string;
  tour_pricing: TourPricing[];
  tour_dates: TourDate[];
  tour_itineraries: TourItinerary[];
}

export const GroupTourDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme, getTextColor } = useTheme();
  
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTour = async () => {
      try {
        const { data, error } = await supabase
          .from('tours')
          .select(`
            *,
            tour_pricing (*),
            tour_dates (*),
            tour_itineraries (*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        // --- Client-Side Sorting ---
        
        // 1. Sort Itinerary by Day Number (Ascending)
        if (data.tour_itineraries && Array.isArray(data.tour_itineraries)) {
            data.tour_itineraries.sort((a: TourItinerary, b: TourItinerary) => a.day_number - b.day_number);
        }

        // 2. Sort Dates by Date (Ascending)
        if (data.tour_dates && Array.isArray(data.tour_dates)) {
            data.tour_dates.sort((a: TourDate, b: TourDate) => 
                new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
            );
        }

        setTour(data);
      } catch (err) {
        console.error("Error fetching tour details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTour();
  }, [id]);

  // --- Safe Date Helper ---
  const safeFormatDate = (dateString: string) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  if (loading) return <PageLoader />;
  if (!tour) return <div className="p-10 text-center opacity-50">Tour details not found.</div>;

  const pricing = tour.tour_pricing?.[0];
  const symbol = pricing?.currency === 'EUR' ? '€' : pricing?.currency === 'CHF' ? 'CHF ' : '₹';
  const priceDisplay = pricing ? `${symbol}${pricing.adult_double.toLocaleString()}` : 'TBD';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-24">
      {/* Navigation */}
      <button 
        onClick={() => navigate('/group-tours')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm"
      >
        <ArrowLeft size={18} /> Back to Gallery
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: Itinerary & Details */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* Header Section */}
            <div>
                <div className="flex flex-wrap gap-2 mb-3">
                   <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase border border-blue-100">{tour.duration}</span>
                   <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase border border-indigo-100">Group Tour</span>
                </div>
                <h1 className={cn("text-3xl md:text-5xl font-bold font-serif leading-tight mb-2", getTextColor())}>{tour.name}</h1>
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <MapPin size={18} className="text-rose-500 shrink-0" />
                    <span>{tour.route}</span>
                </div>
            </div>

            {/* Visual Banner */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative group shadow-sm">
                <img 
                    src={`https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80`} 
                    alt={tour.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>

            {/* Day-by-Day Itinerary */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><FileText size={20} /></div>
                    <h2 className={cn("text-2xl font-bold font-serif", getTextColor())}>Detailed Itinerary</h2>
                </div>

                <div className="relative border-l-2 border-slate-200 ml-3 md:ml-4 space-y-8 pb-4">
                    {tour.tour_itineraries && tour.tour_itineraries.length > 0 ? (
                        tour.tour_itineraries.map((day, index) => (
                            <div key={day.id} className="relative pl-6 md:pl-8">
                                {/* Timeline Dot */}
                                <div className={cn(
                                    "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 shadow-sm z-10",
                                    index === 0 ? "bg-blue-600 border-white" : "bg-slate-400 border-white"
                                )} />
                                
                                <div className="group">
                                    <h3 className={cn("text-lg font-bold flex items-center gap-2 mb-2", getTextColor())}>
                                        <span className="text-blue-600">Day {day.day_number}:</span> {day.title}
                                    </h3>
                                    
                                    <div className={cn("text-sm leading-relaxed opacity-80 whitespace-pre-line", getTextColor())}>
                                        {day.description || "No detailed description available for this day."}
                                    </div>

                                    {day.meals && (
                                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 w-fit px-3 py-1.5 rounded-full">
                                            <Utensils size={12} className="text-orange-500" />
                                            <span className="uppercase tracking-wide">Meals: {day.meals}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="pl-8 text-sm italic opacity-50">Itinerary details coming soon...</div>
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: Sticky Control Panel */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-6">
            
            {/* 1. Pricing Card */}
            <Card className="border-l-4 border-l-emerald-500 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">Starts From</p>
                <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl font-mono font-bold text-slate-900">{priceDisplay}</h2>
                    <span className="text-xs font-bold text-slate-400">per person</span>
                </div>
            </Card>

            {/* 2. Departure Dates List (Critical) */}
            <Card className="flex flex-col max-h-[500px]">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                    <Clock size={18} className="text-blue-600" />
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide", getTextColor())}>Upcoming Departures</h3>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-2">
                    {tour.tour_dates && tour.tour_dates.length > 0 ? (
                        tour.tour_dates.map(date => {
                            // Safe parsing
                            const d = new Date(date.start_date);
                            const isValid = !isNaN(d.getTime());
                            const isPast = isValid ? d < new Date() : false;
                            
                            // Use Helper
                            const dateStr = safeFormatDate(date.start_date);

                            return (
                                <div 
                                    key={date.id} 
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border text-sm transition-all",
                                        isPast 
                                            ? "bg-slate-50 text-slate-400 border-slate-100" 
                                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-sm"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Calendar size={14} className={isPast ? "opacity-50" : "text-blue-500"} />
                                        <span className={cn("font-mono", !isPast && "font-bold text-slate-900")}>
                                            {dateStr}
                                        </span>
                                    </div>
                                    {!isPast ? (
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">Open</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Closed</span>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 opacity-50 text-xs">No dates scheduled yet.</div>
                    )}
                </div>
                
                <div className="pt-4 mt-2 border-t border-slate-100 text-[10px] text-center opacity-50">
                    * Dates subject to availability
                </div>
            </Card>

            {/* 3. Brochure Download */}
            {tour.pdf_url && (
                <a href={tour.pdf_url} target="_blank" rel="noreferrer" className="block group">
                    <Button className="w-full h-14 text-lg shadow-lg shadow-blue-900/10 group-hover:shadow-blue-900/20 transition-all">
                        <Download size={20} className="mr-2" /> Download Brochure
                    </Button>
                </a>
            )}

            {/* Help Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                <p className="text-xs font-bold text-slate-500 mb-2">Need Help?</p>
                <p className="text-sm font-bold text-slate-900">+91 98765 43210</p>
                <p className="text-[10px] text-slate-400 mt-1">Mon-Sat, 10am - 7pm</p>
            </div>

        </div>

      </div>
    </div>
  );
};
