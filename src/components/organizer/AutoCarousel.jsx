import { useEffect, useState } from 'react';

// Cycles through `items` one at a time, looping forever, for spectator-facing
// displays (Preview Screen) that nobody is actively interacting with.
export default function AutoCarousel({ items, intervalMs = 7000, renderItem, emptyMessage }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  if (items.length === 0) {
    return <div className="flex h-24 items-center justify-center text-center text-sm text-ink-400">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className="relative min-h-[92px]">
        {items.map((item, i) => (
          <div
            key={i}
            aria-hidden={i !== index}
            className={`inset-0 transition-all duration-700 ease-out ${
              i === index ? 'relative translate-x-0 opacity-100' : 'absolute translate-x-2 opacity-0'
            }`}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-4 bg-brand-500' : 'w-1.5 bg-ink-200'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
