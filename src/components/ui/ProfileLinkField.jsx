import { useState } from 'react';
import FormField, { inputClass } from './FormField';
import { isValidProfileUrl, PROFILE_URL_MAX } from '../../utils/socialProfile';

// One player's Facebook or social media profile link. The problem with a
// link only shows once the player has left the field, so it doesn't nag
// mid-typing.
export default function ProfileLinkField({ label, value, onChange, required = false, hint }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !isValidProfileUrl(value);
  return (
    <FormField label={`${label}${required ? ' *' : ''}`} hint={invalid ? null : hint}>
      <input
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={PROFILE_URL_MAX}
        placeholder="facebook.com/yourname"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid}
        className={`${inputClass} ${invalid ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
      />
      {invalid && <p className="text-[11px] font-semibold text-rose-600">Paste the full profile link, for example facebook.com/yourname.</p>}
    </FormField>
  );
}
