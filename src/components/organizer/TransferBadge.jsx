import { ArrowLeftRight } from 'lucide-react';

// The amber TRANSFERRED pill for a player moved into this category on event
// day (teams.transferred_in_at), so organizers can spot who needs a
// hand-made score sheet. variant="out" is the quieter pill on the team left
// behind in the old category. Organizer and staff screens only.
export default function TransferBadge({ variant = 'in', title, className = '' }) {
  const out = variant === 'out';
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide ${
        out ? 'bg-ink-100 text-ink-500' : 'bg-amber-100 text-amber-700'
      } ${className}`}
    >
      <ArrowLeftRight size={10} strokeWidth={2.6} aria-hidden="true" />
      {out ? 'Transferred out' : 'Transferred'}
    </span>
  );
}

// Under the team names in the Start match / Log score popups: says which
// side was transferred, and that a match the transfer added has no
// pre-printed score sheet.
export function TransferMatchNote({ match }) {
  const sides = [match.team_a, match.team_b].filter((t) => t?.transferred_in_at);
  if (!match.transfer_id && sides.length === 0) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-amber-800">
      <TransferBadge />
      {match.transfer_id ? 'New match from a category transfer. Use a hand-made score sheet.' : 'Includes a transferred player.'}
    </p>
  );
}
