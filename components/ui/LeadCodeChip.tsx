import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Check, Copy } from 'lucide-react';

/**
 * Displays a lead's human-readable code (TTE-0001) — click to copy.
 *
 * Renders NOTHING when the lead has no code yet, so the app degrades cleanly
 * on any environment where migration 006_lead_code.sql hasn't run. The code is
 * display-only: `lead.id` (uuid) remains the real key for routing and every
 * lead_id reference in interactions/reminders/payments/documents.
 */
export const LeadCodeChip: React.FC<{
  code?: string;
  size?: 'sm' | 'md';
  copyable?: boolean;
  className?: string;
}> = ({ code, size = 'sm', copyable = true, className }) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const handleCopy = (e: React.MouseEvent) => {
    if (!copyable) return;
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(code).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => {},
    );
  };

  const base = cn(
    'inline-flex items-center gap-1 rounded-md font-mono font-bold tracking-tight whitespace-nowrap border',
    size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[12px] px-2 py-1',
    theme === 'light'
      ? 'bg-slate-100 border-slate-200 text-slate-600'
      : 'bg-white/10 border-white/10 text-white/70',
    copyable && 'cursor-pointer hover:border-slate-400 transition-colors',
    className,
  );

  if (!copyable) return <span className={base}>{code}</span>;

  return (
    <button type="button" onClick={handleCopy} className={base} title="Copy lead code">
      {code}
      {copied
        ? <Check size={size === 'sm' ? 9 : 11} className="text-emerald-500" />
        : <Copy size={size === 'sm' ? 9 : 11} className="opacity-40" />}
    </button>
  );
};
