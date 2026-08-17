
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { ArrowRight, Map, MapPin, Tent, Home, Building2 } from 'lucide-react';

interface DestinationGalleryProps {
  onSelect: (id: string) => void;
}

export const DestinationGallery: React.FC<DestinationGalleryProps> = ({ onSelect }) => {
  const { getTextColor } = useTheme();

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/70">
            <Map size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight font-serif", getTextColor())}>Itinerary Hub</h1>
          <p className="text-sm opacity-60">Live rate-card quotation builders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Rann Utsav Quotation Builder */}
        <button
          onClick={() => onSelect('rann-utsav')}
          className={cn(
            "group relative h-96 w-full rounded-3xl overflow-hidden text-left shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)] active:scale-[0.99]",
            "border border-white/10 outline-none focus:ring-4 focus:ring-rose-500/20"
          )}
        >
          <div className="absolute inset-0 bg-rose-950">
            <img
              src="https://rannutsav.net/wp-content/uploads/2025/08/white-desert-600x500.webp"
              alt="Rann Utsav Tent City"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-rose-950 via-rose-950/45 to-rose-950/5" />
          </div>

          <div className="absolute top-6 right-6 z-10">
            <span className="px-3 py-1 bg-black/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              Live Rates 26-27
            </span>
          </div>

          <div className="absolute top-6 left-6 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
              <Tent size={24} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <div className="flex items-center gap-2 text-rose-200 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
              <MapPin size={12} /> Dhordo, Kutch
            </div>
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">Rann Utsav</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              Instant quotation builder for Tent City &amp; Tent Resort — auto pricing, discount, GST, PDF &amp; WhatsApp.
            </p>

            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-rose-900 flex items-center justify-center">
                <ArrowRight size={18} />
              </span>
              Build Quote
            </div>
          </div>
        </button>

        {/* Card 2: SOU Tent City-1 Quotation Builder */}
        <button
          onClick={() => onSelect('sou-tent-city')}
          className={cn(
            "group relative h-96 w-full rounded-3xl overflow-hidden text-left shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)] active:scale-[0.99]",
            "border border-white/10 outline-none focus:ring-4 focus:ring-amber-500/20"
          )}
        >
          <div className="absolute inset-0 bg-amber-950">
            <img
              src="https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=800&q=80"
              alt="Statue of Unity Tent City"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-amber-950 via-amber-950/45 to-amber-950/5" />
          </div>

          <div className="absolute top-6 right-6 z-10">
            <span className="px-3 py-1 bg-black/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Live Rates 26-27
            </span>
          </div>

          <div className="absolute top-6 left-6 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
              <Home size={24} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <div className="flex items-center gap-2 text-amber-200 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
              <MapPin size={12} /> Ekta Nagar, Kevadia
            </div>
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">SOU Tent City-1</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              Instant quotation builder for Cottages &amp; Villas — auto pricing, peak-season surcharge, discount, GST, PDF &amp; WhatsApp.
            </p>

            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-amber-900 flex items-center justify-center">
                <ArrowRight size={18} />
              </span>
              Build Quote
            </div>
          </div>
        </button>

        {/* Card 3: Rajarshi Travels — Kutch hotel rate finder */}
        <button
          onClick={() => onSelect('rajarshi')}
          className={cn(
            "group relative h-96 w-full rounded-3xl overflow-hidden text-left shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)] active:scale-[0.99]",
            "border border-white/10 outline-none focus:ring-4 focus:ring-sky-500/20"
          )}
        >
          <div className="absolute inset-0 bg-sky-950">
            <img
              src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
              alt="Kutch hotels"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sky-950 via-sky-950/45 to-sky-950/5" />
          </div>

          <div className="absolute top-6 right-6 z-10">
            <span className="px-3 py-1 bg-black/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              Rate Finder 26-27
            </span>
          </div>

          <div className="absolute top-6 left-6 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
              <Building2 size={24} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <div className="flex items-center gap-2 text-sky-200 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
              <MapPin size={12} /> Bhuj, Kutch
            </div>
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">Rajarshi Travels</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              Kutch hotel rate finder — build a multi-hotel package or compare options across suppliers, with your own margin.
            </p>

            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-sky-900 flex items-center justify-center">
                <ArrowRight size={18} />
              </span>
              Find Rates
            </div>
          </div>
        </button>

        {/* Card 4: Inland Tourways — Gujarat-wide hotel rate finder */}
        <button
          onClick={() => onSelect('inland')}
          className={cn(
            "group relative h-96 w-full rounded-3xl overflow-hidden text-left shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)] active:scale-[0.99]",
            "border border-white/10 outline-none focus:ring-4 focus:ring-emerald-500/20"
          )}
        >
          <div className="absolute inset-0 bg-emerald-950">
            <img
              src="https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80"
              alt="Gujarat hotels"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/45 to-emerald-950/5" />
          </div>

          <div className="absolute top-6 right-6 z-10">
            <span className="px-3 py-1 bg-black/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Rate Finder 26-27
            </span>
          </div>

          <div className="absolute top-6 left-6 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
              <Building2 size={24} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 p-8 w-full z-10">
            <div className="flex items-center gap-2 text-emerald-200 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
              <MapPin size={12} /> Gujarat-wide
            </div>
            <h2 className="text-3xl font-bold text-white font-serif mb-2 leading-tight">Inland Tourways</h2>
            <p className="text-white/80 text-xs mb-6 line-clamp-2 leading-relaxed">
              190 hotels across 20 destinations — build a multi-city package or compare options, with your own margin.
            </p>

            <div className="flex items-center gap-3 text-white font-bold text-sm opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
              <span className="w-10 h-10 rounded-full bg-white text-emerald-900 flex items-center justify-center">
                <ArrowRight size={18} />
              </span>
              Find Rates
            </div>
          </div>
        </button>

      </div>
    </div>
  );
};
