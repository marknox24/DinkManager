import { ChevronDown } from 'lucide-react';

// Wraps a native <select> with a brand-colored chevron that actually has
// room to breathe — the native arrow rendered by appearance:auto sits
// flush against the box border in several browsers, which is what this
// replaces everywhere selects appear. `className` is the same string you'd
// have handed the bare <select> before (colors, width, text size, etc.);
// this just forces appearance-none and enough right padding for the icon
// on top of it — Tailwind's longhand pr-* always wins over a shorthand
// px-* in the same className, so nothing here fights your padding.
// `wrapperClassName` is only for the rare case where the select itself
// used to carry flex sizing (e.g. flex-1) that now belongs on the wrapper.
// `dense` is for the handful of very narrow selects (e.g. a 3-letter
// currency code) where the default icon spacing would eat too much of the
// box — smaller icon, tighter inset.
export default function Select({ className = '', wrapperClassName = '', dense = false, children, ...props }) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select {...props} className={`${className} appearance-none ${dense ? 'pr-6' : 'pr-9'}`}>
        {children}
      </select>
      <ChevronDown
        size={dense ? 12 : 15}
        strokeWidth={2.5}
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 ${dense ? 'right-1.5' : 'right-3'}`}
      />
    </div>
  );
}
