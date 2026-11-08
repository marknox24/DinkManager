import { AlertTriangle, CheckCircle2 } from 'lucide-react';

// "bracket_invalid" and "target_finish_exceeded" are hard problems (rose —
// the schedule can't do what was asked); everything else is informational
// (amber — the schedule is valid, here's how to tighten it up).
const HARD_TYPES = new Set(['bracket_invalid', 'target_finish_exceeded']);

// Leads with one clear, large-type answer to "will this work?" instead of
// a stack of same-sized text lines — the single most important thing a
// non-technical organizer wants to know before reading anything else.
export default function WarningsPanel({ warnings }) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={18} />
        </span>
        <div>
          <p className="text-sm font-bold text-emerald-900">This schedule works — no conflicts.</p>
          <p className="text-xs text-emerald-700">Every match fits with no double-booked teams or courts.</p>
        </div>
      </div>
    );
  }

  const hard = warnings.some((w) => HARD_TYPES.has(w.type));
  const [lead, ...rest] = warnings;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl px-5 py-4 ${hard ? 'bg-rose-50' : 'bg-amber-50'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${hard ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
          <AlertTriangle size={18} />
        </span>
        <div>
          <p className={`text-sm font-bold ${hard ? 'text-rose-900' : 'text-amber-900'}`}>
            {hard ? "This schedule needs an adjustment" : 'Feasible — worth a tweak'}
          </p>
          <p className={`text-xs ${hard ? 'text-rose-700' : 'text-amber-700'}`}>{lead.message}</p>
        </div>
      </div>

      {rest.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-black/5 pl-12 pt-3">
          {rest.map((w, i) => (
            <li key={i} className={`text-xs font-semibold ${HARD_TYPES.has(w.type) ? 'text-rose-700' : 'text-amber-700'}`}>
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
