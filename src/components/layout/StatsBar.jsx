import { Activity, ListTree, Swords, Users } from 'lucide-react';
import { useTournamentState } from '../../context/TournamentContext';
import { getTournamentStats } from '../../utils/stats';

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-sm shadow-ink-900/[0.02]">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={17} strokeWidth={2.3} />
      </span>
      <div className="min-w-0">
        <div className="font-display text-lg font-bold leading-none text-ink-900">{value}</div>
        <div className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      </div>
    </div>
  );
}

export default function StatsBar() {
  const { categoriesData, liveMatches } = useTournamentState();
  const stats = getTournamentStats(categoriesData, liveMatches);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile icon={ListTree} label="Categories" value={stats.categories} accent="bg-brand-50 text-brand-600" />
      <StatTile icon={Users} label="Teams" value={stats.totalTeams} accent="bg-sky-50 text-sky-600" />
      <StatTile icon={Swords} label="Matches played" value={`${stats.playedMatches}/${stats.totalMatches}`} accent="bg-violet-50 text-violet-600" />
      <StatTile icon={Activity} label="Live right now" value={stats.liveMatches} accent="bg-amber-50 text-amber-600" />
    </div>
  );
}
