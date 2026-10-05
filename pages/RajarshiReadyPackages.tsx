import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, MessageCircle, Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { formatRajarshiPackageWhatsApp, RAJARSHI_READY_PACKAGES, type ReadyPackage } from '../services/rajarshiReadyPackages';

const inr = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export const RajarshiReadyPackages: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const isLight = theme === 'light';

  const sharePackage = (pkg: ReadyPackage) => {
    // Open a WhatsApp composer only. The CRM does not create a public link,
    // upload client data, or send a message on the employee's behalf.
    window.open(`https://wa.me/?text=${encodeURIComponent(formatRajarshiPackageWhatsApp(pkg))}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="animate-in fade-in duration-300 pb-12 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate('/rajarshi-builder')} className={cn('p-2 rounded-xl transition', isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-white/60')} title="Rajarshi Travels"><ArrowLeft size={17} /></button>
        <div className="min-w-0">
          <p className={cn('text-[10px] uppercase tracking-[0.15em] font-bold', getSecondaryTextColor())}>Rajarshi Tours and Travels</p>
          <h1 className={cn('text-xl font-bold tracking-tight', getTextColor())}>Ready Packages</h1>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5"><MessageCircle size={13} /> One-click WhatsApp share</div>
      </div>

      <div className={cn('rounded-2xl border px-4 py-3 mb-4 flex items-center gap-3', isLight ? 'bg-amber-50/70 border-amber-100' : 'bg-amber-400/10 border-amber-400/15')}>
        <MessageCircle size={18} className="text-emerald-600 shrink-0" />
        <p className={cn('text-[12px] leading-relaxed', isLight ? 'text-amber-900' : 'text-amber-100/80')}>Choose a package and tap <b>Share on WhatsApp</b>. The complete itinerary, stay options, rates and terms open as text in WhatsApp — no client page and no link.</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {RAJARSHI_READY_PACKAGES.map((pkg, index) => {
          const starter = pkg.tiers[0].perPerson.two;
          return (
            <article key={pkg.id} className={cn('relative overflow-hidden rounded-2xl border p-5 flex flex-col min-h-[286px]', isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/70 border-white/10')}>
              <div className={cn('absolute right-0 top-0 h-28 w-28 blur-3xl opacity-35 rounded-full', index % 2 ? 'bg-sky-400' : 'bg-orange-400')} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className={cn('text-[10px] font-bold tracking-[0.12em] uppercase', getSecondaryTextColor())}>{pkg.eyebrow}</p>
                  <h2 className={cn('font-bold text-[18px] mt-2 tracking-tight', getTextColor())}>{pkg.title}</h2>
                </div>
                <span className="rounded-xl p-2 bg-orange-50 text-orange-600"><MapPin size={16}/></span>
              </div>
              <p className={cn('relative mt-2 text-[12px] leading-relaxed min-h-[36px]', getSecondaryTextColor())}>{pkg.route}</p>

              <div className={cn('relative mt-4 grid grid-cols-2 gap-2 text-[11px]', isLight ? 'text-slate-600' : 'text-white/60')}>
                <span className={cn('rounded-lg px-2.5 py-2 flex items-center gap-1.5', isLight ? 'bg-slate-50' : 'bg-white/5')}><CalendarDays size={13} className="text-orange-500" /> {pkg.nights}N / {pkg.days}D</span>
                <span className={cn('rounded-lg px-2.5 py-2 flex items-center gap-1.5', isLight ? 'bg-slate-50' : 'bg-white/5')}><Users size={13} className="text-sky-500" /> 2 to 6 guests</span>
              </div>

              <div className={cn('relative mt-4 pt-3 border-t', isLight ? 'border-slate-100' : 'border-white/10')}>
                <p className={cn('text-[9px] uppercase font-bold tracking-wider', getSecondaryTextColor())}>Starts from</p>
                <p className={cn('font-bold text-lg mt-0.5', getTextColor())}>{inr(starter)} <span className={cn('text-[10px] font-medium', getSecondaryTextColor())}>per person</span></p>
              </div>

              <button onClick={() => sharePackage(pkg)} className="relative mt-auto pt-4 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.985] text-white py-3 text-[13px] font-bold flex justify-center items-center gap-2 transition">
                <MessageCircle size={16} /> Share on WhatsApp
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};
