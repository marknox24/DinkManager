import { Plus, Trash2 } from 'lucide-react';
import { inputClass } from '../../ui/FormField';

let seq = 1;

// Same plain-array-in-parent-state idiom as ContactsEditor.jsx: update/
// remove/add against `breaks`, nothing persisted anywhere.
export default function BreaksEditor({ breaks, onChange }) {
  const update = (idx, patch) => onChange(breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  const remove = (idx) => onChange(breaks.filter((_, i) => i !== idx));
  const add = () => onChange([...breaks, { id: `break-${seq++}`, label: 'Lunch', startTime: '12:00', endTime: '13:00' }]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Scheduled breaks</p>
      {breaks.map((b, i) => (
        <div key={b.id} className="animate-slide-down flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/40 p-2">
          <input
            value={b.label}
            onChange={(e) => update(i, { label: e.target.value })}
            aria-label="Break label"
            className={`${inputClass} min-w-0 flex-1 basis-24 py-1.5`}
          />
          <input type="time" value={b.startTime} onChange={(e) => update(i, { startTime: e.target.value })} aria-label="Break start time" className={`${inputClass} w-28 shrink-0 py-1.5`} />
          <span className="text-xs text-ink-400">to</span>
          <input type="time" value={b.endTime} onChange={(e) => update(i, { endTime: e.target.value })} aria-label="Break end time" className={`${inputClass} w-28 shrink-0 py-1.5`} />
          <button onClick={() => remove(i)} aria-label={`Remove ${b.label}`} className="press-scale shrink-0 rounded-full p-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="press-scale flex w-fit items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-3.5 py-1.5 text-xs font-bold text-ink-500 transition hover:border-brand-400 hover:text-brand-600"
      >
        <Plus size={12} /> Add break
      </button>
    </div>
  );
}
