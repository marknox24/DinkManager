import { useRef } from 'react';
import { Bold, Italic } from 'lucide-react';

// Wraps the current selection (or inserts a placeholder at the cursor) with
// a marker, matching the **bold** / *italic* syntax src/utils/richText.jsx
// renders back out on the public pages. Writes straight to the DOM node so
// the formatting and cursor position land in one synchronous step — safe
// even for a controlled textarea, since the value we set here is exactly
// what the onChange below feeds back into React state on the same tick.
function wrapSelection(textarea, marker) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd) || 'text';
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  textarea.value = `${before}${marker}${selected}${marker}${after}`;
  const newStart = selectionStart + marker.length;
  textarea.setSelectionRange(newStart, newStart + selected.length);
  textarea.focus();
  return textarea.value;
}

// Drop-in replacement for a plain <textarea> with a Bold/Italic toolbar on
// top — works as either controlled (value + onChange, e.g. CategoryEditor.jsx)
// or uncontrolled (defaultValue only, e.g. EventEditorPage.jsx), matching
// whichever pattern the caller already uses. onMouseDown (not onClick) +
// preventDefault on the toolbar buttons keeps focus/selection in the
// textarea so formatting a selection doesn't lose it.
export default function FormattableTextarea({ value, defaultValue, onChange, onBlur, placeholder, className, rows }) {
  const ref = useRef(null);

  const format = (marker) => (e) => {
    e.preventDefault();
    if (!ref.current) return;
    const next = wrapSelection(ref.current, marker);
    onChange?.({ target: { value: next } });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={format('**')}
          title="Bold"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50 hover:text-ink-800"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onMouseDown={format('*')}
          title="Italic"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:bg-ink-50 hover:text-ink-800"
        >
          <Italic size={13} />
        </button>
      </div>
      <textarea ref={ref} value={value} defaultValue={defaultValue} onChange={onChange} onBlur={onBlur} placeholder={placeholder} className={className} rows={rows} />
    </div>
  );
}
