import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { inputClass, textareaClass } from '../ui/FormField';

// Q&A pairs, each its own mini-accordion — mirrors exactly how players see
// the FAQ on the public event page (click a question, see the answer), so
// what the organizer composes here is what players get, instead of a
// freeform "Q: ...\nA: ..." textarea that's easy to mis-format.
export default function FaqEditor({ items, onChange }) {
  const [openIndex, setOpenIndex] = useState(items.length > 0 ? 0 : -1);

  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
    setOpenIndex(-1);
  };

  const addItem = () => {
    onChange([...items, { q: '', a: '' }]);
    setOpenIndex(items.length);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 px-3.5 py-4 text-center text-xs text-ink-400">
          No questions yet — add the ones players ask most before registering.
        </p>
      )}
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-ink-100">
            <div className="flex items-center gap-1 bg-ink-50/60 pr-1.5">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
              >
                <ChevronDown size={13} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                <span className="truncate text-sm font-semibold text-ink-800">{item.q || `Question ${i + 1}`}</span>
              </button>
              <button
                type="button"
                onClick={() => removeItem(i)}
                title="Remove question"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {open && (
              <div className="flex flex-col gap-2 border-t border-ink-100 p-3">
                <input
                  defaultValue={item.q}
                  onBlur={(e) => updateItem(i, { q: e.target.value })}
                  placeholder="e.g. Can I register on the day of the event?"
                  className={inputClass}
                />
                <textarea
                  defaultValue={item.a}
                  onBlur={(e) => updateItem(i, { a: e.target.value })}
                  placeholder="e.g. Walk-in registrations are subject to availability."
                  className={`${textareaClass} min-h-[70px]`}
                />
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-200 py-2.5 text-xs font-bold text-ink-500 transition hover:bg-ink-50"
      >
        <Plus size={13} /> Add question
      </button>
    </div>
  );
}
