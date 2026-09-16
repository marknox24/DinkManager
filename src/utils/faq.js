// FAQ is stored as a JSON-encoded array of { q, a } pairs inside the
// existing `faq` text column on `events` — no schema migration needed, it
// was already freeform text. parseFaqItems also understands the older
// "Q: ...\nA: ..." freeform convention the field's placeholder used to
// teach organizers before this structured editor existed, so anything
// written before this change still parses into the same shape instead of
// being silently lost.
export function parseFaqItems(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((item) => item && typeof item === 'object');
  } catch {
    // Not JSON — fall through to the legacy freeform parser below.
  }
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const qMatch = block.match(/^Q:\s*(.+)/i);
      const aMatch = block.match(/A:\s*([\s\S]*)/i);
      return qMatch ? { q: qMatch[1].trim(), a: (aMatch?.[1] || '').trim() } : { q: '', a: block };
    });
}

export function serializeFaqItems(items) {
  const clean = items.filter((item) => (item.q || '').trim() || (item.a || '').trim());
  return clean.length ? JSON.stringify(clean) : '';
}
