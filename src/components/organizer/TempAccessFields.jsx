import { RefreshCw } from 'lucide-react';
import FormField, { inputClass } from '../ui/FormField';
import { generatePassword } from '../../utils/tempAccess';

// Event-day logins are almost always 1–3 days; the presets make that one tap
// instead of select-and-type, while the number input still takes any value.
const DAY_PRESETS = [1, 3, 7, 30];

// The "Valid for" + generated-password field pair shared by the Team page's
// "Generate temporary login" mode and StaffLoginModal — same inputs, same
// generate/regenerate behavior, used in two places.
// `neverExpires`/`onNeverExpiresChange` are optional: only the Team page's
// invite card offers "No expiry" (StaffLoginModal has its own explicit
// "Make permanent" action instead).
export default function TempAccessFields({ days, onDaysChange, password, onPasswordChange, neverExpires = false, onNeverExpiresChange }) {
  return (
    <>
      <FormField label="Valid for">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              required
              value={days}
              onChange={(e) => onDaysChange(e.target.value)}
              aria-label="Valid for (days)"
              disabled={neverExpires}
              className="w-20 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-center text-sm outline-none transition-opacity focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-40"
            />
            <span className="text-sm text-ink-500">days</span>
          </div>
          <div className="flex gap-1.5">
            {DAY_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onNeverExpiresChange?.(false);
                  onDaysChange(d);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.95] ${
                  !neverExpires && Number(days) === d ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                {d}d
              </button>
            ))}
            {onNeverExpiresChange && (
              <button
                type="button"
                onClick={() => onNeverExpiresChange(!neverExpires)}
                aria-pressed={neverExpires}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.95] ${
                  neverExpires ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
                }`}
              >
                No expiry
              </button>
            )}
          </div>
        </div>
      </FormField>
      <FormField label="Temporary password" hint="Generated for you — edit it, or regenerate. You'll copy it once it's created.">
        <div className="flex items-center gap-2">
          <input
            required
            minLength={6}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={`${inputClass} font-mono`}
          />
          <button
            type="button"
            title="Generate a new random password"
            onClick={() => onPasswordChange(generatePassword())}
            className="flex h-full shrink-0 items-center justify-center rounded-xl border border-ink-200 px-3 text-ink-500 transition-[background-color,transform] duration-150 hover:bg-ink-50 active:scale-[0.95]"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </FormField>
    </>
  );
}
