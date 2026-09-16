import { useState } from 'react';

// tabs = [{ id, label, content }] — pre-filtered by the caller (no "hide
// empty tab" logic here, that decision belongs to whoever builds the list).
export default function Tabs({ tabs }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) || tabs[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-ink-100 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              active?.id === t.id ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active?.content}
    </div>
  );
}
