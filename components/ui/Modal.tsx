import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'default' | 'wide';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'default' }) => {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const prior = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = (): HTMLElement[] => (Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') || []) as HTMLElement[]).filter(el => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => (ref.current?.querySelector<HTMLElement>('[autofocus]') || focusable()[0] || ref.current)?.focus());
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length-1] !== ref.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items[items.length-1];
        if (!first) { event.preventDefault(); ref.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown, true);
      if (prior?.isConnected) prior.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return createPortal(
    <div className="crm-dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className={cn('crm-dialog', size === 'wide' && 'crm-dialog-wide')}>
        <div className="crm-dialog-header"><h2 id={id}>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose} className="crm-icon-button"><X size={20}/></button></div>
        <div className="crm-dialog-body">{children}</div>
      </div>
    </div>, document.body
  );
};
