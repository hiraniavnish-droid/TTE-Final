import React, { useEffect, useRef, useState } from 'react';

// Keep initial DOM small. The next batch is mounted near the scroll boundary.
export function IncrementalList<T extends { id: string }>({ items, renderItem, batchSize = 30, resetKey = '' }: {
  items: T[]; renderItem: (item: T) => React.ReactNode; batchSize?: number; resetKey?: string;
}) {
  const [limit, setLimit] = useState(batchSize);
  const marker = useRef<HTMLButtonElement>(null);
  useEffect(() => setLimit(batchSize), [resetKey, batchSize]);
  useEffect(() => {
    const node = marker.current;
    if (!node || !('IntersectionObserver' in window)) return;
    let root = node.parentElement;
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setLimit(v => v + batchSize);
    }, { root, rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [limit, items.length, batchSize, resetKey]);
  return <>
    {items.slice(0, limit).map(item => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)}
    {limit < items.length && <button ref={marker} type="button" className="col-span-full w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => setLimit(v => v + batchSize)}>Show more leads ({items.length - limit} remaining)</button>}
  </>;
}

export function useDesktopLayout() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return desktop;
}
