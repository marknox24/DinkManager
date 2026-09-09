import { useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { CURRENCIES, MATCH_FORMATS, MATCH_TYPES } from '../../data/constants';
import { getEventMediaUrl, uploadEventMedia } from '../../data/eventsApi';
import { useToast } from '../../context/ToastContext';
import FormField, { inputClass, textareaClass } from '../ui/FormField';

export default function CategoryEditor({ eventId, category, onSave, onDelete }) {
  const { pushToast } = useToast();
  const [local, setLocal] = useState(category);
  const [customMatchType, setCustomMatchType] = useState(!MATCH_TYPES.includes(category.match_type));
  const [customFormat, setCustomFormat] = useState(!MATCH_FORMATS.includes(category.format));
  const [uploadingImage, setUploadingImage] = useState(false);

  const set = (field, value) => setLocal((prev) => ({ ...prev, [field]: value }));

  const commit = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onSave(next);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const { path } = await uploadEventMedia(eventId, file);
      commit({ image_path: path });
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          value={local.name}
          onChange={(e) => set('name', e.target.value)}
          onBlur={() => commit({ name: local.name })}
          placeholder="Category name, e.g. Men's Singles A"
          className="flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          onClick={onDelete}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50"
          title="Delete category"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <FormField label="Description" hint="Explain the skill level / qualification for this category, e.g. Intermediate, DUPR 3.0-3.5">
          <textarea
            value={local.description || ''}
            onChange={(e) => set('description', e.target.value)}
            onBlur={() => commit({ description: local.description })}
            placeholder="e.g. Intermediate players only (DUPR 3.0-3.5 or equivalent). Bring your own paddle."
            className={textareaClass}
          />
        </FormField>
        <FormField label="Category image">
          <div className="flex items-center gap-3">
            {local.image_path ? (
              <img src={getEventMediaUrl(local.image_path)} alt="" className="h-20 w-20 rounded-xl border border-ink-200 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-ink-300 text-ink-300">
                <ImagePlus size={20} />
              </div>
            )}
            <label className="cursor-pointer rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:bg-ink-100">
              {uploadingImage ? <Loader2 size={13} className="inline animate-spin" /> : local.image_path ? 'Replace' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
                className="hidden"
              />
            </label>
          </div>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Match type">
          {customMatchType ? (
            <input
              value={local.match_type}
              onChange={(e) => set('match_type', e.target.value)}
              onBlur={() => commit({ match_type: local.match_type })}
              className={inputClass}
            />
          ) : (
            <select
              value={local.match_type}
              onChange={(e) => {
                if (e.target.value === 'Custom') {
                  setCustomMatchType(true);
                  set('match_type', '');
                } else {
                  commit({ match_type: e.target.value });
                }
              }}
              className={inputClass}
            >
              {MATCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Format">
          {customFormat ? (
            <input
              value={local.format}
              onChange={(e) => set('format', e.target.value)}
              onBlur={() => commit({ format: local.format })}
              className={inputClass}
            />
          ) : (
            <select
              value={local.format}
              onChange={(e) => {
                if (e.target.value === 'Custom') {
                  setCustomFormat(true);
                  set('format', '');
                } else {
                  commit({ format: e.target.value });
                }
              }}
              className={inputClass}
            >
              {MATCH_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Max slots">
          <input
            type="number"
            min={0}
            value={local.max_slots ?? ''}
            onChange={(e) => set('max_slots', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            onBlur={() => commit({ max_slots: local.max_slots })}
            className={inputClass}
          />
        </FormField>

        <FormField label="Est. time per match (min)" hint="Falls back to the event's default match duration if left blank">
          <input
            type="number"
            min={1}
            value={local.estimated_match_minutes ?? ''}
            onChange={(e) => set('estimated_match_minutes', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            onBlur={() => commit({ estimated_match_minutes: local.estimated_match_minutes })}
            className={inputClass}
          />
        </FormField>

        <FormField label="Registration fee">
          <div className="flex gap-1.5">
            <select
              value={local.fee_currency}
              onChange={(e) => commit({ fee_currency: e.target.value })}
              className={`${inputClass} w-[4.75rem] shrink-0 px-2`}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} title={c.name}>
                  {c.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              value={local.fee_amount}
              onChange={(e) => set('fee_amount', e.target.value)}
              onBlur={() => commit({ fee_amount: parseFloat(local.fee_amount) || 0 })}
              className={inputClass}
            />
          </div>
        </FormField>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="🏆 Champion prize">
          <input
            value={local.prize_champion || ''}
            onChange={(e) => set('prize_champion', e.target.value)}
            onBlur={() => commit({ prize_champion: local.prize_champion })}
            className={inputClass}
          />
        </FormField>
        <FormField label="🥈 1st runner-up prize">
          <input
            value={local.prize_runner_up || ''}
            onChange={(e) => set('prize_runner_up', e.target.value)}
            onBlur={() => commit({ prize_runner_up: local.prize_runner_up })}
            className={inputClass}
          />
        </FormField>
        <FormField label="🥉 2nd runner-up prize">
          <input
            value={local.prize_second_runner_up || ''}
            onChange={(e) => set('prize_second_runner_up', e.target.value)}
            onBlur={() => commit({ prize_second_runner_up: local.prize_second_runner_up })}
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}
