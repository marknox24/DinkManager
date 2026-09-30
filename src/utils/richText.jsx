// Minimal markdown-lite for organizer long-text fields (event description,
// rules, schedule, etc.): **bold** and *italic* only, nothing else — this is
// intentionally not a full markdown parser.
const FORMAT_RE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function renderRichText(text) {
  if (!text) return null;
  return text.split(FORMAT_RE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// For plain-text-only contexts (meta descriptions, JSON-LD) where the
// ** / * markers themselves must not show up in the output.
export function stripRichText(text) {
  if (!text) return text;
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
}
