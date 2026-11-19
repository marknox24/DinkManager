import Select from '../ui/Select';
import FormField, { inputClass } from '../ui/FormField';
import { POINTS_METRICS, SEMIFINAL_PAIRINGS, crossoverOption } from '../../utils/playoffLadder';

// The semifinal setup controls, shared by Event Details (PlayoffStagesEditor,
// set ahead of time) and the Match List's generate popup (SemifinalSetupModal,
// confirmed on the day), so both always offer the same choices.

// The two ways to match the semifinals, as a pair of option cards.
export function SemifinalSeedingCards({ poolCount, opensKnockout, value, onChange }) {
  const options = [
    { value: 'crossover', ...crossoverOption(poolCount, opensKnockout) },
    { value: 'points', title: 'Points system', hint: 'Seeded by point differential' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
            value === opt.value ? 'border-brand-500 bg-brand-50/60' : 'border-ink-100 bg-white hover:border-ink-200'
          }`}
        >
          <span className="block text-sm font-bold text-ink-900">{opt.title}</span>
          <span className="block text-[11px] text-ink-500">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}

// The points system's Matchups and Rank by choices. The caller lays them out
// (stacked in the editor, side by side in the popup).
export function SemifinalPointsFields({ pairing, onPairingChange, metric, onMetricChange, showMetricHint = false }) {
  const metricHint = !showMetricHint
    ? undefined
    : metric === 'average'
      ? 'Point differential divided by games played, so a team from a smaller pool isn’t disadvantaged.'
      : 'The +/− shown in the standings table.';
  return (
    <>
      <FormField label="Matchups">
        <Select value={pairing} onChange={(e) => onPairingChange(e.target.value)} className={inputClass}>
          {Object.entries(SEMIFINAL_PAIRINGS).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Rank by" hint={metricHint}>
        <Select value={metric} onChange={(e) => onMetricChange(e.target.value)} className={inputClass}>
          {Object.entries(POINTS_METRICS).map(([key, m]) => (
            <option key={key} value={key}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
