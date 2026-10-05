import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronRight, Compass, Hotel, Map, MessageCircle, Sparkles } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { RAJARSHI_READY_PACKAGES } from '../services/rajarshiReadyPackages';

export const RajarshiHub: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const isLight = theme === 'light';
  const launchers = [
    {
      title: 'Ready Packages', subtitle: 'Kutch 2026–27', icon: Compass,
      description: 'Five complete Kutch itineraries with day plans, category-wise prices and one-click WhatsApp text sharing for your team.',
      meta: `${RAJARSHI_READY_PACKAGES.length} packages ready to share`, action: 'Open Ready Packages',
      path: '/rajarshi-builder/packages', tone: 'from-orange-500 via-amber-500 to-rose-500', iconTone: 'bg-orange-500/15 text-orange-600',
    },
    {
      title: 'Hotels', subtitle: 'Live rate workspace', icon: Hotel,
      description: 'Compare Kutch hotel options, apply your own markup and prepare a custom multi-hotel quotation for a specific travel date.',
      meta: 'Rate wall · custom package builder', action: 'Open Hotels',
      path: '/rajarshi-builder/hotels', tone: 'from-sky-500 via-cyan-500 to-blue-600', iconTone: 'bg-sky-500/15 text-sky-600',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-2 animate-in fade-in duration-500">
      <button onClick={() => navigate('/builder')} className={cn('inline-flex items-center gap-1.5 text-xs font-bold mb-6 transition hover:-translate-x-0.5', getSecondaryTextColor())}>
        <ArrowLeft size={15} /> Itinerary Hub
      </button>

      <div className="rounded-[28px] overflow-hidden border border-slate-200/70 shadow-[0_18px_55px_-28px_rgba(15,23,42,0.28)] bg-slate-950 relative px-6 py-8 md:p-10 mb-6">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="absolute right-28 -bottom-32 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 text-orange-200 text-[11px] font-bold uppercase tracking-[0.18em] mb-4"><Building2 size={14} /> Rajarshi Tours and Travels</div>
          <h1 className="text-3xl md:text-4xl text-white font-bold tracking-tight leading-tight">A clean workspace for every Kutch quotation.</h1>
          <p className="text-slate-300 mt-3 max-w-xl text-sm leading-relaxed">Keep fixed, ready-to-send Kutch tours separate from live hotel comparison. Your team reaches the right tool in one click and shares the complete itinerary directly as WhatsApp text.</p>
          <div className="flex flex-wrap gap-3 mt-6 text-[11px] font-semibold text-white/75">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><Map size={13} className="text-orange-300" /> 01 to 05 night Kutch tours</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5"><MessageCircle size={13} className="text-emerald-300" /> One-click WhatsApp text</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {launchers.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.title} onClick={() => navigate(item.path)} className={cn('text-left rounded-[24px] overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group', isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/70 border-white/10')}>
              <div className={cn('h-2 bg-gradient-to-r', item.tone)} />
              <div className="p-6 md:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('p-3 rounded-2xl', item.iconTone)}><Icon size={23} /></div>
                  <span className={cn('text-[10px] uppercase tracking-[0.14em] font-bold', getSecondaryTextColor())}>{item.subtitle}</span>
                </div>
                <h2 className={cn('mt-6 text-xl font-bold tracking-tight', getTextColor())}>{item.title}</h2>
                <p className={cn('mt-2 text-sm leading-relaxed min-h-[64px]', getSecondaryTextColor())}>{item.description}</p>
                <div className={cn('border-t mt-6 pt-4 flex items-center justify-between', isLight ? 'border-slate-100' : 'border-white/10')}>
                  <span className={cn('text-[11px] font-semibold', getSecondaryTextColor())}>{item.meta}</span>
                  <span className={cn('inline-flex items-center gap-1 text-[12px] font-bold transition-transform group-hover:translate-x-1', item.title === 'Ready Packages' ? 'text-orange-600' : 'text-sky-600')}>
                    {item.action} <ChevronRight size={15} />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={cn('mt-6 rounded-2xl border px-5 py-4 flex items-center gap-3', isLight ? 'bg-amber-50/70 border-amber-100' : 'bg-amber-500/10 border-amber-400/15')}>
        <Sparkles size={17} className="text-amber-500 shrink-0" />
        <p className={cn('text-[12px] leading-relaxed', isLight ? 'text-amber-800' : 'text-amber-100/80')}>Ready Package prices are per person and retain the source itinerary’s conditions. Your internal hotel-rate workspace keeps its own markup and never exposes net costs in the client share.</p>
      </div>
    </div>
  );
};
