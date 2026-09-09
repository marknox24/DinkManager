import { Plus, Trash2 } from 'lucide-react';
import { CONTACT_TYPES } from '../../data/constants';
import { inputClass } from '../ui/FormField';

export default function ContactsEditor({ contacts, onChange }) {
  const update = (idx, patch) => {
    const next = contacts.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const remove = (idx) => onChange(contacts.filter((_, i) => i !== idx));

  const add = () => {
    if (contacts.length >= 3) return;
    onChange([...contacts, { type: 'Phone', value: '' }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((c, idx) => (
        <div key={idx} className="rounded-xl border border-ink-200 p-3">
          <div className="mb-2 flex items-center gap-2">
            <select value={c.type} onChange={(e) => update(idx, { type: e.target.value })} className={`${inputClass} w-36 py-2`}>
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => remove(idx)}
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50"
              title="Remove contact"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <input
            value={c.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder={c.type === 'Email' ? 'club@example.com' : c.type === 'Website' ? 'https://www.example.com' : '+1 555 000 0000'}
            className={`${inputClass} w-full`}
          />
        </div>
      ))}
      {contacts.length < 3 && (
        <button
          onClick={add}
          className="flex w-fit items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:border-brand-400 hover:text-brand-600"
        >
          <Plus size={12} /> Add contact
        </button>
      )}
    </div>
  );
}
