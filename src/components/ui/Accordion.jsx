import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// A single collapsible section, visually consistent with the app's other
// card-style accordions (e.g. BracketsPage.jsx's pool sections). Several of
// these stacked together turn a page of simultaneously-visible giant
// textareas into a scannable list the organizer opens one at a time — each
// stays independently toggleable (not an exclusive "only one open" accordion)
// since these fields are edited somewhat independently, and forcing one
// closed just because another opened would be more frustrating than helpful.
export default function AccordionItem({ title, subtitle, defaultOpen = false, filled = false, optional = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-ink-50/60"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-700">{title}</span>
            {optional && <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-400">Optional</span>}
            {filled && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600" title="Filled in">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </div>
          {subtitle && !open && <p className="mt-0.5 truncate text-xs text-ink-400">{subtitle}</p>}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-ink-100 p-4">{children}</div>}
    </div>
  );
}
