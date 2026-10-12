import React, { Suspense, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';

const Details = React.lazy(() => import('../pages/LeadDetails').then(m => ({ default: m.LeadDetails })));

export function BookingDetailsDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { theme } = useTheme();
  const panel = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const reportDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
  const close = useCallback(() => {
    if (!dirty.current || window.confirm('Discard unsaved booking changes?')) onClose();
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);

  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-5">
    <button tabIndex={-1} aria-label="Close booking backdrop" className="absolute inset-0 bg-slate-900/40" onClick={close} />
    <div ref={panel} role="dialog" aria-modal="true" aria-label="Booking details" tabIndex={-1}
      onKeyDown={e => {
        // A payment/vendor modal inside the booking owns its own Escape key.
        if (e.key === 'Escape' && !panel.current?.querySelector('.fixed.inset-0')) { e.stopPropagation(); close(); }
        if (e.key !== 'Tab') return;
        const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || [])].filter(n => n.getClientRects().length);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { e.preventDefault(); first.focus(); }
      }}
      className={cn('relative flex flex-col w-full max-w-6xl h-[94dvh] rounded-2xl shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 overflow-hidden', theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-900 text-white')}>
      <div className="flex items-center justify-between border-b border-slate-500/20 px-5 py-3 shrink-0">
        <div><h2 className="font-bold">Booking details</h2><p className="text-xs opacity-50">Close to return to your filtered accounts</p></div>
        <button aria-label="Close booking details" onClick={close} className="p-2 rounded-lg hover:bg-slate-500/10 focus-visible:ring-2"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <Suspense fallback={<div role="status" className="p-8 text-center">Loading booking details…</div>}><Details leadId={leadId} embedded onClose={close} onDirtyChange={reportDirty} /></Suspense>
      </div>
    </div>
  </div>, document.body);
}
