import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { REGISTRATION_FIELD_TYPES } from '../../data/constants';
import { inputClass } from '../ui/FormField';
import Select from '../ui/Select';

export default function RegistrationFieldEditor({ field, onSave, onDelete }) {
  const [local, setLocal] = useState(field);

  const commit = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onSave(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
      <input
        value={local.label}
        onChange={(e) => setLocal((p) => ({ ...p, label: e.target.value }))}
        onBlur={() => commit({ label: local.label })}
        placeholder="Field label, e.g. Team Name"
        className={`${inputClass} flex-1 min-w-[160px]`}
      />
      <Select value={local.field_type} onChange={(e) => commit({ field_type: e.target.value })} className={`${inputClass} w-40`}>
        {REGISTRATION_FIELD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
        <input type="checkbox" checked={local.required} onChange={(e) => commit({ required: e.target.checked })} className="h-4 w-4 rounded border-ink-300" />
        Required
      </label>
      <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
