import React from 'react';
import { Compass } from 'lucide-react';
export const PageLoader = () => <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-8" role="status" aria-live="polite">
  <span className="crm-brand-mark"><Compass size={24}/></span>
  <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin"/>
  <p className="text-sm text-slate-500">Opening your workspace…</p>
</div>;
export const NavigationBar = () => <div role="progressbar" aria-label="Opening page" className="fixed top-0 inset-x-0 h-0.5 bg-blue-500 z-50"/>;
