import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { parseFaqItems } from '../../utils/faq';

// Renders an organizer's FAQ (or any {q,a} list) as click-to-expand
// questions. `raw` is the event's stored `faq` string (parseFaqItems also
// understands the older freeform "Q: ...\nA: ..." format, so events set up
// before this existed still render correctly); pass `items` directly
// instead when the caller already has a plain {q,a} array (e.g. the
// marketing page's hardcoded FAQ copy) — no serialize/parse round trip
// needed. `variant="card"` (default) is the bordered-box look used on
// PublicEventPage.jsx; `variant="divided"` is a borderless list matching
// the marketing site's style. Both share the same grid-based open/close
// transition — previously only the marketing page's own local
// implementation had this, so this is a strict animation upgrade for the
// card variant too, not just a dedupe.
export default function FaqAccordion({ raw, items: itemsProp, variant = 'card' }) {
  const items = raw ? parseFaqItems(raw) : (itemsProp ?? []);
  const [openIndex, setOpenIndex] = useState(variant === 'divided' ? 0 : 0);

  if (items.length === 0) return null;

  if (variant === 'divided') {
    return (
      <div className="border-t border-ink-100">
        {items.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={item.q || i} className="border-b border-ink-100">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-[15px] font-semibold text-ink-900">{item.q || `Question ${i + 1}`}</span>
                <ChevronDown size={18} className={`shrink-0 text-ink-400 transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`} />
              </button>
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
                <div className="overflow-hidden">
                  <p className="pb-5 pr-8 text-sm leading-relaxed text-ink-500">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q || i} className="overflow-hidden rounded-xl border border-ink-100">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? -1 : i)}
              className="flex w-full items-center justify-between gap-3 bg-ink-50/60 px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-ink-800">{item.q || `Question ${i + 1}`}</span>
              <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
              <div className="overflow-hidden">
                <p className="whitespace-pre-line px-4 py-3 text-sm leading-relaxed text-ink-600">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
