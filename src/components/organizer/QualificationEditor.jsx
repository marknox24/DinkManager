import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { QUALIFICATION_LABEL_PRESETS } from '../../data/constants';
import { inputClass } from '../ui/FormField';

// qualification = [{ label, value }] — organizer-defined eligibility rows
// (DUPR requirement, age, gender, club restriction, etc.) shown as a
// checklist on the player-facing category detail view.
export default function QualificationEditor({ qualification, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const update = (idx, patch) => {
    onChange(qualification.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const remove = (idx) => onChange(qualification.filter((_, i) => i !== idx));

  const add = (label = '') => {
    onChange([...qualification, { label, value: '' }]);
    setPickerOpen(false);
  };

  const availablePresets = QUALIFICATION_LABEL_PRESETS.filter((p) => !qualification.some((q) => q.label === p));

  return (
    <div className="flex flex-col gap-2">
      {qualification.map((q, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={q.label}
            onChange={(e) => update(idx, { label: e.target.value })}
            placeholder="Requirement, e.g. DUPR Requirement"
            className={`${inputClass} w-44 shrink-0`}
          />
          <input
            value={q.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="e.g. Below 3.0"
            className={`${inputClass} flex-1`}
          />
          <button
            onClick={() => remove(idx)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50"
            title="Remove requirement"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="relative w-fit">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:border-brand-400 hover:text-brand-600"
        >
          <Plus size={12} /> Add requirement
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-10 mt-1.5 flex w-56 flex-col gap-0.5 rounded-xl border border-ink-100 bg-white p-1.5 shadow-lg">
            {availablePresets.map((p) => (
              <button key={p} onClick={() => add(p)} className="rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-ink-700 hover:bg-ink-50">
                {p}
              </button>
            ))}
            <button onClick={() => add('')} className="rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-brand-600 hover:bg-brand-50">
              Custom requirement…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
