import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from './ui/Card';
import { useTheme } from '../contexts/ThemeContext';
import { useLeads } from '../contexts/LeadContext';
import { Lead } from '../types';
import { cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import { MessageCircle, Send, Loader2, Check, CheckCheck, AlertTriangle, ShieldAlert, Maximize2, X, Phone, Video, MoreVertical } from 'lucide-react';

const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

interface ParsedMsg {
  id: string;
  direction: 'in' | 'out';
  text: string;
  status: string;
  timestamp: string;
}

interface WhatsAppChatWidgetProps {
  lead: Lead;
}

const last10 = (raw: string) => String(raw || '').replace(/[^0-9]/g, '').slice(-10);

export const WhatsAppChatWidget: React.FC<WhatsAppChatWidgetProps> = ({ lead }) => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const { interactions } = useLeads();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const popupThreadRef = useRef<HTMLDivElement>(null);

  // Scroll only the chat's own scroll box — never use scrollIntoView() here, it walks
  // up every scrollable ancestor (including the page itself) and nudges the whole
  // CRM screen down whenever a new message arrives via realtime.
  const scrollToBottom = (el: HTMLDivElement | null, smooth: boolean) => {
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const leadPhone10 = last10(lead.contact?.phone || '');

  // Match by phone number, not just this lead's id — a shared number's conversation
  // may have started on a different (or since-deleted) lead record. Older rows saved
  // before phone-tagging existed fall back to matching this lead's id directly.
  // Dedupe: sending/receiving fans a message out to every lead sharing the phone, so
  // the same real-world message can appear as several rows — collapse those to one.
  const messages: ParsedMsg[] = useMemo(() => {
    const seen = new Map<string, ParsedMsg>();
    for (const i of interactions) {
      if (i.type !== 'WhatsApp') continue;
      let p: any;
      try { p = JSON.parse(i.content); } catch { p = { direction: 'in', text: i.content, status: 'received' }; }
      const msgPhone10 = p.phone ? last10(p.phone) : null;
      const matches = msgPhone10 ? (leadPhone10.length === 10 && msgPhone10 === leadPhone10) : i.leadId === lead.id;
      if (!matches) continue;
      const key = msgPhone10
        ? `${msgPhone10}|${p.direction}|${p.text}|${Math.floor(new Date(i.timestamp).getTime() / 2000)}`
        : i.id;
      if (!seen.has(key)) {
        seen.set(key, { id: i.id, direction: p.direction, text: p.text, status: p.status, timestamp: i.timestamp });
      }
    }
    return Array.from(seen.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [interactions, lead.id, leadPhone10]);

  useEffect(() => {
    scrollToBottom(threadRef.current, true);
    scrollToBottom(popupThreadRef.current, true);
  }, [messages.length]);

  useEffect(() => {
    if (!popupOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopupOpen(false); };
    window.addEventListener('keydown', handleEsc);
    // Jump to bottom instantly on open (no smooth-scroll swoop on first paint)
    requestAnimationFrame(() => scrollToBottom(popupThreadRef.current, false));
    return () => window.removeEventListener('keydown', handleEsc);
  }, [popupOpen]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!lead.contact?.phone) { toast.error('This lead has no phone number.'); return; }
    setSending(true);
    setDraft('');
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, phone: lead.contact.phone, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      // Realtime subscription on `interactions` will pick up the row the server just
      // inserted and update this thread automatically — no local optimistic insert needed.
    } catch (e: any) {
      toast.error(e?.message || 'Could not send message.');
      setDraft(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const renderBubble = (m: ParsedMsg) => (
    <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm',
        m.direction === 'out'
          ? 'bg-emerald-500 text-white rounded-br-sm'
          : cn('rounded-bl-sm', theme === 'light' ? 'bg-white text-slate-800' : 'bg-white/10 text-white')
      )}>
        <div className="whitespace-pre-wrap break-words">{m.text}</div>
        <div className={cn('flex items-center gap-1 justify-end mt-1 text-[9px]', m.direction === 'out' ? 'text-white/70' : 'opacity-50')}>
          {new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          {m.direction === 'out' && (
            m.status === 'failed' ? <AlertTriangle size={11} className="text-amber-200" /> :
            m.status === 'sent' ? <Check size={11} /> : <CheckCheck size={11} />
          )}
        </div>
      </div>
    </div>
  );

  const initials = (lead.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

  return (
    <>
    <Card noPadding className="overflow-hidden border-l-4 border-l-emerald-500 flex flex-col">
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-md', theme === 'light' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300')}>
            <MessageCircle size={16} />
          </div>
          <span className={cn('font-bold text-sm', getTextColor())}>WhatsApp</span>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            Live
          </span>
          <button
            onClick={() => setPopupOpen(true)}
            title="Open full chat"
            className={cn('p-1 rounded-md transition hover:scale-110 active:scale-95',
              theme === 'light' ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-white/50 hover:text-emerald-300 hover:bg-white/10')}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Thread */}
      <div ref={threadRef} className={cn('max-h-80 min-h-[140px] overflow-y-auto custom-scrollbar px-4 space-y-2 pb-3',
        theme === 'light' ? 'bg-[#e9f5ee]/40' : 'bg-black/10')}>
        {messages.length === 0 && (
          <div className={cn('text-center text-xs italic py-8', getSecondaryTextColor())}>
            No WhatsApp messages yet. Send the first one below.
          </div>
        )}
        {messages.map(renderBubble)}
      </div>

      {/* Disclaimer — this is a live channel, not a sandbox */}
      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-semibold border-t',
        theme === 'light' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-amber-500/10 text-amber-300 border-amber-500/10')}>
        <ShieldAlert size={12} className="shrink-0" />
        Live channel — messages send instantly from TTE's official WhatsApp number.
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-gray-500/10 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className={cn('flex-1 resize-none px-3 py-2 rounded-lg border outline-none text-[13px] max-h-24', getInputClass())}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 active:scale-90 transition disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </Card>

    {popupOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setPopupOpen(false)} />
        <div className="relative w-full max-w-md h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-[#e5ddd5]">
          {/* WhatsApp-style header */}
          <div className="shrink-0 bg-[#008069] text-white px-4 py-3 flex items-center gap-3">
            <button onClick={() => setPopupOpen(false)} className="p-1 -ml-1 rounded-full hover:bg-white/10 active:scale-90 transition">
              <X size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{lead.name}</div>
              <div className="text-[11px] text-white/70 truncate">{lead.contact?.phone || 'No phone on file'}</div>
            </div>
            <div className="flex items-center gap-3 text-white/85 shrink-0">
              <Video size={18} className="opacity-60" />
              <Phone size={16} className="opacity-60" />
              <MoreVertical size={18} className="opacity-60" />
            </div>
          </div>

          {/* Thread — WhatsApp wallpaper tint */}
          <div
            ref={popupThreadRef}
            className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2"
            style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
          >
            {messages.length === 0 && (
              <div className="text-center text-xs italic py-8 text-slate-500">
                No WhatsApp messages yet. Send the first one below.
              </div>
            )}
            {messages.map(renderBubble)}
          </div>

          {/* Disclaimer */}
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-semibold bg-amber-50 text-amber-700 border-t border-amber-100">
            <ShieldAlert size={12} className="shrink-0" />
            Live channel — messages send instantly from TTE's official WhatsApp number.
          </div>

          {/* Composer */}
          <div className="shrink-0 p-3 bg-white/60 border-t border-black/5 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 resize-none px-3 py-2 rounded-lg border border-black/10 bg-white outline-none text-[13px] max-h-24 text-slate-800"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 active:scale-90 transition disabled:opacity-40"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
