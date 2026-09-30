import { useRef } from 'react';
import { Bold, Italic } from 'lucide-react';

// Wraps the current selection (or inserts a placeholder at the cursor) with
// a marker, matching the **bold** / *italic* syntax src/utils/richText.jsx
// renders back out on the public pages.
function wrapSelection(textarea, marker) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd) || 'text';
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  textarea.value = `${before}${marker}${selected}${marker}${after}`;
  const newStart = selectionStart + marker.length;
  textarea.setSelectionRange(newStart, newStart + selected.length);
  textarea.focus();
}

// Plain uncontrolled textarea (defaultValue + onBlur, same as every other
// long-text field in EventEditorPage.jsx) with a tiny Bold/Italic toolbar on
// top. onMouseDown (not onClick) + preventDefault on the toolbar buttons
// keeps focus in the textarea so the selection survives the click.
export default function FormattableTextarea({ defaultValue, onBlur, placeholder, className, rows }) {
  const ref = useRef(null);

  const format = (marker) => (e) => {
    e.preventDefault();
    if (ref.current) wrapSelection(ref.current, marker);
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
      <textarea ref={ref} defaultValue={defaultValue} onBlur={onBlur} placeholder={placeholder} className={className} rows={rows} />
    </div>
  );
}
