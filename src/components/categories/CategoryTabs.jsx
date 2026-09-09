import { Radio } from 'lucide-react';
import { useTournamentState } from '../../context/TournamentContext';
import { getCategoryStats } from '../../utils/stats';

export default function CategoryTabs({ activeIdx, onSelect }) {
  const { categoriesData, liveMatches, tournamentSettings } = useTournamentState();

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {categoriesData.map((cat, idx) => {
        const active = idx === activeIdx;
        const stats = getCategoryStats(cat, liveMatches, idx, tournamentSettings);
        return (
          <button
            key={cat.name}
            onClick={() => onSelect(idx)}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              active ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
            }`}
          >
            {cat.name}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/15' : 'bg-ink-100 text-ink-500'}`}>
              {stats.played}/{stats.total}
            </span>
            {stats.inProgress > 0 && <Radio size={10} className={active ? 'text-amber-300 animate-pulse-soft' : 'text-amber-500 animate-pulse-soft'} />}
          </button>
        );
      })}
    </div>
  );
}
