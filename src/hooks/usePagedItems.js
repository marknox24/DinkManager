import { useEffect, useMemo, useState } from 'react';

// Chunks `items` into pages of `pageSize` and auto-advances through them —
// for spectator displays (Preview Screen brackets/courts) where there's no
// one around to scroll: if it doesn't fit on one page, it has to cycle on
// its own so a waiting player eventually sees their name without input.
export function usePagedItems(items, pageSize, intervalMs) {
  const pages = useMemo(() => {
    if (items.length <= pageSize) return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += pageSize) chunks.push(items.slice(i, i + pageSize));
    return chunks;
  }, [items, pageSize]);

  const [pageIndex, setPageIndex] = useState(0);

  // Reset to page 1 whenever the page count changes (category switch, teams
  // added/removed) rather than stranding the viewer on a now out-of-range page.
  useEffect(() => {
    setPageIndex(0);
  }, [pages.length]);

  useEffect(() => {
    if (pages.length <= 1) return undefined;
    const id = setInterval(() => setPageIndex((i) => (i + 1) % pages.length), intervalMs);
    return () => clearInterval(id);
  }, [pages.length, intervalMs]);

  return { page: pages[pageIndex] || [], pageIndex, totalPages: pages.length };
}
