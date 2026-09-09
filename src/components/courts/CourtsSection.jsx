import { LayoutGrid } from 'lucide-react';
import { useTournamentState } from '../../context/TournamentContext';
import CourtCard from './CourtCard';

export default function CourtsSection() {
  const { tournamentSettings, liveMatches } = useTournamentState();
  const occupied = {};
  liveMatches.forEach((m) => (occupied[m.court] = m));
  const courts = Array.from({ length: tournamentSettings.numCourts }, (_, i) => i + 1);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-white">
            <LayoutGrid size={14} />
          </span>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700">Live court status</h2>
        </div>
        <span className="text-xs font-medium text-ink-400">
          {liveMatches.length} of {tournamentSettings.numCourts} courts in play &middot; {tournamentSettings.matchDurationMinutes}m avg match
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {courts.map((c) => (
          <CourtCard key={c} courtNumber={c} liveMatch={occupied[c]} />
        ))}
      </div>
    </section>
  );
}
