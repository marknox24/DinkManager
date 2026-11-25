import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatReleaseDate } from '../../utils/releaseNotes';

const TYPE_DOT = {
  Feature: 'bg-brand-500',
  Performance: 'bg-sky-500',
  Fix: 'bg-amber-500',
};

function Details({ details }) {
  return (
    <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-[13px] leading-relaxed text-ink-600 marker:text-ink-300">
      {details.map((d) => (
        <li key={d}>{d}</li>
      ))}
    </ul>
  );
}

// One update. With a breakdown, the whole row is a button that opens it
// in place. The height animates through grid-template-rows (0fr → 1fr),
// which needs no measuring, and it's fast on purpose (200ms, strong
// ease-out): it answers a click, it isn't decoration.
function CollapsibleItem({ note }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hasDetails = note.details.length > 0;

  const header = (
    <>
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[note.type] || TYPE_DOT.Feature}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-800 transition-colors group-hover:text-brand-700">{note.title}</span>
        <span className="block text-xs font-medium text-ink-400">
          {note.type}
          <span className="sm:hidden"> · {formatReleaseDate(note.date)}</span>
        </span>
      </span>
      <span className="hidden shrink-0 text-xs font-medium text-ink-400 sm:block">{formatReleaseDate(note.date)}</span>
      {hasDetails && (
        <ChevronDown
          size={15}
          aria-hidden
          className={`mt-0.5 shrink-0 text-ink-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      )}
    </>
  );

  if (!hasDetails) return <div className="flex items-start gap-2.5 py-3.5 sm:items-center sm:gap-4">{header}</div>;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-start gap-2.5 py-3.5 text-left sm:items-center sm:gap-4"
      >
        {header}
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={`${note.title}: what changed`}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="pb-4 pl-4 pr-2">
            <Details details={note.details} />
          </div>
        </div>
      </div>
    </div>
  );
}

// The footer's compact list: each row opens its own breakdown.
export function CollapsibleReleaseNotes({ notes }) {
  return (
    <ul className="flex flex-col divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-ink-50/40 px-4 sm:px-5">
      {notes.map((n) => (
        <li key={`${n.sha}-${n.title}`}>
          <CollapsibleItem note={n} />
        </li>
      ))}
    </ul>
  );
}

// The /updates page: every breakdown already open, newest first.
export function FullReleaseNotes({ notes }) {
  return (
    <ol className="flex flex-col divide-y divide-ink-100">
      {notes.map((n) => (
        <li key={`${n.sha}-${n.title}`} className="py-6 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-500">
              <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[n.type] || TYPE_DOT.Feature}`} />
              {n.type}
            </span>
            <time dateTime={n.date}>{formatReleaseDate(n.date)}</time>
          </div>
          <h2 className="mt-1.5 font-display text-base font-bold text-ink-900">{n.title}</h2>
          {n.details.length > 0 && <Details details={n.details} />}
        </li>
      ))}
    </ol>
  );
}
