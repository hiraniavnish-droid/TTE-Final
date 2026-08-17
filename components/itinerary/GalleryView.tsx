
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatCurrency } from '../../utils/helpers';
import { Sparkles, ArrowRight, MapPin, Star, Copy, Check, Clock, Users, Calendar } from 'lucide-react';
import { Hotel, ItineraryPackage } from '../../types';
import { FALLBACK_IMG, calculateGalleryPrice, generateRouteSummary } from './utils';
import { RecentQuote } from './recentQuotes';

interface GalleryViewProps {
  packages: ItineraryPackage[];
  pax: number;
  startDate: string;
  guestName: string;
  gallerySharingMode: 'Double' | 'Quad';
  setGallerySharingMode: (mode: 'Double' | 'Quad') => void;
  onSelectPackage: (pkgId: string, tier: 'Budget' | 'Premium') => void;
  onOpenCustomBuilder: () => void;
  hotelData: Record<string, Hotel[]>;
  recentQuotes: RecentQuote[];
  onRestoreQuote: (q: RecentQuote) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  packages, pax, startDate, guestName, gallerySharingMode, setGallerySharingMode,
  onSelectPackage, onOpenCustomBuilder, hotelData, recentQuotes, onRestoreQuote
}) => {
  const { theme, getTextColor } = useTheme();
  const [copiedPkgId, setCopiedPkgId] = useState<string | null>(null);

  const handleQuickCopy = (e: React.MouseEvent, pkg: ItineraryPackage) => {
    e.stopPropagation();
    const budgetTotal = calculateGalleryPrice(pkg, 'Budget', pax, gallerySharingMode, hotelData);
    const premiumTotal = calculateGalleryPrice(pkg, 'Premium', pax, gallerySharingMode, hotelData);
    const budgetPP = pax > 0 ? Math.round(budgetTotal / pax) : 0;
    const premiumPP = pax > 0 ? Math.round(premiumTotal / pax) : 0;
    const route = pkg.route.filter((c, i, a) => a.indexOf(c) === i).join(' → ');
    const text =
      `🌿 *${pkg.name}* (${pkg.days - 1}N/${pkg.days}D)\n` +
      `${guestName !== 'Guest' ? `Guest: ${guestName} | ` : ''}${pax} Adults${startDate ? ` | From: ${startDate}` : ''}\n` +
      `📍 Route: ${route}\n\n` +
      `💰 *Budget:* ₹${budgetTotal.toLocaleString('en-IN')} (₹${budgetPP.toLocaleString('en-IN')}/pp)\n` +
      `⭐ *Premium:* ₹${premiumTotal.toLocaleString('en-IN')} (₹${premiumPP.toLocaleString('en-IN')}/pp)\n\n` +
      `_Rates by The Tourism Experts_`;
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    });
    setCopiedPkgId(pkg.id);
    setTimeout(() => setCopiedPkgId(null), 2000);
  };

  return (
    <div className="space-y-8">

      {/* ── Recent Quotes Strip ──────────────────────────────────────────────── */}
      {recentQuotes.length > 0 && (
        <div className="animate-blur-in">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', theme === 'light' ? 'bg-slate-400' : 'bg-white/30')} />
            <span className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              Recents
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {recentQuotes.map((q, i) => (
              /* Double-bezel architecture on recent quote chips */
              <button
                key={q.id}
                onClick={() => onRestoreQuote(q)}
                style={{ minWidth: 188, animationDelay: `${i * 60}ms` }}
                className={cn(
                  'shrink-0 text-left p-[1.5px] rounded-[1rem] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] animate-blur-in',
                  theme === 'light'
                    ? 'bg-gradient-to-br from-slate-200/80 to-slate-100/30 hover:from-indigo-200/60 hover:to-indigo-100/20 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-0.5'
                    : 'bg-white/10 hover:bg-white/15 hover:-translate-y-0.5'
                )}
              >
                <div className={cn(
                  'h-full flex flex-col gap-1 p-3 rounded-[calc(1rem-1.5px)]',
                  theme === 'light' ? 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-slate-800'
                )}>
                  <div className={cn('text-xs font-bold truncate max-w-[164px] leading-tight', getTextColor())}>{q.guestName}</div>
                  <div className={cn('text-[10px] font-medium', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>{q.packageName} · {q.tier}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn('flex items-center gap-1 text-[9px] font-semibold', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>
                      <Users size={8}/> {q.pax}
                    </span>
                    {q.startDate && (
                      <span className={cn('flex items-center gap-1 text-[9px] font-semibold', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>
                        <Calendar size={8}/> {q.startDate}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-mono font-bold text-indigo-600">{formatCurrency(q.total)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Package Cards Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* Create Your Own — double-bezel dashed card */}
        <button
          onClick={onOpenCustomBuilder}
          className={cn(
            'group relative p-[1.5px] rounded-[1.5rem] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] text-left',
            'animate-blur-in',
            theme === 'light'
              ? 'bg-gradient-to-br from-indigo-200/50 to-indigo-100/20 hover:from-indigo-300/60 hover:to-indigo-100/30 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-1'
              : 'bg-indigo-500/20 hover:bg-indigo-500/30 hover:-translate-y-1'
          )}
          style={{ minHeight: 380 }}
        >
          <div className={cn(
            'h-full flex flex-col items-center justify-center text-center p-8 rounded-[calc(1.5rem-1.5px)]',
            theme === 'light' ? 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-indigo-900/30',
            'border-2 border-dashed',
            theme === 'light' ? 'border-indigo-200' : 'border-indigo-500/30'
          )}>
            {/* Icon with double-bezel */}
            <div className={cn(
              'p-[1.5px] rounded-full mb-6 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110',
              theme === 'light' ? 'bg-gradient-to-br from-indigo-200 to-indigo-100' : 'bg-indigo-500/30'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                theme === 'light' ? 'bg-indigo-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]' : 'bg-indigo-900/50'
              )}>
                <Sparkles size={26} className="text-indigo-500" />
              </div>
            </div>

            <h3 className={cn('text-xl font-bold mb-2 tracking-tight', getTextColor())}>Create Your Own</h3>
            <p className={cn('text-sm leading-relaxed max-w-[190px]', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              Build a fully customized day-by-day itinerary from scratch.
            </p>

            {/* Button-in-button CTA */}
            <div className={cn(
              'mt-7 flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-full text-sm font-bold transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
              theme === 'light'
                ? 'bg-slate-900 text-white group-hover:bg-indigo-600'
                : 'bg-white text-slate-900 group-hover:bg-indigo-400',
              'active:scale-[0.97]'
            )}>
              <span>Start Building</span>
              <span className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px',
                theme === 'light' ? 'bg-white/15' : 'bg-black/10'
              )}>
                <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </button>

        {/* Package Cards — full double-bezel architecture */}
        {packages.map((pkg, idx) => {
          const budgetTotal = calculateGalleryPrice(pkg, 'Budget', pax, gallerySharingMode, hotelData);
          const premiumTotal = calculateGalleryPrice(pkg, 'Premium', pax, gallerySharingMode, hotelData);
          const budgetPerPerson = pax > 0 ? Math.round(budgetTotal / pax) : 0;
          const premiumPerPerson = pax > 0 ? Math.round(premiumTotal / pax) : 0;
          const isCopied = copiedPkgId === pkg.id;

          return (
            /* Outer bezel shell */
            <div
              key={pkg.id}
              className={cn(
                'group p-[1.5px] rounded-[1.5rem] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col animate-blur-in',
                theme === 'light'
                  ? 'bg-gradient-to-br from-slate-200/80 to-slate-100/30 hover:from-slate-200 hover:to-slate-100/50'
                  : 'bg-white/10 hover:bg-white/15',
                'hover:-translate-y-1.5',
                'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06),0_8px_32px_-4px_rgba(15,23,42,0.08)]',
                'hover:shadow-[0_8px_32px_-4px_rgba(15,23,42,0.12),0_24px_56px_-12px_rgba(15,23,42,0.16)]'
              )}
              style={{ animationDelay: `${(idx + 1) * 80}ms` }}
            >
              {/* Inner core */}
              <div className={cn(
                'flex-1 flex flex-col rounded-[calc(1.5rem-1.5px)] overflow-hidden',
                theme === 'light' ? 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-slate-900'
              )}>

                {/* Image area — full bleed, taller */}
                <div className="relative h-52 overflow-hidden bg-slate-200 shrink-0">
                  <img
                    src={pkg.img || FALLBACK_IMG}
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                    alt={pkg.name || 'Package'}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.06]"
                  />
                  {/* Rich gradient — deeper bottom coverage */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                  {/* Package meta overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="mb-1.5">
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-[0.2em] text-white/70 bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-0.5 rounded-full">
                        {pkg.days - 1}N · {pkg.days}D
                      </span>
                    </div>
                    <h3 className="text-[18px] font-bold text-white leading-tight tracking-tight drop-shadow-sm">
                      {pkg.name}
                    </h3>
                  </div>

                  {/* Quick Copy — appears on hover */}
                  <button
                    onClick={(e) => handleQuickCopy(e, pkg)}
                    className={cn(
                      'absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-sm',
                      isCopied
                        ? 'bg-emerald-500 text-white opacity-100 scale-100'
                        : 'bg-white text-slate-800 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 hover:bg-slate-50'
                    )}
                  >
                    {isCopied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Quick Copy</>}
                  </button>

                  {/* Mode selector */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-white/90 rounded-xl p-1 shadow-sm flex items-center gap-1">
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

                {/* Card body */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Route summary */}
                  <div className="mb-4">
                    <div className={cn('flex items-center gap-1.5 mb-1', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                      <MapPin size={10} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em]">Route</span>
                    </div>
                    <p className={cn('text-[13px] font-medium leading-snug', theme === 'light' ? 'text-slate-600' : 'text-white/70')}>
                      {generateRouteSummary(pkg.route)}
                    </p>
                  </div>

                  {/* CTA Buttons — nested double-bezel */}
                  <div className="space-y-2 mt-auto">
                    {/* Budget button */}
                    <button
                      onClick={() => onSelectPackage(pkg.id, 'Budget')}
                      className={cn(
                        'group/btn w-full p-[1px] rounded-[0.875rem] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                        theme === 'light'
                          ? 'bg-gradient-to-br from-slate-200 to-slate-100 hover:from-indigo-300 hover:to-indigo-100'
                          : 'bg-white/10 hover:bg-indigo-500/30'
                      )}
                    >
                      <div className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-[calc(0.875rem-1px)] transition-colors duration-500',
                        theme === 'light' ? 'bg-white group-hover/btn:bg-indigo-50' : 'bg-slate-800 group-hover/btn:bg-indigo-900/40'
                      )}>
                        <div className="text-left">
                          <div className={cn('text-[9px] font-bold uppercase tracking-[0.15em] mb-0.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Budget</div>
                          <div className={cn('text-base font-bold font-mono tracking-tight', theme === 'light' ? 'text-slate-900 group-hover/btn:text-indigo-700' : 'text-white group-hover/btn:text-indigo-300')}>
                            {formatCurrency(budgetTotal)}
                          </div>
                          <div className={cn('text-[9px] font-medium', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>
                            {pax} adults · {formatCurrency(budgetPerPerson)}/pp
                          </div>
                        </div>
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-hover/btn:scale-105',
                          theme === 'light' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/30 text-indigo-400'
                        )}>
                          <ArrowRight size={13} />
                        </div>
                      </div>
                    </button>

                    {/* Premium button */}
                    <button
                      onClick={() => onSelectPackage(pkg.id, 'Premium')}
                      className={cn(
                        'group/btn w-full p-[1px] rounded-[0.875rem] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                        theme === 'light'
                          ? 'bg-gradient-to-br from-amber-200 to-amber-100 hover:from-amber-300 hover:to-amber-100'
                          : 'bg-amber-500/20 hover:bg-amber-500/30'
                      )}
                    >
                      <div className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-[calc(0.875rem-1px)] transition-colors duration-500',
                        theme === 'light' ? 'bg-white group-hover/btn:bg-amber-50' : 'bg-slate-800 group-hover/btn:bg-amber-900/30'
                      )}>
                        <div className="text-left">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Star size={9} className="text-amber-400 fill-amber-400" />
                            <span className={cn('text-[9px] font-bold uppercase tracking-[0.15em]', theme === 'light' ? 'text-amber-600' : 'text-amber-400')}>Premium</span>
                          </div>
                          <div className={cn('text-base font-bold font-mono tracking-tight', theme === 'light' ? 'text-slate-900 group-hover/btn:text-amber-700' : 'text-white group-hover/btn:text-amber-300')}>
                            {formatCurrency(premiumTotal)}
                          </div>
                          <div className={cn('text-[9px] font-medium', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>
                            {pax} adults · {formatCurrency(premiumPerPerson)}/pp
                          </div>
                        </div>
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-hover/btn:scale-105',
                          theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/30 text-amber-400'
                        )}>
                          <ArrowRight size={13} />
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
