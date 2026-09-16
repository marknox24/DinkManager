import { RefreshCw } from 'lucide-react';
import FormField, { inputClass } from '../ui/FormField';
import { generatePassword } from '../../utils/tempAccess';

// The "Valid for (days)" + generated-password field pair shared by the
// Team page's "Generate temporary login" mode and StaffLoginModal — same
// three inputs, same generate/regenerate behavior, used in two places.
export default function TempAccessFields({ days, onDaysChange, password, onPasswordChange }) {
  return (
    <>
      <FormField label="Valid for (days)" className="max-w-[160px]">
        <input
          type="number"
          min={1}
          step={1}
          required
          value={days}
          onChange={(e) => onDaysChange(e.target.value)}
          className={inputClass}
        />
      </FormField>
      <FormField label="Temporary password">
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
            className="flex h-full shrink-0 items-center justify-center rounded-xl border border-ink-200 px-3 text-ink-500 transition hover:bg-ink-50"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </FormField>
    </>
  );
}
