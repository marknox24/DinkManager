// V1 / V2 switch shown above every score sheet preview. Only V2 carries the
// "New" badge, so organizers can tell at a glance which layout is the new one.
const OPTIONS = [
  { id: 'v1', label: 'V1', hint: 'Classic · 18 boxes' },
  { id: 'v2', label: 'V2', hint: 'Rally strip · 0–15', isNew: true },
];

export function NewBadge() {
  return (
    <span className="rounded-full bg-brand-600 px-1.5 py-px text-[9px] font-extrabold uppercase leading-[14px] tracking-wider text-white">
      New
    </span>
  );
}

export default function ScoreSheetTemplatePicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Score sheet template" className="inline-flex rounded-full border border-ink-200 bg-ink-50 p-0.5">
      {OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] ${
              active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            {o.label}
            <span className={`hidden font-medium sm:inline ${active ? 'text-ink-500' : 'text-ink-400'}`}>{o.hint}</span>
            {o.isNew && <NewBadge />}
          </button>
        );
      })}
    </div>
  );
}
