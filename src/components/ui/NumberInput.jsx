import { inputClass } from './FormField';

// No NumberInput primitive existed anywhere in the app before this —
// every numeric field elsewhere is a bare <input type="number"> with
// inline parse logic. This gives that pattern one shared, safe home:
// onChange always receives a real number or null (an emptied field),
// never NaN leaking into state the way `parseInt(e.target.value)` would
// the moment a user clears the box while typing.
export default function NumberInput({ value, onChange, min, max, step = 1, className = '', ...props }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (Number.isNaN(n)) return;
        onChange(n);
      }}
      className={`${inputClass} ${className}`}
      {...props}
    />
  );
}
