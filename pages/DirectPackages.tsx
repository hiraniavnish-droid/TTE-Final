
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageLoader } from '../components/ui/PageLoader';
import { 
  Search,
  MapPin, 
  ArrowRight,
  Globe,
  CalendarCheck,
  AlertTriangle,
  Plane,
  ArrowLeft
} from 'lucide-react';

interface FITPackage {
  id: string;
  name: string;
  image_url?: string;
  duration?: string;
  region?: string; 
  tour_type?: string; 
}

const REGIONS = ['All', 'UK', 'Europe', 'Scandinavia'];

export const DirectPackages = () => {
  const { getTextColor, getInputClass, getSecondaryTextColor } = useTheme();
  const navigate = useNavigate();
  
  const [packages, setPackages] = useState<FITPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        console.log("--- DEBUG: Fetching All Tours ---");
        
        // 1. Relax the filter: Fetch ALL tours to inspect data
        const { data, error } = await supabase
          .from('tours')
          .select('*');

        if (error) throw error;

        // 2. Client-Side Filtering with robust case check
        const fitPackages = (data || []).filter(t => {
            const type = t.tour_type ? t.tour_type.toLowerCase().trim() : '';
            return type === 'fit';
        });

        setPackages(fitPackages);
      } catch (err) {
        console.error("Error fetching packages:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = (pkg.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesRegion = activeTab === 'All' || pkg.region === activeTab;
    return matchesSearch && matchesRegion;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Back to Hub Nav */}
      <button 
        onClick={() => navigate('/builder')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm"
      >
        <ArrowLeft size={18} /> Back to Itinerary Hub
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                    <CalendarCheck size={20} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Daily Departures</span>
            </div>
            <h1 className={cn("text-4xl font-bold font-serif", getTextColor())}>Direct Packages (FIT)</h1>
            <p className={cn("text-sm opacity-60 mt-1 max-w-xl", getTextColor())}>
                Flexible Independent Travel. Choose your own dates and travel at your own pace with our curated daily itineraries.
            </p>
        </div>
        
        <div className="relative w-full md:w-80 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Search size={18} />
            </div>
            <input 
                type="text" 
                placeholder="Search city or package..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn("w-full pl-12 pr-4 py-3 rounded-2xl border outline-none shadow-sm transition-all focus:ring-4 focus:ring-blue-500/10", getInputClass())}
            />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200/50">
        {REGIONS.map(region => (
            <button
                key={region}
                onClick={() => setActiveTab(region)}
                className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                    activeTab === region 
                        ? "bg-slate-900 text-white shadow-lg" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
            >
                {region}
            </button>
        ))}
      </div>

      {/* Grid - Updated with Text-Only Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredPackages.map(pkg => (
          <Card 
            key={pkg.id} 
            noPadding 
            className="group flex flex-col hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-slate-200 hover:border-blue-300 h-full hover:-translate-y-1"
            onClick={() => navigate(`/direct-packages/${pkg.id}`)}
          >
            <div className="p-6 flex flex-col h-full">
                {/* Header: Icon & Duration */}
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Plane size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {pkg.duration || 'Flexible'}
                    </span>
                </div>

                {/* Content: Title & Region */}
                <h3 className={cn("text-lg font-bold font-serif leading-tight mb-2 group-hover:text-blue-600 transition-colors line-clamp-2", getTextColor())}>
                    {pkg.name}
                </h3>
                
                <div className="flex items-center gap-2 text-xs font-medium opacity-60 mb-6">
                    <Globe size={14} />
                    {pkg.region || 'International'}
                </div>

                {/* Footer: Action */}
                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className={cn("text-xs font-bold text-slate-400", getSecondaryTextColor())}>View Details</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <ArrowRight size={16} />
                    </div>
                </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Debug / Empty State */}
      {filteredPackages.length === 0 && (
          <div className="py-20 text-center opacity-70 flex flex-col items-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
              <div className="p-4 bg-orange-100 text-orange-600 rounded-full mb-4">
                  <AlertTriangle size={32} />
              </div>
              <p className="text-xl font-bold text-slate-800">No FIT Packages Found.</p>
              <p className="text-sm mt-2 max-w-md">
                  We couldn't find any packages matching your filters.
              </p>
              <Button variant="ghost" onClick={() => {setSearch(''); setActiveTab('All');}} className="mt-4 text-blue-500">
                  Clear Filters
              </Button>
          </div>
      )}
    </div>
  );
};
