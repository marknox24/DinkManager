import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import FormField, { inputClass } from '../../ui/FormField';
import Switch from '../../ui/Switch';
import NumberInput from '../../ui/NumberInput';
import BreaksEditor from './BreaksEditor';

// Only the handful of settings every organizer actually thinks about
// (courts, start time, match length, optional target finish) show by
// default. The rest are real but rarely-touched tuning knobs, so they're
// tucked behind "Advanced settings" rather than competing for attention.
export default function GlobalSettingsPanel({ settings, setSettings }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const set = (patch) => setSettings({ ...settings, ...patch });

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h3 className="font-display mb-4 text-base font-bold text-ink-900">Courts &amp; schedule</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Available courts">
          <NumberInput value={settings.courtCount} onChange={(v) => set({ courtCount: v })} min={1} max={32} />
        </FormField>
        <FormField label="Start time">
          <input type="time" value={settings.startTime} onChange={(e) => set({ startTime: e.target.value })} className={inputClass} />
        </FormField>
        <FormField label="Match duration (minutes)">
          <NumberInput value={settings.matchDurationMinutes} onChange={(v) => set({ matchDurationMinutes: v })} min={5} max={180} />
        </FormField>
        <FormField label="Target finish time" hint="Optional — we'll flag it if the schedule runs over">
          <div className="flex items-center gap-2">
            <Switch checked={settings.targetFinishEnabled} onChange={(v) => set({ targetFinishEnabled: v })} />
            <input
              type="time"
              value={settings.targetFinishTime}
              onChange={(e) => set({ targetFinishTime: e.target.value })}
              disabled={!settings.targetFinishEnabled}
              className={`${inputClass} disabled:opacity-50`}
            />
          </div>
        </FormField>
      </div>

      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        aria-expanded={advancedOpen}
        className="press-scale mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-ink-200 px-3.5 py-2.5 text-xs font-bold text-ink-500 transition hover:border-ink-300 hover:text-ink-700"
      >
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} /> Advanced settings
        </span>
        <ChevronDown size={14} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
      </button>

      {advancedOpen && (
        <div className="animate-slide-down mt-3 flex flex-col gap-4 rounded-xl bg-ink-50/40 p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Changeover buffer (minutes)" hint="Court turnover time between matches">
              <NumberInput value={settings.changeoverBufferMinutes} onChange={(v) => set({ changeoverBufferMinutes: v })} min={0} max={60} />
            </FormField>
            <FormField label="Minimum rest per team (minutes)">
              <NumberInput value={settings.minRestMinutes} onChange={(v) => set({ minRestMinutes: v })} min={0} max={120} />
            </FormField>
            <FormField label="Warm-up / court prep (minutes)" hint="Applied once, before the first match">
              <NumberInput value={settings.warmupMinutes} onChange={(v) => set({ warmupMinutes: v })} min={0} max={60} />
            </FormField>
            <FormField label="Delay buffer (minutes)" hint="Shown as a finish-time range, not added per match">
              <NumberInput value={settings.delayBufferMinutes} onChange={(v) => set({ delayBufferMinutes: v })} min={0} max={180} />
            </FormField>
          </div>

          <div className="border-t border-ink-100 pt-3.5">
            <BreaksEditor breaks={settings.breaks} onChange={(breaks) => set({ breaks })} />
          </div>
        </div>
      )}
    </div>
  );
}
