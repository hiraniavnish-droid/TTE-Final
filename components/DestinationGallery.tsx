
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Lock, ArrowRight, Map, Globe, Users, Plane, CalendarCheck } from 'lucide-react';

interface DestinationGalleryProps {
  onSelect: (id: string) => void;
}

export const DestinationGallery: React.FC<DestinationGalleryProps> = ({ onSelect }) => {
  const { getTextColor } = useTheme();

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-50 text-blue-600 mb-4 ring-1 ring-blue-100">
            <Map size={24} />
        </div>
        <h1 className={cn("text-4xl font-bold font-serif mb-3", getTextColor())}>Itinerary Hub</h1>
        <p className="text-sm opacity-60 max-w-md mx-auto">Choose between a customized individual journey, fixed group batches, or flexible independent packages.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Card 1: Direct Packages (New/Prominent) */}
        <button
          onClick={() => onSelect('direct-packages')}
          className={cn(
            "group relative h-96 w-full rounded-[2rem] overflow-hidden text-left shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-cyan-900/20",
            "border border-white/20 outline-none focus:ring-4 focus:ring-cyan-500/20"
          )}
        >
          {/* Background Image */}
          <div className="absolute inset-0 bg-cyan-950">
            <img
              src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"
              alt="Direct Packages"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/90 via-cyan-900/40 to-transparent" />
          </div>

          {/* Icon Overlay */}
          <div className="absolute top-6 left-6 z-10">
             <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                <Plane size={24} />
             </div>
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
                <CalendarCheck size={12} /> Daily Departures
            </div>
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">Direct Packages (FIT)</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              Flexible Independent Travel. Curated daily itineraries where you choose the dates and pace.
            </p>
            
            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-cyan-900 flex items-center justify-center">
                  <ArrowRight size={18} />
              </span>
              View Options
            </div>
          </div>
        </button>

        {/* Card 2: Kutch (Active) */}
        <button
          onClick={() => onSelect('kutch')}
          className={cn(
            "group relative h-96 w-full rounded-[2rem] overflow-hidden text-left shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-blue-900/20",
            "border border-white/20 outline-none focus:ring-4 focus:ring-blue-500/20"
          )}
        >
          {/* Background Image */}
          <div className="absolute inset-0 bg-slate-900">
            <img
              src="https://rannutsav.net/wp-content/uploads/2025/08/white-desert-600x500.webp"
              alt="Kutch"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          </div>

          {/* Badge */}
          <div className="absolute top-6 right-6 z-10">
            <span className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/30 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Season Live 🌙
            </span>
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">The Great Rann of Kutch</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              Experience the white desert, cultural vibrancy, and artistic heritage of Gujarat.
            </p>
            
            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center">
                  <ArrowRight size={18} />
              </span>
              Customize Trip
            </div>
          </div>
        </button>

        {/* Card 3: Group Tours */}
        <button
          onClick={() => onSelect('group-tours')}
          className={cn(
            "group relative h-96 w-full rounded-[2rem] overflow-hidden text-left shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-indigo-900/20",
            "border border-white/20 outline-none focus:ring-4 focus:ring-indigo-500/20"
          )}
        >
          {/* Background Image */}
          <div className="absolute inset-0 bg-indigo-900">
            <img
              src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=800&q=80"
              alt="Group Tours"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/90 via-indigo-900/40 to-transparent" />
          </div>

          {/* Icon Overlay */}
          <div className="absolute top-6 left-6 z-10">
             <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                <Globe size={24} />
             </div>
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
                <Users size={12} /> Fixed Departures
            </div>
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">Expert-Led Group Batches</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              Global standard itineraries including Europe, USA, and Far East with guaranteed scheduled dates.
            </p>
            
            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-indigo-900 flex items-center justify-center">
                  <ArrowRight size={18} />
              </span>
              Browse Collections
            </div>
          </div>
        </button>

      </div>
    </div>
  );
};
