import { useState } from 'react';
import { ChevronDown, ImagePlus, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { CURRENCIES, MATCH_FORMATS, MATCH_TYPES } from '../../data/constants';
import { getEventMediaUrl, uploadEventMedia } from '../../data/eventsApi';
import { PLAYOFF_STAGES, deriveLadder } from '../../data/playoffApi';
import { useToast } from '../../context/ToastContext';
import FormField, { inputClass, textareaClass } from '../ui/FormField';
import Select from '../ui/Select';
import ImageDropzone from '../ui/ImageDropzone';
import PlayoffStagesEditor from './PlayoffStagesEditor';
import QualificationEditor from './QualificationEditor';

// Collapsed by default (see defaultOpen below) — with several categories on
// one event, a fully-expanded list turns into a long, hard-to-scan scroll.
// The header row stays clickable to expand/collapse; the name field and
// delete button inside it stop that click from bubbling so they keep
// working normally while collapsed.
export default function CategoryEditor({ eventId, category, onSave, onDelete, defaultOpen = false }) {
  const { pushToast } = useToast();
  const [local, setLocal] = useState(category);
  const [customMatchType, setCustomMatchType] = useState(!MATCH_TYPES.includes(category.match_type));
  const [customFormat, setCustomFormat] = useState(!MATCH_FORMATS.includes(category.format));
  const [uploadingImage, setUploadingImage] = useState(false);
  const [playoffOpen, setPlayoffOpen] = useState(false);
  const [expanded, setExpanded] = useState(defaultOpen);

  const set = (field, value) => setLocal((prev) => ({ ...prev, [field]: value }));

  const commit = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onSave(next);
  };

  const ladderSummary = (() => {
    if (!local.playoff_enabled) return '';
    const ladder = deriveLadder({
      poolPairs: local.playoff_pool_pairs || [],
      advancePerPool: local.playoff_advance_per_pool,
      thirdPlace: local.playoff_third_place,
    });
    if (!ladder.valid) return 'Invalid setup';
    return ladder.levels.map((l) => PLAYOFF_STAGES[l.kind].short).join(' → ');
  })();

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

  const summary = [
    local.match_type,
    local.format,
    local.fee_amount > 0 ? `${local.fee_amount} ${local.fee_currency}` : 'Free',
    local.max_slots ? `Max ${local.max_slots}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-ink-50/60"
      >
        {local.image_path ? (
          <img src={getEventMediaUrl(local.image_path)} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-ink-200 object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-300">
            <ImagePlus size={16} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <input
            value={local.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => commit({ name: local.name })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Category name, e.g. Men's Singles A"
            className="w-full truncate bg-transparent p-0 text-sm font-bold text-ink-900 outline-none"
          />
          <div className="truncate text-xs text-ink-500">{summary}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50"
          title="Delete category"
        >
          <Trash2 size={14} />
        </button>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-ink-100 bg-ink-50/40 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
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
              <ImageDropzone
                imagePath={local.image_path}
                getUrl={getEventMediaUrl}
                onUpload={handleImageUpload}
                uploading={uploadingImage}
                className="h-20 w-20"
                emptyIcon={ImagePlus}
                emptyLabel="Upload"
              />
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
                <Select
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
                </Select>
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
                <Select
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
                </Select>
              )}
            </FormField>

            {/round robin/i.test(local.format || '') && (
              <FormField label="Playoffs after pool play">
                <button
                  type="button"
                  onClick={() => setPlayoffOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                >
                  <Trophy size={14} className="text-brand-500" />
                  {local.playoff_enabled ? `${ladderSummary} — edit levels` : 'Set up levels'}
                </button>
              </FormField>
            )}

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

            <FormField label="Registration fee per team">
              <div className="flex gap-1.5">
                <Select
                  value={local.fee_currency}
                  onChange={(e) => commit({ fee_currency: e.target.value })}
                  className={`${inputClass} w-[4.75rem] shrink-0 pl-2`}
                  dense
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {c.code}
                    </option>
                  ))}
                </Select>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          <div className="border-t border-ink-200 pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
              <ShieldCheck size={12} /> Qualification &amp; eligibility
            </div>
            <p className="mb-3 text-xs text-ink-500">
              Shown to players before they register — separate from the description above. Use this for DUPR/rating limits, age or gender
              restrictions, club/location restrictions, prior-podium restrictions, or partner/team requirements.
            </p>
            <QualificationEditor qualification={local.qualification || []} onChange={(qualification) => commit({ qualification })} />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Qualification notes" hint="Any additional eligibility rules in plain language.">
                <textarea
                  value={local.qualification_notes || ''}
                  onChange={(e) => set('qualification_notes', e.target.value)}
                  onBlur={() => commit({ qualification_notes: local.qualification_notes })}
                  placeholder="e.g. Must not have finished 1st or 2nd in an Intermediate or higher division within the last 12 months."
                  className={textareaClass}
                />
              </FormField>
              <FormField label="Disqualification conditions" hint="When a registered player can be removed from this category.">
                <textarea
                  value={local.disqualification_notes || ''}
                  onChange={(e) => set('disqualification_notes', e.target.value)}
                  onBlur={() => commit({ disqualification_notes: local.disqualification_notes })}
                  placeholder="e.g. Players found to be misrepresenting their skill level or rating will be disqualified without refund."
                  className={textareaClass}
                />
              </FormField>
            </div>
          </div>
        </div>
      )}

      {playoffOpen && (
        <PlayoffStagesEditor
          category={local}
          onSave={(patch) => {
            commit(patch);
            setPlayoffOpen(false);
          }}
          onClose={() => setPlayoffOpen(false)}
        />
      )}
    </div>
  );
}
